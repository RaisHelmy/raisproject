import type { Change, ChangeImpact, ChangeStage, ChangeStageKey, ChecklistItem, ChecklistCategory, ImpactComponent, NextAction, Readiness, ReadinessCheck, ApprovalRequest, RiskLevel, Actor } from "../types";
import { newId } from "../ids";

export const STAGE_ORDER: { key: ChangeStageKey; name: string }[] = [
  { key: "INTENTION", name: "Intention" },
  { key: "REQUIREMENTS", name: "Requirements" },
  { key: "JIRA", name: "Jira" },
  { key: "DEVELOPMENT", name: "Development" },
  { key: "REVIEW", name: "Code Review" },
  { key: "TESTING", name: "Testing" },
  { key: "DEPLOYMENT_PREPARATION", name: "Deployment Preparation" },
  { key: "APPROVAL", name: "Approval" },
  { key: "DEPLOYMENT", name: "Deployment" },
  { key: "LIVE_VALIDATION", name: "Live Validation" },
  { key: "UAT", name: "UAT" },
  { key: "CLOSURE", name: "Closure" },
];

export const IMPACT_COMPONENTS: ImpactComponent[] = ["Frontend", "Backend", "Database", "File Storage", "Infrastructure", "External API", "Mobile"];

export function initialStages(): ChangeStage[] {
  return STAGE_ORDER.map((s, i) => ({ key: s.key, name: s.name, order: i, state: i === 0 ? "ACTIVE" : "PENDING", progress: 0 }));
}

export function stageIndex(key: ChangeStageKey): number { return STAGE_ORDER.findIndex((s) => s.key === key); }

/** Section 14 — dynamic checklist generated from the impact map. */
export function generateChecklist(impacts: ChangeImpact[], targetIsProduction: boolean): ChecklistItem[] {
  const affected = new Set(impacts.filter((i) => i.status !== "NO_CHANGE").map((i) => i.component));
  const items: Omit<ChecklistItem, "id">[] = [];
  const add = (category: ChecklistCategory, stageKey: ChangeStageKey, title: string, required = true, automated = false) => items.push({ category, stageKey, title, required, automated, state: "PENDING" });

  if (affected.has("Frontend") || affected.has("Mobile")) {
    add("Frontend", "TESTING", "Frontend build succeeds", true, true);
    add("Frontend", "TESTING", "Unit tests pass", true, true);
    add("Frontend", "TESTING", "Browser tests pass", true, true);
    add("Frontend", "DEPLOYMENT_PREPARATION", "Static asset validation", true, true);
    add("Frontend", "DEPLOYMENT_PREPARATION", "Deployed to staging", true, true);
    add("Frontend", "LIVE_VALIDATION", "Smoke test (UI)", true, true);
  }
  if (affected.has("Backend") || affected.has("External API")) {
    add("Backend", "TESTING", "API tests pass", true, true);
    add("Backend", "TESTING", "Integration tests pass", true, true);
    add("Backend", "TESTING", "Dependency vulnerability scan", true, true);
    add("Backend", "DEPLOYMENT_PREPARATION", "Configuration reviewed", true);
    add("Backend", "DEPLOYMENT_PREPARATION", "Docker image built and scanned", true, true);
    add("Backend", "LIVE_VALIDATION", "Health endpoint responds", true, true);
    add("Backend", "LIVE_VALIDATION", "Logs show no new errors", true, true);
  }
  if (affected.has("Database") || affected.has("File Storage")) {
    add("Database", "REVIEW", "Migration reviewed", true);
    add("Database", "DEPLOYMENT_PREPARATION", "Backup verified", true, true);
    add("Database", "TESTING", "Migration tested on staging", true, true);
    add("Database", "DEPLOYMENT_PREPARATION", "Data impact assessed", true);
    add("Database", "DEPLOYMENT_PREPARATION", "Migration duration estimated", false);
    add("Database", "DEPLOYMENT_PREPARATION", "Rollback script prepared", true);
    if (targetIsProduction) add("Database", "APPROVAL", "Production migration approval", true);
  }
  if (affected.has("Infrastructure")) {
    add("Infrastructure", "DEPLOYMENT_PREPARATION", "Capacity check", true, true);
    add("Infrastructure", "DEPLOYMENT_PREPARATION", "Network & firewall rules", true);
    add("Infrastructure", "DEPLOYMENT_PREPARATION", "DNS / SSL validated", true, true);
    add("Infrastructure", "DEPLOYMENT_PREPARATION", "Monitoring configured", true);
    add("Infrastructure", "DEPLOYMENT_PREPARATION", "Backup & rollback plan", true);
  }
  add("Security", "DEPLOYMENT_PREPARATION", "Security review", true);
  if (targetIsProduction) add("General", "APPROVAL", "Production deployment approval", true);
  add("General", "UAT", "UAT sign-off", true);
  return items.map((i) => ({ ...i, id: newId("chk") }));
}

