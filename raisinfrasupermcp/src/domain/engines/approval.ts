import type { Actor, ApprovalRequest, ApprovalSlot, ApproverRef, PolicyDecision } from "../types";

export function buildSlots(decision: PolicyDecision): ApprovalSlot[] {
  return decision.approvers.map((approver, i) => ({ approver, status: "PENDING", sequence: i + 1 }));
}

/** Can this actor act on a given approver slot? */
export function actorSatisfies(actor: Actor, approver: ApproverRef): boolean {
  switch (approver.kind) {
    case "USER": return approver.id === actor.userId;
    case "ORG_OWNER": return actor.isOwner || actor.roleKeys.includes("org_owner");
    case "ORG_ADMIN": return actor.isOwner || actor.roleKeys.includes("org_owner") || actor.roleKeys.includes("org_admin");
    case "SECURITY_ADMIN": return actor.roleKeys.includes("security_admin"); // separation of duties: owner does not double as security
    case "MANAGER": return actor.roleKeys.includes("org_admin") || actor.isOwner;
    case "ROLE": return Boolean(approver.id && actor.roleKeys.includes(approver.id));
    case "GROUP": return false; // resolved by caller with group membership
    case "DEPARTMENT": return false;
  }
}

export function eligibleSlots(request: ApprovalRequest, actor: Actor, groupIds: string[] = []): ApprovalSlot[] {
  if (request.slots.some((s) => s.decidedById === actor.userId)) return []; // one decision per person per request
  const pending = request.slots.filter((s) => s.status === "PENDING");
  const eligible = pending.filter((s) => s.approver.kind === "GROUP" ? groupIds.includes(s.approver.id ?? "") : actorSatisfies(actor, s.approver));
  if (request.strategy === "SEQUENTIAL") {
    const next = pending.sort((a, b) => a.sequence - b.sequence)[0];
    return next && eligible.includes(next) ? [next] : [];
  }
  return eligible;
}

export function canActorDecide(request: ApprovalRequest, actor: Actor, groupIds: string[] = []): boolean {
  if (request.status !== "PENDING") return false;
  if (request.requestedById === actor.userId && !actor.isOwner) return false; // no self-approval unless owner of a personal org
  return eligibleSlots(request, actor, groupIds).length > 0;
}

export type Decision = "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

/**
 * Applies a decision. Strategy semantics:
 *   ANY        — one approval satisfies the request (requiredApprovals treated as 1)
 *   ALL        — every slot must approve (and at least requiredApprovals)
 *   PARALLEL   — requiredApprovals approvals from any slots, in any order
 *   SEQUENTIAL — slots approve in order
 */
export function applyDecision(request: ApprovalRequest, actor: Actor, decision: Decision, comment: string | undefined, at: string, groupIds: string[] = []): ApprovalRequest {
  const slots = eligibleSlots(request, actor, groupIds);
  if (slots.length === 0) throw new Error("Actor is not an eligible approver for this request");
  const slot = slots[0];
  const updatedSlots = request.slots.map((s) => s === slot ? { ...s, status: decision, decidedById: actor.userId, decidedByName: actor.userName, decidedAt: at, comment } : s);
  let status = request.status;
  if (decision === "REJECTED") status = "REJECTED";
  else if (decision === "CHANGES_REQUESTED") status = "CHANGES_REQUESTED";
  else {
    const approved = updatedSlots.filter((s) => s.status === "APPROVED").length;
    const satisfied = request.strategy === "ANY" ? approved >= 1
      : request.strategy === "ALL" ? updatedSlots.every((s) => s.status === "APPROVED")
      : approved >= request.requiredApprovals;
    if (satisfied) status = "APPROVED";
  }
  return { ...request, slots: updatedSlots, status, decidedAt: status === "PENDING" ? undefined : at };
}
