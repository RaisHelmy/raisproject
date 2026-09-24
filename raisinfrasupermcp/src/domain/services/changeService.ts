import type * as T from "../types";
import { DomainError } from "../types";
import { ServiceBase } from "./context";
import { newId } from "../ids";
import { initialStages, generateChecklist, completeStage, setStageState, computeReadiness, nextActionForChange, overallProgress, derivedStatus, riskForChange, activeStage } from "../engines/changeLifecycle";
import type { AIProvider, ChangePlan } from "../ai/provider";
import type { TaskService } from "./taskService";
import type { TelemetryService } from "./telemetryService";
import { planById, checkLimit } from "../billing";

export interface ChangeDetail {
  change: T.Change; evidence: T.ChangeEvidence[]; timeline: T.TimelineEvent[]; approvals: T.ApprovalRequest[]; tasks: T.Task[]; deployments: T.Deployment[]; incidents: T.Incident[];
  readiness: T.Readiness; nextAction: T.NextAction; progress: number; users: Record<string, string>; application?: T.Application; environment?: T.Environment; repository?: T.Repository; dependencies: { id: string; key: string; title: string; status: T.ChangeStatus }[];
}

export interface CreateChangeInput extends Partial<ChangePlan> { intent: string; applicationId?: string; targetEnvironmentId?: string; ownerId?: string; aiRunId?: string; demoScenario?: T.DemoFailureScenario; version?: string }

let changeSeq = 109;

export class ChangeService extends ServiceBase {
  constructor(store: ConstructorParameters<typeof ServiceBase>[0], private tasks: TaskService, private telemetry: TelemetryService, private ai: AIProvider) { super(store); }