/** Section 15 — production readiness. */
export function computeReadiness(change: Change, approvals: ApprovalRequest[]): Readiness {
  const done = (cat: ChecklistCategory | "ANY", stage?: ChangeStageKey) => {
    const items = change.checklist.filter((c) => (cat === "ANY" || c.category === cat) && (!stage || c.stageKey === stage));
    if (items.length === 0) return "NONE" as const;
    if (items.some((c) => c.state === "FAILED")) return "FAIL" as const;
    if (items.every((c) => c.state === "DONE" || c.state === "WAIVED")) return "PASS" as const;
    return items.some((c) => c.state === "DONE") ? ("WARN" as const) : ("PENDING" as const);
  };
  const stageDone = (key: ChangeStageKey) => change.stages.find((s) => s.key === key)?.state === "COMPLETED";
  const pendingApproval = approvals.find((a) => a.changeId === change.id && a.status === "PENDING");
  const approved = approvals.some((a) => a.changeId === change.id && a.status === "APPROVED" && a.kind === "DEPLOYMENT");
  const dbAffected = change.impacts.some((i) => i.component === "Database" && i.status !== "NO_CHANGE");

  const checks: ReadinessCheck[] = [
    { key: "code", label: "Code", required: true, state: change.git.pullRequest?.state === "MERGED" ? "PASS" : stageDone("DEVELOPMENT") ? "PASS" : "FAIL", detail: change.git.pullRequest ? `PR #${change.git.pullRequest.number} ${change.git.pullRequest.state.toLowerCase()}` : "No pull request yet" },
    { key: "build", label: "Build", required: true, state: change.git.ciStatus === "PASSED" ? "PASS" : change.git.ciStatus === "FAILED" ? "FAIL" : "PENDING", detail: change.git.ciStatus ? `CI ${change.git.ciStatus.toLowerCase()}` : "CI not run" },
    { key: "tests", label: "Tests", required: true, state: stageDone("TESTING") ? "PASS" : done("ANY", "TESTING") === "FAIL" ? "FAIL" : done("ANY", "TESTING") === "PASS" ? "PASS" : "WARN" },
    { key: "security", label: "Security", required: true, state: done("Security") === "PASS" ? "PASS" : done("Security") === "FAIL" ? "FAIL" : "WARN" },
    { key: "database", label: "Database", required: dbAffected, state: !dbAffected ? "PASS" : done("Database") === "PASS" ? "PASS" : done("Database") === "FAIL" ? "FAIL" : "WARN", detail: dbAffected ? "Migration included" : "No database change" },
    { key: "backup", label: "Backup", required: dbAffected, state: !dbAffected ? "PASS" : change.checklist.find((c) => c.title.startsWith("Backup"))?.state === "DONE" ? "PASS" : "WARN" },
    { key: "rollback", label: "Rollback", required: true, state: change.rollbackPlan.length > 0 && (!dbAffected || change.checklist.find((c) => c.title.startsWith("Rollback script"))?.state === "DONE") ? "PASS" : "WARN", detail: change.rollbackPlan.length ? `${change.rollbackPlan.length} rollback steps` : "No rollback plan" },
    { key: "approval", label: "Approval", required: true, state: approved ? "PASS" : pendingApproval ? "FAIL" : "PENDING", detail: approved ? "Approved" : pendingApproval ? `Waiting: ${pendingApproval.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ")}` : "Not yet requested" },
  ];
  const weights = { PASS: 1, WARN: 0.5, PENDING: 0.25, FAIL: 0 } as const;
  const score = Math.round((checks.reduce((acc, c) => acc + weights[c.state], 0) / checks.length) * 100);
  const deployable = checks.filter((c) => c.required).every((c) => c.state === "PASS");
  return { score, checks, deployable };
}

