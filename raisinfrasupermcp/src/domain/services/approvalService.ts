import type { ApprovalRequest, RequestContext, PolicyDecision, RiskLevel, Task, Change } from "../types";
import { DomainError } from "../types";
import { ServiceBase } from "./context";
import { applyDecision, buildSlots, canActorDecide, type Decision } from "../engines/approval";
import { completeStage, setStageState } from "../engines/changeLifecycle";
import { newId } from "../ids";

export interface ApprovalDetail { request: ApprovalRequest; change?: Change; task?: Task; canDecide: boolean; requiresTypedConfirmation: boolean; confirmationPhrase?: string }

export class ApprovalService extends ServiceBase {
  private nextKey = 32;

  async list(ctx: RequestContext, filter: { status?: ApprovalRequest["status"]; mine?: boolean } = {}): Promise<(ApprovalRequest & { canDecide: boolean })[]> {
    this.require(ctx, "change.read");
    const groupIds = (await this.store.memberships.get(ctx.actor.membershipId))?.groupIds ?? [];
    let list = await this.store.approvals.list({ organizationId: ctx.actor.organizationId });
    if (filter.status) list = list.filter((a) => a.status === filter.status);
    const withFlags = list.map((a) => ({ ...a, canDecide: canActorDecide(a, ctx.actor, groupIds) }));
    return (filter.mine ? withFlags.filter((a) => a.canDecide) : withFlags).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(ctx: RequestContext, id: string): Promise<ApprovalDetail> {
    this.require(ctx, "change.read");
    const request = this.assertTenant(ctx, await this.store.approvals.get(id), "Approval");
    const groupIds = (await this.store.memberships.get(ctx.actor.membershipId))?.groupIds ?? [];
    const change = request.changeId ? await this.store.changes.get(request.changeId) : undefined;
    const task = request.taskId ? await this.store.tasks.get(request.taskId) : undefined;
    const typed = Boolean(request.policyDecision?.typedConfirmation) || request.risk === "CRITICAL";
    return { request, change, task, canDecide: canActorDecide(request, ctx.actor, groupIds), requiresTypedConfirmation: typed, confirmationPhrase: typed ? `APPROVE ${request.key}` : undefined };
  }

  /** Create an approval request from a policy decision (called by the Task Engine / Change service). */
  async createFromDecision(ctx: RequestContext, input: { decision: PolicyDecision; title: string; kind: ApprovalRequest["kind"]; changeId?: string; taskId?: string; environmentId?: string; environmentName?: string; summary: string[] }): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: newId("apr"), organizationId: ctx.actor.organizationId, key: `APR-${this.nextKey++}`, title: input.title, kind: input.kind, changeId: input.changeId, taskId: input.taskId, environmentId: input.environmentId, environmentName: input.environmentName,
      risk: input.decision.risk, requestedById: ctx.actor.userId, requestedByName: ctx.actor.userName, requiredApprovals: input.decision.requiredApprovals, strategy: input.decision.strategy, slots: buildSlots(input.decision), status: "PENDING", summary: input.summary, policyDecision: input.decision, createdAt: ctx.now(), expiresAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
    };
    await this.store.approvals.put(request);
    await this.audit(ctx, "approval.requested", "approval", request.id, `${request.key} ${request.title}`, { risk: request.risk });
    const approverRoles = request.slots.map((s) => s.approver.kind === "ORG_OWNER" ? "org_owner" : s.approver.kind === "ORG_ADMIN" ? "org_admin" : s.approver.kind === "SECURITY_ADMIN" ? "security_admin" : s.approver.kind === "ROLE" ? s.approver.id ?? "" : "");
    const recipients = await this.usersWithRoles(ctx.actor.organizationId, approverRoles.filter(Boolean));
    await this.notify(ctx, recipients.filter((u) => u !== ctx.actor.userId), "APPROVAL_REQUESTED", `${request.environmentName ?? ""} ${request.kind === "DEPLOYMENT" ? "deployment" : request.kind.toLowerCase().replace("_", " ")} approval required`.trim(), `${request.requestedByName} requested: ${request.title} (risk ${request.risk}).`, `/approvals/${request.id}`);
    return request;
  }

  async decide(ctx: RequestContext, id: string, decision: Decision, comment?: string, typedConfirmation?: string): Promise<{ request: ApprovalRequest; unlockedTaskId?: string }> {
    this.require(ctx, decision === "APPROVED" ? "task.approve" : "task.reject");
    const request = this.assertTenant(ctx, await this.store.approvals.get(id), "Approval");
    if (request.status !== "PENDING") throw new DomainError("INVALID_STATE", `Approval ${request.key} is already ${request.status.toLowerCase()}`);
    const groupIds = (await this.store.memberships.get(ctx.actor.membershipId))?.groupIds ?? [];
    if (!canActorDecide(request, ctx.actor, groupIds)) {
      await this.audit(ctx, "approval.denied", "approval", request.id, request.key, { risk: request.risk, result: "DENIED", detail: "Actor is not an eligible approver" });
      throw new DomainError("FORBIDDEN", "You are not an eligible approver for this request", { waitingFor: request.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label) });
    }
    const needsTyped = Boolean(request.policyDecision?.typedConfirmation) || request.risk === "CRITICAL";
    if (decision === "APPROVED" && needsTyped && typedConfirmation !== `APPROVE ${request.key}`) throw new DomainError("VALIDATION", `Type “APPROVE ${request.key}” to confirm this ${request.risk} risk approval`);

    const updated = applyDecision(request, ctx.actor, decision, comment, ctx.now(), groupIds);
    await this.store.approvals.put(updated);
    await this.audit(ctx, `approval.${decision.toLowerCase()}`, "approval", updated.id, `${updated.key} ${updated.title}`, { risk: updated.risk, detail: comment });

    let unlockedTaskId: string | undefined;
    const task = updated.taskId ? await this.store.tasks.get(updated.taskId) : undefined;
    const change = updated.changeId ? await this.store.changes.get(updated.changeId) : undefined;
    const at = ctx.now();

    if (updated.status === "APPROVED") {
      if (task && task.status === "WAITING_APPROVAL") { unlockedTaskId = task.id; task.log.push({ at, level: "INFO", message: `Approval ${updated.key} granted by ${ctx.actor.userName}`, executionMode: "HUMAN" }); await this.store.tasks.put(task); }
      if (change) {
        let c = { ...change, blockers: change.blockers.map((b) => b.approvalRequestId === updated.id ? { ...b, resolvedAt: at } : b) };
        if (updated.kind === "DEPLOYMENT" && c.currentStageKey === "APPROVAL") { c = completeStage(c, "APPROVAL", at); c.status = "ACTIVE"; }
        else if (updated.kind === "DATABASE_MIGRATION") { c = setStageState(c, c.currentStageKey, "ACTIVE", at); c.status = c.blockers.some((b) => !b.resolvedAt) ? "BLOCKED" : "ACTIVE"; c.checklist = c.checklist.map((i) => i.title === "Production migration approval" ? { ...i, state: "DONE" } : i); }
        c.analytics = { ...c.analytics, humanInterventions: c.analytics.humanInterventions + 1 };
        await this.store.changes.put(c);
        await this.store.timeline.put({ id: newId("tl"), changeId: c.id, at, kind: "APPROVAL", message: `${updated.key} approved by ${ctx.actor.userName}${updated.kind === "DEPLOYMENT" ? " → Deployment unlocked" : ""}`, actor: ctx.actor.userName, executionMode: "HUMAN" });
        await this.store.evidence.put({ id: newId("evd"), changeId: c.id, stageKey: "APPROVAL", type: "APPROVAL", title: `${updated.key} approved`, reference: updated.key, summary: `${updated.slots.filter((s) => s.status === "APPROVED").map((s) => s.decidedByName).join(", ")}${comment ? " — " + comment : ""}`, source: "HUMAN", createdAt: at, classification: "INTERNAL" });
      }
      await this.notify(ctx, [updated.requestedById], "APPROVAL_APPROVED", `${updated.key} approved`, `${ctx.actor.userName} approved “${updated.title}”.${unlockedTaskId ? " Deployment unlocked." : ""}`, change ? `/changes/${change.id}` : `/approvals/${updated.id}`);
    } else if (updated.status === "PENDING") {
      const remaining = updated.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ");
      if (change) await this.store.timeline.put({ id: newId("tl"), changeId: change.id, at, kind: "APPROVAL", message: `${updated.key}: ${ctx.actor.userName} approved (${updated.slots.filter((s) => s.status === "APPROVED").length}/${updated.requiredApprovals}) — waiting for ${remaining}`, actor: ctx.actor.userName, executionMode: "HUMAN" });
    } else {
      if (task && task.status === "WAITING_APPROVAL") { task.status = "CANCELLED"; task.finishedAt = at; task.summary = `${decision === "REJECTED" ? "Rejected" : "Changes requested"} by ${ctx.actor.userName}${comment ? ": " + comment : ""}`; task.log.push({ at, level: "WARN", message: task.summary, executionMode: "HUMAN" }); await this.store.tasks.put(task); }
      if (change) {
        const c = { ...change, status: "BLOCKED" as const, blockers: [...change.blockers.map((b) => b.approvalRequestId === updated.id ? { ...b, resolvedAt: at } : b), { id: newId("blk"), title: decision === "REJECTED" ? `${updated.key} rejected` : `${updated.key}: changes requested`, reason: comment ?? `${ctx.actor.userName} ${decision === "REJECTED" ? "rejected the request" : "requested changes"}.`, missing: decision === "REJECTED" ? ["New approval request after addressing feedback"] : ["Address requested changes", "Re-request approval"], waitingFor: { userId: change.ownerId, label: "Change owner" }, stageKey: change.currentStageKey, createdAt: at }] };
        await this.store.changes.put(c);
        await this.store.timeline.put({ id: newId("tl"), changeId: c.id, at, kind: "APPROVAL", message: `${updated.key} ${decision === "REJECTED" ? "rejected" : "changes requested"} by ${ctx.actor.userName}${comment ? ": " + comment : ""}`, actor: ctx.actor.userName, executionMode: "HUMAN" });
      }
      await this.notify(ctx, [updated.requestedById], "APPROVAL_REJECTED", `${updated.key} ${decision === "REJECTED" ? "rejected" : "needs changes"}`, `${ctx.actor.userName}: ${comment ?? "No comment"}`, change ? `/changes/${change.id}` : `/approvals/${updated.id}`);
    }
    await this.store.humanInterventions.put({ id: newId("hi"), organizationId: ctx.actor.organizationId, userId: ctx.actor.userId, userName: ctx.actor.userName, taskId: updated.taskId, changeId: updated.changeId, reason: "Approval decision", action: `${decision} ${updated.key}`, at });
    return { request: updated, unlockedTaskId };
  }

  riskLabel(r: RiskLevel) { return r; }
}