  async list(ctx: T.RequestContext, filter: { view?: "all" | "mine" | "blocked" | "awaiting" | "completed" | "active"; search?: string } = {}): Promise<(T.Change & { progress: number; stageName: string })[]> {
    this.require(ctx, "change.read");
    const approvals = await this.store.approvals.list({ organizationId: ctx.actor.organizationId });
    let list = (await this.store.changes.list({ organizationId: ctx.actor.organizationId })).map((c) => ({ ...c, status: derivedStatus(c, approvals), progress: overallProgress(c), stageName: activeStage(c)?.name ?? "Closed" }));
    switch (filter.view) {
      case "mine": list = list.filter((c) => c.ownerId === ctx.actor.userId || c.requestedById === ctx.actor.userId); break;
      case "blocked": list = list.filter((c) => c.status === "BLOCKED"); break;
      case "awaiting": list = list.filter((c) => c.status === "AWAITING_APPROVAL"); break;
      case "completed": list = list.filter((c) => c.status === "COMPLETED"); break;
      case "active": list = list.filter((c) => c.status !== "COMPLETED" && c.status !== "CANCELLED"); break;
    }
    if (filter.search) { const s = filter.search.toLowerCase(); list = list.filter((c) => c.title.toLowerCase().includes(s) || c.key.toLowerCase().includes(s) || c.intent.toLowerCase().includes(s)); }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(ctx: T.RequestContext, id: string): Promise<ChangeDetail> {
    this.require(ctx, "change.read");
    const raw = this.assertTenant(ctx, await this.store.changes.get(id), "Change");
    const approvals = (await this.store.approvals.list({ changeId: id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const change = { ...raw, status: derivedStatus(raw, approvals) };
    const [evidence, timeline, tasks, deployments, incidents, users] = await Promise.all([
      this.store.evidence.list({ changeId: id }), this.store.timeline.list({ changeId: id }), this.store.tasks.list({ changeId: id }), this.store.deployments.list({ changeId: id }), this.store.incidents.list({ changeId: id }), this.store.users.list(),
    ]);
    const userNames = Object.fromEntries(users.map((u) => [u.id, u.name]));
    const deps = [];
    for (const d of change.dependencies) { const dc = await this.store.changes.get(d); if (dc) deps.push({ id: dc.id, key: dc.key, title: dc.title, status: dc.status }); }
    return {
      change, evidence: evidence.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), timeline: timeline.sort((a, b) => b.at.localeCompare(a.at)), approvals, tasks: tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), deployments: deployments.sort((a, b) => b.startedAt.localeCompare(a.startedAt)), incidents,
      readiness: computeReadiness(change, approvals), nextAction: nextActionForChange(change, approvals, ctx.actor, userNames), progress: overallProgress(change), users: userNames,
      application: change.applicationId ? await this.store.applications.get(change.applicationId) : undefined, environment: change.targetEnvironmentId ? await this.store.environments.get(change.targetEnvironmentId) : undefined, repository: change.repositoryId ? await this.store.repositories.get(change.repositoryId) : undefined, dependencies: deps,
    };
  }

  /** Section 10 — AI plans the change; user may edit before creation. Records an AI run. */
  async plan(ctx: T.RequestContext, intent: string, client = "Super MCP Web"): Promise<{ plan: ChangePlan; aiRunId: string; provider: T.AIProviderKind; model: string }> {
    this.require(ctx, "change.create");
    if (!intent.trim() || intent.trim().length < 8) throw new DomainError("VALIDATION", "Describe what you are trying to change in a sentence.");
    const apps = await this.store.applications.list({ organizationId: ctx.actor.organizationId });
    const run = await this.telemetry.startRun(ctx, { purpose: "CREATE_CHANGE", client, provider: this.ai.kind, model: this.ai.model, contextItemCount: apps.length + 3, contextType: "organization", relevantItemCount: apps.length + 3, summary: `Plan change: ${intent}` });
    const started = Date.now();
    const plan = await this.ai.planChange(intent, { applications: apps.map((a) => ({ slug: a.slug, name: a.name, runtime: a.runtime })) });
    await this.telemetry.recordCall(ctx, run.id, { toolName: "super.change.plan", durationMs: Date.now() - started + 240, status: "SUCCESS", inputs: { intent } });
    await this.telemetry.trace(ctx, run.id, { kind: "DECISION", message: `Plan generated: ${plan.impacts.filter((i) => i.status === "AFFECTED").length} affected components, ${plan.jira.length} Jira issues, confidence ${Math.round(plan.confidence * 100)}%`, reasonCategory: "PLAN" });
    return { plan, aiRunId: run.id, provider: this.ai.kind, model: this.ai.model };
  }

  async create(ctx: T.RequestContext, input: CreateChangeInput): Promise<T.Change> {
    this.require(ctx, "change.create");
    const org = (await this.store.organizations.get(ctx.actor.organizationId))!;
    const plan = planById(org.planId);
    const active = (await this.store.changes.list({ organizationId: org.id })).filter((c) => c.status !== "COMPLETED" && c.status !== "CANCELLED").length;
    const limit = checkLimit(plan, "activeChanges", active);
    if (!limit.ok) throw new DomainError("LIMIT_EXCEEDED", `Your ${plan.name} plan allows ${limit.limit} active Changes. Close a Change or upgrade.`);
    if (!input.title?.trim()) throw new DomainError("VALIDATION", "Title is required");
    const app = input.applicationId ? this.assertTenant(ctx, await this.store.applications.get(input.applicationId), "Application") : undefined;
    const env = input.targetEnvironmentId ? this.assertTenant(ctx, await this.store.environments.get(input.targetEnvironmentId), "Environment") : undefined;
    const impacts = input.impacts ?? [];
    const prod = env?.kind === "PRODUCTION";
    const at = ctx.now();
    let change: T.Change = {
      id: newId("chg"), organizationId: org.id, key: `CHG-${changeSeq++}`, title: input.title.trim(), description: input.description ?? "", intent: input.intent, status: "ACTIVE", risk: riskForChange(impacts, prod), ownerId: input.ownerId ?? ctx.actor.userId, requestedById: ctx.actor.userId,
      applicationId: app?.id, repositoryId: app?.repositoryId, targetEnvironmentId: env?.id, version: input.version ?? input.suggestedVersion, stages: initialStages(), currentStageKey: "INTENTION", impacts, checklist: generateChecklist(impacts, prod), blockers: [], requirements: input.requirements ?? [], jira: [], git: { commits: 0 },
      rollbackPlan: input.rollbackPlan ?? [], dependencies: [], demoScenario: input.demoScenario ?? (org.demo ? "HEALTH_CHECK_FAIL_THEN_RECOVER" : "NONE"), createdAt: at, updatedAt: at,
      analytics: { aiRunCount: input.aiRunId ? 1 : 0, mcpCallCount: input.aiRunId ? 1 : 0, taskCount: 0, agentOperationCount: 0, failures: 0, recoveries: 0, rollbacks: 0, humanInterventions: 0, blockedMinutes: 0, waitingMinutes: 0, stageMinutes: {} },
    };
    change = completeStage(change, "INTENTION", at); // intent confirmed by creating the change
    await this.store.changes.put(change);
    await this.store.timeline.putMany([
      { id: newId("tl"), changeId: change.id, at, kind: "AI", message: `Change created from intent “${input.intent}”`, actor: `AI (${this.ai.kind === "DEMO" ? "Demo planner" : this.ai.model}) via ${ctx.actor.userName}`, executionMode: "AI" },
      { id: newId("tl"), changeId: change.id, at, kind: "STAGE", message: `Intention confirmed → Requirements activated`, actor: ctx.actor.userName, executionMode: "HUMAN" },
    ]);
    await this.store.evidence.put({ id: newId("evd"), changeId: change.id, stageKey: "INTENTION", type: "REQUIREMENTS", title: "Intent and AI plan", summary: `${impacts.filter((i) => i.status === "AFFECTED").length} affected components; ${(input.requirements ?? []).length} requirements`, source: "AI", createdAt: at, classification: "INTERNAL" });
    if (input.aiRunId) { await this.telemetry.trace(ctx, input.aiRunId, { kind: "EXECUTION", message: `Change ${change.key} created`, executionResult: "SUCCESS" }); await this.telemetry.finishRun(ctx, input.aiRunId, { status: "COMPLETED", finalStatus: "CHANGE_CREATED", aiRequestsAvoided: 5 }); const run = await this.store.aiRuns.get(input.aiRunId); if (run) await this.store.aiRuns.put({ ...run, changeId: change.id }); }
    // Pre-store the proposed Jira issues for the JIRA stage
    (change as T.Change & { _plannedJira?: T.JiraLink[] })._plannedJira = input.jira;
    await this.store.changes.put({ ...change, jira: [] });
    this.plannedJira.set(change.id, input.jira ?? []);
    await this.audit(ctx, "change.created", "change", change.id, `${change.key} ${change.title}`, { risk: change.risk });
    return change;
  }
  private plannedJira = new Map<string, T.JiraLink[]>();

  private async load(ctx: T.RequestContext, id: string, permission: T.Permission = "change.manage"): Promise<T.Change> {
    this.require(ctx, permission);
    return this.assertTenant(ctx, await this.store.changes.get(id), "Change");
  }

  private async timeline(changeId: string, at: string, kind: T.TimelineEvent["kind"], message: string, actor: string, mode: T.ExecutionMode) {
    await this.store.timeline.put({ id: newId("tl"), changeId, at, kind, message, actor, executionMode: mode });
  }

  async update(ctx: T.RequestContext, id: string, patch: Partial<Pick<T.Change, "title" | "description" | "requirements" | "impacts" | "rollbackPlan" | "ownerId" | "targetEnvironmentId" | "applicationId" | "version">>): Promise<T.Change> {
    const c = await this.load(ctx, id);
    if (c.status === "COMPLETED") throw new DomainError("INVALID_STATE", "Completed changes cannot be edited");
    const env = patch.targetEnvironmentId ? await this.store.environments.get(patch.targetEnvironmentId) : c.targetEnvironmentId ? await this.store.environments.get(c.targetEnvironmentId) : undefined;
    const impacts = patch.impacts ?? c.impacts;
    const updated: T.Change = { ...c, ...patch, impacts, risk: riskForChange(impacts, env?.kind === "PRODUCTION"), updatedAt: ctx.now() };
    if (patch.impacts) {
      const fresh = generateChecklist(impacts, env?.kind === "PRODUCTION");
      updated.checklist = fresh.map((f) => { const prev = c.checklist.find((p) => p.title === f.title && p.category === f.category); return prev ? { ...f, id: prev.id, state: prev.state } : f; });
    }
    await this.store.changes.put(updated);
    await this.audit(ctx, "change.updated", "change", c.id, c.key, { detail: Object.keys(patch).join(",") });
    return updated;
  }

  async confirmRequirements(ctx: T.RequestContext, id: string, requirements?: string[]): Promise<T.Change> {
    let c = await this.load(ctx, id);
    if (c.currentStageKey !== "REQUIREMENTS") throw new DomainError("INVALID_STATE", "Requirements stage is not active");
    if (requirements) c.requirements = requirements.filter((r) => r.trim());
    if (c.requirements.length === 0) throw new DomainError("VALIDATION", "Add at least one requirement");
    const at = ctx.now();
    c = completeStage(c, "REQUIREMENTS", at);
    await this.store.changes.put(c);
    await this.store.evidence.put({ id: newId("evd"), changeId: c.id, stageKey: "REQUIREMENTS", type: "REQUIREMENTS", title: `Requirements confirmed (${c.requirements.length})`, source: "HUMAN", createdAt: at, classification: "INTERNAL" });
    await this.timeline(c.id, at, "STAGE", "Requirements confirmed → Jira activated", ctx.actor.userName, "HUMAN");
    await this.audit(ctx, "change.requirements_confirmed", "change", c.id, c.key);
    return c;
  }

  /** Jira sync. Live Jira is Phase 3 — in demo organizations the Task Engine creates simulated issues, clearly labelled DEMO. */
  async syncJira(ctx: T.RequestContext, id: string): Promise<T.Change> {
    this.require(ctx, "jira.write");
    let c = await this.load(ctx, id);
    if (c.currentStageKey !== "JIRA") throw new DomainError("INVALID_STATE", "Jira stage is not active");
    const jira = (await this.store.integrations.list({ organizationId: ctx.actor.organizationId, kind: "JIRA" }))[0];
    if (!jira || jira.status === "NOT_CONNECTED") throw new DomainError("INVALID_STATE", "Jira is not connected. Connect Jira in Work → Jira, or skip this stage.", { href: "/work/jira" });
    const planned = this.plannedJira.get(c.id) ?? [{ key: `CHG-${c.key.split("-")[1]}-E`, type: "Epic" as const, title: c.title, status: "To Do" }];
    const at = ctx.now();
    c.jira = planned.map((j) => ({ ...j, status: "To Do", url: `${jira.baseUrl}/browse/${j.key}` }));
    c = completeStage(c, "JIRA", at);
    c.git = { ...c.git, branch: `feature/${c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}` };
    await this.store.changes.put(c);
    await this.store.evidence.put({ id: newId("evd"), changeId: c.id, stageKey: "JIRA", type: "JIRA_ISSUE", title: `${c.jira.length} Jira issues created (${jira.status})`, reference: c.jira[0]?.key, source: "TASK_ENGINE", createdAt: at, classification: "INTERNAL" });
    await this.timeline(c.id, at, "TASK", `Jira ${c.jira.map((j) => j.key).join(", ")} created → Development activated (branch ${c.git.branch})`, "Task Engine", "TASK_ENGINE");
    await this.audit(ctx, "jira.sync", "change", c.id, c.key, { detail: jira.status });
    return c;
  }

  async skipStage(ctx: T.RequestContext, id: string, key: T.ChangeStageKey, reason: string): Promise<T.Change> {
    let c = await this.load(ctx, id);
    if (c.currentStageKey !== key || !["JIRA", "REVIEW", "UAT"].includes(key)) throw new DomainError("INVALID_STATE", `Stage ${key} cannot be skipped`);
    const at = ctx.now();
    c = setStageState(c, key, "SKIPPED", at, 100);
    c = completeStage({ ...c, stages: c.stages.map((s) => s.key === key ? { ...s, state: "COMPLETED" as const } : s) }, key, at);
    c.stages = c.stages.map((s) => s.key === key ? { ...s, state: "SKIPPED" } : s);
    await this.store.changes.put(c);
    await this.timeline(c.id, at, "STAGE", `${key.replace(/_/g, " ").toLowerCase()} skipped: ${reason}`, ctx.actor.userName, "HUMAN");
    await this.audit(ctx, "change.stage_skipped", "change", c.id, `${c.key} ${key}`, { detail: reason });
    return c;
  }

  /**
   * Git events (section 17/31). In production these arrive via provider webhooks or the Agent's local git cache.
   * In demo organizations the same handler is invoked from the UI ("Simulate PR merged"), labelled DEMO.
   */
  async gitEvent(ctx: T.RequestContext, id: string, event: { type: "COMMITS" | "PR_OPENED" | "PR_MERGED" | "CI_PASSED" | "CI_FAILED"; commits?: number; prNumber?: number }, source: T.ExecutionMode = "WEBHOOK"): Promise<T.Change> {
    let c = await this.load(ctx, id, "change.read");
    const at = ctx.now();
    const actor = source === "WEBHOOK" ? "Webhook" : source === "AGENT" ? "Agent" : ctx.actor.userName;
    switch (event.type) {
      case "COMMITS": c.git = { ...c.git, commits: c.git.commits + (event.commits ?? 1) }; c = setStageState(c, "DEVELOPMENT", "ACTIVE", at, Math.min(80, 20 + c.git.commits * 4)); await this.store.evidence.put({ id: newId("evd"), changeId: c.id, stageKey: "DEVELOPMENT", type: "GIT_COMMIT", title: `${event.commits ?? 1} new commit(s) on ${c.git.branch ?? "branch"}`, source: source, createdAt: at, classification: "INTERNAL" }); break;
      case "PR_OPENED": c.git = { ...c.git, pullRequest: { number: event.prNumber ?? 300 + Math.floor(Math.random() * 100), state: "OPEN" }, ciStatus: "RUNNING" }; c = setStageState(c, "DEVELOPMENT", "ACTIVE", at, 90); await this.timeline(c.id, at, "SYSTEM", `PR #${c.git.pullRequest!.number} opened, CI running`, actor, source); break;
      case "PR_MERGED": {
        if (!c.git.pullRequest) c.git = { ...c.git, pullRequest: { number: event.prNumber ?? 300 + Math.floor(Math.random() * 100), state: "MERGED" } }; else c.git.pullRequest = { ...c.git.pullRequest, state: "MERGED" };
        if (c.currentStageKey === "DEVELOPMENT") { c = completeStage(c, "DEVELOPMENT", at); await this.timeline(c.id, at, "SYSTEM", `PR #${c.git.pullRequest!.number} merged → Development complete → Review complete → Testing activated`, actor, source); }
        if (c.currentStageKey === "REVIEW") c = completeStage(c, "REVIEW", at);
        await this.store.evidence.put({ id: newId("evd"), changeId: c.id, stageKey: "REVIEW", type: "PULL_REQUEST", title: `PR #${c.git.pullRequest!.number} merged`, reference: `#${c.git.pullRequest!.number}`, source, createdAt: at, classification: "INTERNAL" });
        c.jira = c.jira.map((j) => ({ ...j, status: j.type === "Epic" ? "In Progress" : "Done" }));
        if (c.jira.length) await this.timeline(c.id, at, "TASK", `Jira ${c.jira.map((j) => j.key).join(", ")} updated (development complete)`, "Task Engine", "TASK_ENGINE");
        break;
      }
      case "CI_PASSED": {
        c.git = { ...c.git, ciStatus: "PASSED" };
        c.checklist = c.checklist.map((i) => i.stageKey === "TESTING" && i.automated ? { ...i, state: "DONE" } : i);
        await this.store.evidence.putMany([{ id: newId("evd"), changeId: c.id, stageKey: "TESTING", type: "CI_RESULT", title: "CI passed", summary: "build + tests green", source, createdAt: at, classification: "INTERNAL" }, { id: newId("evd"), changeId: c.id, stageKey: "TESTING", type: "TEST_RESULT", title: "Automated tests passed", source: "AGENT", createdAt: at, classification: "INTERNAL" }]);
        if (c.currentStageKey === "TESTING" && c.checklist.filter((i) => i.stageKey === "TESTING" && i.required).every((i) => i.state === "DONE" || i.state === "WAIVED")) { c = completeStage(c, "TESTING", at); await this.timeline(c.id, at, "SYSTEM", "CI passed → Testing complete → Deployment Preparation activated", actor, source); }
        break;
      }
      case "CI_FAILED": c.git = { ...c.git, ciStatus: "FAILED" }; c = setStageState(c, "TESTING", "BLOCKED", at); c.blockers.push({ id: newId("blk"), title: "CI failed", reason: "The pipeline failed. Fix the build before testing can complete.", missing: ["Green CI run"], waitingFor: { userId: c.ownerId, label: "Change owner" }, stageKey: "TESTING", createdAt: at }); await this.timeline(c.id, at, "SYSTEM", "CI failed → Testing blocked", actor, source); break;
    }
    c.updatedAt = at;
    await this.store.changes.put(c);
    return c;
  }

  async toggleChecklist(ctx: T.RequestContext, id: string, itemId: string, state: T.ChecklistItem["state"]): Promise<T.Change> {
    let c = await this.load(ctx, id);
    const item = c.checklist.find((i) => i.id === itemId);
    if (!item) throw new DomainError("NOT_FOUND", "Checklist item not found");
    if (item.title.includes("approval") && state === "DONE") throw new DomainError("VALIDATION", "Approval items are completed by the Approval Engine, not manually.");
    if (state === "WAIVED") this.require(ctx, "policy.manage");
    c.checklist = c.checklist.map((i) => i.id === itemId ? { ...i, state } : i);
    c.updatedAt = ctx.now();
    if (c.currentStageKey === "TESTING" && c.checklist.filter((i) => i.stageKey === "TESTING" && i.required).every((i) => i.state === "DONE" || i.state === "WAIVED") && c.git.ciStatus === "PASSED") { c = completeStage(c, "TESTING", ctx.now()); await this.timeline(c.id, ctx.now(), "SYSTEM", "Testing checklist complete → Deployment Preparation activated", "System", "SYSTEM"); }
    await this.store.changes.put(c);
    await this.audit(ctx, "change.checklist", "change", c.id, `${c.key}: ${item.title} → ${state}`, { risk: state === "WAIVED" ? "HIGH" : "LOW" });
    return c;
  }

  /**
   * Deployment preparation complete → approval requested. Creates the deployment task; the Policy Engine
   * decides whether approval is needed. Production readiness must pass (excluding the approval check itself).
   */
  async requestDeployment(ctx: T.RequestContext, id: string, opts: { aiRunId?: string; client?: string } = {}): Promise<{ change: T.Change; task: T.Task; approvalRequestId?: string }> {
    let c = await this.load(ctx, id);
    if (!["DEPLOYMENT_PREPARATION", "APPROVAL"].includes(c.currentStageKey)) throw new DomainError("INVALID_STATE", `Deployment can only be requested from Deployment Preparation (current: ${c.currentStageKey})`);
    if (!c.applicationId || !c.targetEnvironmentId) throw new DomainError("VALIDATION", "Select an application and a target environment first");
    if (c.blockers.some((b) => !b.resolvedAt && b.stageKey === "DEPLOYMENT_PREPARATION")) throw new DomainError("INVALID_STATE", "Resolve open blockers before requesting deployment", { blockers: c.blockers.filter((b) => !b.resolvedAt) });
    const existing = (await this.store.approvals.list({ changeId: id })).filter((a) => a.status === "PENDING" && a.kind === "DEPLOYMENT");
    if (existing.length) throw new DomainError("INVALID_STATE", `Approval ${existing[0].key} is already pending`, { approvalRequestId: existing[0].id });
    const readiness = computeReadiness(c, await this.store.approvals.list({ changeId: id }));
    const failing = readiness.checks.filter((r) => r.required && r.key !== "approval" && r.state === "FAIL");
    if (failing.length) throw new DomainError("INVALID_STATE", `Production readiness failed: ${failing.map((f) => f.label).join(", ")}`, { readiness });
    const pendingRequired = c.checklist.filter((i) => i.stageKey === "DEPLOYMENT_PREPARATION" && i.required && i.state === "PENDING" && !i.automated);
    if (pendingRequired.length) throw new DomainError("INVALID_STATE", `Complete the checklist first: ${pendingRequired.map((i) => i.title).join(", ")}`);
    const at = ctx.now();
    const includesMigration = c.impacts.some((i) => i.component === "Database" && i.status === "AFFECTED");
    const app = (await this.store.applications.get(c.applicationId))!;
    const env = (await this.store.environments.get(c.targetEnvironmentId))!;
    const version = c.version ?? "v" + (Number((app.deployedVersions[env.id] ?? "v1.0").replace(/^v/, "").split(".")[0]) + 1) + ".0.0";
    const { task, approvalRequestId } = await this.tasks.create(ctx, { definitionId: "deploy-application", inputs: { applicationId: app.id, environmentId: env.id, version, includesMigration }, name: `Deploy ${app.slug} ${version} to ${env.name}`, changeId: c.id, environmentId: env.id, applicationId: app.id, aiRunId: opts.aiRunId, scenario: (c.demoScenario as T.DemoFailureScenario | undefined) ?? "NONE" });
    c = { ...(await this.store.changes.get(c.id))!, version };
    c.checklist = c.checklist.map((i) => i.stageKey === "DEPLOYMENT_PREPARATION" && i.automated ? { ...i, state: "DONE" } : i);
    if (c.currentStageKey === "DEPLOYMENT_PREPARATION") { c = completeStage(c, "DEPLOYMENT_PREPARATION", at); await this.timeline(c.id, at, "SYSTEM", "Checklist complete → Approval requested", "System", "SYSTEM"); }
    if (approvalRequestId) {
      const req = (await this.store.approvals.get(approvalRequestId))!;
      c.blockers = [...c.blockers, { id: newId("blk"), title: `${env.name} deployment cannot start`, reason: `${req.requiredApprovals} approval(s) required (risk ${req.risk}).`, missing: req.slots.map((s) => `${s.approver.label} approval`), waitingFor: { roleKey: req.slots[0].approver.kind.toLowerCase(), label: req.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ") }, approvalRequestId, stageKey: "APPROVAL", createdAt: at }];
      c.status = "AWAITING_APPROVAL";
      await this.timeline(c.id, at, "APPROVAL", `${req.key} requested from ${req.slots.map((s) => s.approver.label).join(", ")} (risk ${req.risk})`, ctx.executionMode === "AI" ? `AI via ${ctx.actor.userName}` : ctx.actor.userName, ctx.executionMode);
    } else {
      c = completeStage(c, "APPROVAL", at);
      await this.timeline(c.id, at, "SYSTEM", `Policy: automatic (${task.policyDecision?.explanation.slice(-1)[0] ?? "no approval required"}) → Deployment unlocked`, "System", "SYSTEM");
    }
    c.analytics = { ...c.analytics, taskCount: c.analytics.taskCount + 1 };
    c.updatedAt = at;
    await this.store.changes.put(c);
    return { change: c, task, approvalRequestId };
  }

  async recordUat(ctx: T.RequestContext, id: string, result: "PASSED" | "FAILED", note: string): Promise<T.Change> {
    let c = await this.load(ctx, id);
    if (c.currentStageKey !== "UAT") throw new DomainError("INVALID_STATE", "UAT stage is not active");
    const at = ctx.now();
    await this.store.evidence.put({ id: newId("evd"), changeId: c.id, stageKey: "UAT", type: "UAT_RESULT", title: `UAT ${result.toLowerCase()}`, summary: note, source: "HUMAN", createdAt: at, classification: "INTERNAL" });
    if (result === "PASSED") { c.checklist = c.checklist.map((i) => i.stageKey === "UAT" ? { ...i, state: "DONE" } : i); c = completeStage(c, "UAT", at); await this.timeline(c.id, at, "STAGE", `UAT passed → Change ready to close`, ctx.actor.userName, "HUMAN"); }
    else { c = setStageState(c, "UAT", "BLOCKED", at); c.blockers.push({ id: newId("blk"), title: "UAT failed", reason: note || "Users reported issues during acceptance testing.", missing: ["Fix and redeploy", "Re-run UAT"], waitingFor: { userId: c.ownerId, label: "Change owner" }, stageKey: "UAT", createdAt: at }); await this.timeline(c.id, at, "STAGE", `UAT failed: ${note}`, ctx.actor.userName, "HUMAN"); }
    await this.store.changes.put(c);
    await this.audit(ctx, `uat.${result.toLowerCase()}`, "change", c.id, c.key, { detail: note });
    return c;
  }

  async close(ctx: T.RequestContext, id: string, outcome: string): Promise<T.Change> {
    let c = await this.load(ctx, id);
    if (c.currentStageKey !== "CLOSURE") throw new DomainError("INVALID_STATE", "All stages must be complete before closing");
    const at = ctx.now();
    c = completeStage(c, "CLOSURE", at);
    c.status = "COMPLETED"; c.closedAt = at;
    const started = new Date(c.createdAt).getTime();
    c.analytics.stageMinutes = Object.fromEntries(c.stages.filter((s) => s.startedAt && s.completedAt).map((s) => [s.key, Math.round((new Date(s.completedAt!).getTime() - new Date(s.startedAt!).getTime()) / 60000)]));
    await this.store.changes.put(c);
    await this.timeline(c.id, at, "STAGE", `Change closed: ${outcome}. Total duration ${Math.round((Date.now() - started) / 3600000)}h; ${c.analytics.aiRunCount} AI runs, ${c.analytics.taskCount} tasks, ${c.analytics.recoveries} recoveries.`, ctx.actor.userName, "HUMAN");
    await this.audit(ctx, "change.closed", "change", c.id, c.key, { detail: outcome });
    // Learning loop: a change with a recovery becomes a knowledge record candidate.
    if (c.analytics.recoveries > 0) await this.store.knowledge.put({ id: newId("kr"), organizationId: c.organizationId, type: "DEPLOYMENT_PATTERN", title: `${c.title}: recovered deployment`, condition: `${c.impacts.filter((i) => i.status === "AFFECTED").map((i) => i.component).join("+")} to ${c.targetEnvironmentId}`, resolution: `${c.analytics.recoveries} deterministic recovery action(s) succeeded without AI`, successRate: 1, applications: 1, createdAt: at });
    return c;
  }

  async cancel(ctx: T.RequestContext, id: string, reason: string): Promise<T.Change> {
    const c = await this.load(ctx, id);
    if (c.status === "COMPLETED") throw new DomainError("INVALID_STATE", "Completed changes cannot be cancelled");
    const pending = (await this.store.approvals.list({ changeId: id })).filter((a) => a.status === "PENDING");
    for (const a of pending) await this.store.approvals.put({ ...a, status: "CANCELLED", decidedAt: ctx.now() });
    const updated: T.Change = { ...c, status: "CANCELLED", updatedAt: ctx.now(), closedAt: ctx.now() };
    await this.store.changes.put(updated);
    await this.timeline(c.id, ctx.now(), "STAGE", `Change cancelled: ${reason}`, ctx.actor.userName, "HUMAN");
    await this.audit(ctx, "change.cancelled", "change", c.id, c.key, { risk: "MEDIUM", detail: reason });
    return updated;
  }

  async comment(ctx: T.RequestContext, id: string, text: string): Promise<T.TimelineEvent> {
    const c = await this.load(ctx, id, "change.read");
    if (!text.trim()) throw new DomainError("VALIDATION", "Comment cannot be empty");
    const ev: T.TimelineEvent = { id: newId("tl"), changeId: c.id, at: ctx.now(), kind: "COMMENT", message: text.trim(), actor: ctx.actor.userName, executionMode: "HUMAN" };
    await this.store.timeline.put(ev);
    return ev;
  }

  /** Section 31 — correlation suggestion when git activity outpaces Jira. */
  async correlationSuggestions(ctx: T.RequestContext): Promise<{ changeId: string; changeKey: string; message: string }[]> {
    this.require(ctx, "change.read");
    const list = await this.store.changes.list({ organizationId: ctx.actor.organizationId });
    return list.filter((c) => c.git.pullRequest?.state === "MERGED" && c.git.ciStatus === "PASSED" && c.jira.some((j) => j.status !== "Done" && j.type !== "Epic")).map((c) => ({ changeId: c.id, changeKey: c.key, message: `${c.key} appears to have completed development (${c.git.commits} commits, PR merged, CI passed). Update Jira?` }));
  }
}