export function overallProgress(change: Change): number {
  const completed = change.stages.filter((s) => s.state === "COMPLETED" || s.state === "SKIPPED").length;
  const active = change.stages.find((s) => s.state === "ACTIVE" || s.state === "BLOCKED");
  const total = change.stages.length;
  return Math.min(100, Math.round(((completed + (active ? active.progress / 100 : 0)) / total) * 100));
}

export function activeStage(change: Change): ChangeStage | undefined {
  return change.stages.find((s) => s.state === "ACTIVE" || s.state === "BLOCKED") ?? change.stages.find((s) => s.state === "PENDING");
}

/**
 * Section 17 — automatic state transitions. Returns a new Change object with the given stage completed and the next activated.
 */
export function completeStage(change: Change, key: ChangeStageKey, at: string): Change {
  const idx = stageIndex(key);
  const stages = change.stages.map((s) => {
    if (s.key === key) return { ...s, state: "COMPLETED" as const, progress: 100, completedAt: at, startedAt: s.startedAt ?? at };
    if (s.order === idx + 1 && s.state === "PENDING") return { ...s, state: "ACTIVE" as const, startedAt: at };
    return s;
  });
  const next = stages[idx + 1];
  const currentStageKey = next?.key ?? key;
  const allDone = stages.every((s) => s.state === "COMPLETED" || s.state === "SKIPPED");
  return { ...change, stages, currentStageKey, status: allDone ? "COMPLETED" : change.status === "COMPLETED" ? "COMPLETED" : change.status, closedAt: allDone ? at : change.closedAt, updatedAt: at };
}

export function setStageState(change: Change, key: ChangeStageKey, state: ChangeStage["state"], at: string, progress?: number): Change {
  return { ...change, stages: change.stages.map((s) => s.key === key ? { ...s, state, progress: progress ?? s.progress, startedAt: s.startedAt ?? (state === "ACTIVE" ? at : s.startedAt) } : s), updatedAt: at };
}

export function derivedStatus(change: Change, approvals: ApprovalRequest[]): Change["status"] {
  if (change.status === "COMPLETED" || change.status === "CANCELLED" || change.status === "DRAFT") return change.status;
  if (change.blockers.some((b) => !b.resolvedAt)) return "BLOCKED";
  if (approvals.some((a) => a.changeId === change.id && a.status === "PENDING")) return "AWAITING_APPROVAL";
  if (change.currentStageKey === "DEPLOYMENT" && change.stages.find((s) => s.key === "DEPLOYMENT")?.state === "ACTIVE") return "DEPLOYING";
  return "ACTIVE";
}

export function riskForChange(impacts: ChangeImpact[], targetIsProduction: boolean): RiskLevel {
  const affected = impacts.filter((i) => i.status !== "NO_CHANGE").map((i) => i.component);
  if (targetIsProduction && (affected.includes("Database") || affected.includes("Infrastructure"))) return "HIGH";
  if (targetIsProduction) return "HIGH";
  if (affected.includes("Database") || affected.includes("Infrastructure")) return "MEDIUM";
  return affected.length > 2 ? "MEDIUM" : "LOW";
}

/** Section 6 — NEXT ACTION for a change, from the perspective of an actor. */
export function nextActionForChange(change: Change, approvals: ApprovalRequest[], actor: Actor, userNames: Record<string, string>): NextAction {
  const base = { changeId: change.id, changeKey: change.key, risk: change.risk, href: `/changes/${change.id}` };
  const pending = approvals.find((a) => a.changeId === change.id && a.status === "PENDING");
  const blocker = change.blockers.find((b) => !b.resolvedAt);
  const stage = activeStage(change);

  if (change.status === "COMPLETED") return { ...base, severity: "NONE", title: `${change.title} is complete`, description: "Nothing left to do.", actionLabel: "View", safe: true };
  if (pending) {
    const alreadyDecided = pending.slots.some((s) => s.decidedById === actor.userId);
    const canAct = !alreadyDecided && pending.slots.some((s) => s.status === "PENDING" && (s.approver.kind === "ORG_OWNER" ? actor.isOwner || actor.roleKeys.includes("org_owner") : s.approver.kind === "SECURITY_ADMIN" ? actor.roleKeys.includes("security_admin") : s.approver.kind === "ORG_ADMIN" ? actor.isOwner || actor.roleKeys.includes("org_admin") || actor.roleKeys.includes("org_owner") : s.approver.kind === "USER" ? s.approver.id === actor.userId : false));
    const waiting = pending.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ");
    if (canAct && pending.requestedById !== actor.userId) {
      return { ...base, severity: change.risk === "CRITICAL" ? "CRITICAL" : "HIGH", title: `${pending.environmentName ?? "Production"} ${pending.kind === "DATABASE_MIGRATION" ? "migration" : "deployment"} approval required`, description: `${change.title}${change.version ? " " + change.version : ""}`, approvalRequestId: pending.id, environment: pending.environmentName, requestedBy: pending.requestedByName, actionLabel: "Review & Approve", href: `/approvals/${pending.id}`, safe: change.risk === "LOW" || change.risk === "MEDIUM" };
    }
    return { ...base, severity: "MEDIUM", title: `Waiting for approval`, description: `${change.title} — ${pending.title}`, approvalRequestId: pending.id, environment: pending.environmentName, requestedBy: pending.requestedByName, actionLabel: "View Approval", href: `/approvals/${pending.id}`, safe: true, waitingFor: waiting };
  }
  if (blocker) {
    return { ...base, severity: "HIGH", title: blocker.title, description: `${change.title}: ${blocker.reason}`, actionLabel: blocker.approvalRequestId ? "View Approval" : "View Blocker", href: blocker.approvalRequestId ? `/approvals/${blocker.approvalRequestId}` : `/changes/${change.id}`, safe: true, waitingFor: blocker.waitingFor?.label };
  }
  if (!stage) return { ...base, severity: "NONE", title: change.title, description: "No active stage.", actionLabel: "View", safe: true };
  const owner = change.ownerId === actor.userId;
  const map: Partial<Record<ChangeStageKey, { title: string; description: string; label: string }>> = {
    INTENTION: { title: "Confirm the intent", description: "Review the AI-generated plan and confirm the affected components.", label: "Review Plan" },
    REQUIREMENTS: { title: "Confirm requirements", description: "Requirements are drafted. Confirm to create Jira issues.", label: "Confirm Requirements" },
    JIRA: { title: "Create Jira issues", description: "Sync the Epic, Stories and Tasks to Jira.", label: "Sync to Jira" },
    DEVELOPMENT: { title: "Development in progress", description: change.git.branch ? `Branch ${change.git.branch}: ${change.git.commits} commits${change.git.pullRequest ? `, PR #${change.git.pullRequest.number} ${change.git.pullRequest.state.toLowerCase()}` : ""}` : "Create a branch and start committing.", label: change.git.pullRequest?.state === "OPEN" ? "Merge PR" : "Continue" },
    REVIEW: { title: "Code review pending", description: "Review and merge the pull request.", label: "Open Review" },
    TESTING: { title: "Run tests", description: "CI and test checklist must pass before deployment preparation.", label: "Run Tests" },
    DEPLOYMENT_PREPARATION: { title: "Complete deployment preparation", description: `${change.checklist.filter((c) => c.stageKey === "DEPLOYMENT_PREPARATION" && c.state === "PENDING").length} checklist items pending.`, label: "Continue" },
    APPROVAL: { title: "Request deployment approval", description: "Readiness checks passed. Request approval to deploy.", label: "Request Approval" },
    DEPLOYMENT: { title: "Deploy", description: "Approval granted. Deployment is unlocked.", label: "Deploy" },
    LIVE_VALIDATION: { title: "Live validation running", description: "Health checks and smoke tests in progress.", label: "View" },
    UAT: { title: "UAT sign-off required", description: "Users must validate the change in production.", label: "Record UAT" },
    CLOSURE: { title: "Close the change", description: "All stages complete. Record the outcome.", label: "Close Change" },
  };
  const m = map[stage.key]!;
  return { ...base, severity: owner ? "MEDIUM" : "LOW", title: m.title, description: `${change.title} — ${m.description}`, actionLabel: m.label, safe: stage.key !== "DEPLOYMENT" || change.risk === "LOW", waitingFor: owner ? undefined : userNames[change.ownerId] };
}
