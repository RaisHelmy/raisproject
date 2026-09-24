import { describe, expect, test } from "bun:test";
import { calculateRisk } from "../src/domain/engines/risk";
import { evaluatePolicy, platformDefaultPolicies } from "../src/domain/engines/policy";
import { canTransition, transition } from "../src/domain/engines/taskStateMachine";
import { applyDecision, buildSlots, canActorDecide } from "../src/domain/engines/approval";
import { generateChecklist, initialStages, completeStage, computeReadiness } from "../src/domain/engines/changeLifecycle";
import { redact, containsSecret, redactObject } from "../src/domain/engines/privacy";
import { PLANS, checkLimit, marketplaceSplit, monthlyPrice, estimateRoi, planById } from "../src/domain/billing";
import { DEFAULT_ROLES, permissionsForRoles, can } from "../src/domain/permissions";
import type { Actor, ApprovalRequest, Organization, Policy, TaskStatus } from "../src/domain/types";

const org = (over: Partial<Organization> = {}): Organization => ({ id: "org1", name: "Org", slug: "org", type: "COMPANY", approvalMode: "ROUTED", planId: "team", demo: false, verification: { status: "VERIFIED" }, retention: { aiRequestMetadataDays: 30, mcpTelemetryDays: 90, taskExecutionDays: 365, changeEvidenceDays: 365, auditLogDays: 365 }, createdAt: "", updatedAt: "", ...over });
const policies = platformDefaultPolicies("2026-01-01T00:00:00Z");

describe("risk", () => {
  test("examples from the spec", () => {
    expect(calculateRisk({ taskType: "PACKAGE_INSTALL", environmentKind: "DEVELOPMENT" })).toBe("LOW");
    expect(calculateRisk({ taskType: "RESTART", environmentKind: "DEVELOPMENT" })).toBe("MEDIUM");
    expect(calculateRisk({ taskType: "DEPLOYMENT", environmentKind: "PRODUCTION" })).toBe("HIGH");
    expect(calculateRisk({ taskType: "VM_DELETE", environmentKind: "PRODUCTION" })).toBe("CRITICAL");
  });
});

describe("policy engine", () => {
  test("development is automatic", () => {
    const d = evaluatePolicy({ organization: org(), taskType: "DEPLOYMENT", environmentKind: "DEVELOPMENT" }, policies);
    expect(d.result).toBe("AUTO"); expect(d.requiredApprovals).toBe(0);
  });
  test("production deployment requires 1 approval", () => {
    const d = evaluatePolicy({ organization: org(), taskType: "DEPLOYMENT", environmentKind: "PRODUCTION" }, policies);
    expect(d.result).toBe("WAITING_APPROVAL"); expect(d.requiredApprovals).toBe(1); expect(d.risk).toBe("HIGH");
  });
  test("production migration requires 2 approvals with security + owner", () => {
    const d = evaluatePolicy({ organization: org(), taskType: "DEPLOYMENT", environmentKind: "PRODUCTION", includesDatabaseMigration: true }, policies);
    expect(d.requiredApprovals).toBe(2); expect(d.approvers.map((a) => a.kind).sort()).toEqual(["ORG_OWNER", "SECURITY_ADMIN"]); expect(d.strategy).toBe("ALL");
  });
  test("production deletion requires typed confirmation", () => {
    const d = evaluatePolicy({ organization: org(), taskType: "VM_DELETE", environmentKind: "PRODUCTION" }, policies);
    expect(d.risk).toBe("CRITICAL"); expect(d.typedConfirmation).toBe(true); expect(d.requiredApprovals).toBe(2);
  });
  test("more restrictive organization policy is never bypassed by platform automatic", () => {
    const strict: Policy = { id: "p", organizationId: "org1", scope: "ORGANIZATION", name: "Staging needs approval", enabled: true, version: 1, priority: 1, builtIn: false, updatedAt: "", when: { environmentKinds: ["STAGING"], taskTypes: ["DEPLOYMENT"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 1, approvers: [{ kind: "ORG_ADMIN", label: "Admin" }] } };
    const d = evaluatePolicy({ organization: org(), taskType: "DEPLOYMENT", environmentKind: "STAGING" }, [...policies, strict]);
    expect(d.result).toBe("WAITING_APPROVAL"); expect(d.matchedPolicies.map((p) => p.id)).toContain("p");
  });
  test("deny wins over approval", () => {
    const deny: Policy = { id: "d", organizationId: "org1", scope: "ENVIRONMENT", scopeRef: "env_prod", name: "Freeze", enabled: true, version: 1, priority: 1, builtIn: false, updatedAt: "", when: { environmentKinds: ["PRODUCTION"] }, then: { mode: "DENY" } };
    const d = evaluatePolicy({ organization: org(), taskType: "DEPLOYMENT", environmentKind: "PRODUCTION", environmentId: "env_prod" }, [...policies, deny]);
    expect(d.result).toBe("DENIED");
  });
  test("policies of another organization are ignored", () => {
    const foreign: Policy = { id: "f", organizationId: "other", scope: "ORGANIZATION", name: "Other", enabled: true, version: 1, priority: 1, builtIn: false, updatedAt: "", when: { environmentKinds: ["DEVELOPMENT"] }, then: { mode: "DENY" } };
    expect(evaluatePolicy({ organization: org(), taskType: "DEPLOYMENT", environmentKind: "DEVELOPMENT" }, [...policies, foreign]).result).toBe("AUTO");
  });
  test("personal organization defaults to automatic for medium risk", () => {
    const d = evaluatePolicy({ organization: org({ type: "PERSONAL", approvalMode: "AUTOMATIC" }), taskType: "RESTART", environmentKind: "DEVELOPMENT" }, policies);
    expect(d.result).toBe("AUTO");
  });
});

describe("task state machine", () => {
  test("happy path", () => {
    let s: TaskStatus = "QUEUED";
    for (const next of ["PLANNING", "DISCOVERING", "POLICY_CHECK", "WAITING_APPROVAL", "EXECUTING", "VERIFYING", "COMPLETED"] as const) s = transition(s, next);
    expect(s).toBe("COMPLETED");
  });
  test("failure & recovery path", () => {
    expect(canTransition("EXECUTING", "FAILED")).toBe(true); expect(canTransition("FAILED", "DIAGNOSING")).toBe(true); expect(canTransition("DIAGNOSING", "RECOVERY")).toBe(true);
    expect(canTransition("RECOVERY", "RETRY")).toBe(true); expect(canTransition("RETRY", "VERIFYING")).toBe(true); expect(canTransition("RECOVERY", "ESCALATED")).toBe(true);
  });
  test("cannot skip approval", () => {
    expect(canTransition("WAITING_APPROVAL", "COMPLETED")).toBe(false); expect(canTransition("QUEUED", "EXECUTING")).toBe(false); expect(canTransition("COMPLETED", "EXECUTING")).toBe(false);
    expect(() => transition("COMPLETED", "QUEUED")).toThrow();
  });
});

describe("approval routing", () => {
  const owner: Actor = { userId: "u1", userName: "Owner", organizationId: "org1", membershipId: "m1", roleKeys: ["org_owner"], permissions: [], isOwner: true };
  const sec: Actor = { userId: "u2", userName: "Sec", organizationId: "org1", membershipId: "m2", roleKeys: ["security_admin"], permissions: [], isOwner: false };
  const dev: Actor = { userId: "u3", userName: "Dev", organizationId: "org1", membershipId: "m3", roleKeys: ["developer"], permissions: [], isOwner: false };
  const req = (strategy: ApprovalRequest["strategy"], required = 2): ApprovalRequest => ({ id: "a", organizationId: "org1", key: "APR-1", title: "t", kind: "DEPLOYMENT", risk: "HIGH", requestedById: "u3", requestedByName: "Dev", requiredApprovals: required, strategy, slots: buildSlots({ risk: "HIGH", mode: "REQUIRE_APPROVAL", requiredApprovals: required, approvers: [{ kind: "SECURITY_ADMIN", label: "Sec" }, { kind: "ORG_OWNER", label: "Owner" }], strategy, typedConfirmation: false, matchedPolicies: [], result: "WAITING_APPROVAL", explanation: [] }), status: "PENDING", summary: [], createdAt: "" });
  test("ALL requires every slot", () => {
    let r = applyDecision(req("ALL"), sec, "APPROVED", undefined, "t1");
    expect(r.status).toBe("PENDING");
    r = applyDecision(r, owner, "APPROVED", undefined, "t2");
    expect(r.status).toBe("APPROVED");
  });
  test("ANY is satisfied by one", () => { expect(applyDecision(req("ANY", 1), owner, "APPROVED", undefined, "t").status).toBe("APPROVED"); });
  test("SEQUENTIAL enforces order", () => {
    expect(canActorDecide(req("SEQUENTIAL"), owner)).toBe(false); expect(canActorDecide(req("SEQUENTIAL"), sec)).toBe(true);
  });
  test("developer cannot approve; requester cannot self-approve", () => {
    expect(canActorDecide(req("ANY"), dev)).toBe(false);
    const selfReq = { ...req("ANY"), requestedById: "u2" };
    expect(canActorDecide(selfReq, sec)).toBe(false);
  });
  test("rejection ends the request", () => { expect(applyDecision(req("ALL"), sec, "REJECTED", "no", "t").status).toBe("REJECTED"); });
});

describe("change lifecycle", () => {
  test("checklist derives from impact", () => {
    const list = generateChecklist([{ component: "Database", status: "AFFECTED" }, { component: "Frontend", status: "NO_CHANGE" }], true);
    expect(list.some((i) => i.title === "Backup verified")).toBe(true); expect(list.some((i) => i.title === "Production migration approval")).toBe(true); expect(list.some((i) => i.title === "Browser tests pass")).toBe(false);
  });
  test("completing a stage activates the next", () => {
    const stages = initialStages();
    const c = completeStage({ stages, currentStageKey: "INTENTION", status: "ACTIVE" } as never, "INTENTION", "t");
    expect(c.stages[0].state).toBe("COMPLETED"); expect(c.stages[1].state).toBe("ACTIVE"); expect(c.currentStageKey).toBe("REQUIREMENTS");
  });
  test("readiness blocks deployment without approval", () => {
    const stages = initialStages().map((s) => ({ ...s, state: "COMPLETED" as const }));
    const change = { id: "c", stages, checklist: [], impacts: [], rollbackPlan: ["x"], git: { commits: 3, pullRequest: { number: 1, state: "MERGED" }, ciStatus: "PASSED" } } as never;
    const r = computeReadiness(change, []);
    expect(r.deployable).toBe(false); expect(r.checks.find((c) => c.key === "approval")?.state).toBe("PENDING");
  });
});

describe("privacy filter", () => {
  test("redacts secrets and PII", () => {
    const r = redact("token ghp_abcdefghijklmnopqrstuvwxyz123456 for daniel@abc.example password=SuperSecret123");
    expect(r.containsSecrets).toBe(true); expect(r.containsPii).toBe(true);
    expect(r.text).not.toContain("ghp_abc"); expect(r.text).not.toContain("daniel@abc.example"); expect(r.text).not.toContain("SuperSecret123");
  });
  test("detects connection strings and private keys", () => {
    expect(containsSecret("postgres://user:pw@host/db")).toBe(true);
    expect(containsSecret("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")).toBe(true);
    expect(containsSecret("credential: github-production")).toBe(false);
  });
  test("redactObject removes secret-named keys but keeps credential references", () => {
    const o = redactObject({ apiKey: "sk-live-abcdefghijklmnopqrstuvwxyz", credentialRef: "github-production", nested: { password: "x" } });
    expect(o.apiKey).toBe("[REDACTED]"); expect(o.credentialRef).toBe("github-production"); expect(o.nested.password).toBe("[REDACTED]");
  });
});

describe("billing", () => {
  test("plans are configuration", () => { expect(PLANS.map((p) => p.priceMonthlyMyr)).toEqual([0, 79, 599, 2500, null]); });
  test("limits", () => { expect(checkLimit(planById("free"), "agents", 1).ok).toBe(false); expect(checkLimit(planById("enterprise"), "agents", 9999).ok).toBe(true); });
  test("marketplace split is configurable", () => { expect(marketplaceSplit(99)).toEqual({ publisher: 69.3, platform: 29.7 }); expect(marketplaceSplit(100, 20)).toEqual({ publisher: 80, platform: 20 }); });
  test("yearly = 10 months", () => { expect(monthlyPrice(planById("team"), "YEARLY")).toBe(5990); });
  test("roi is labelled estimate", () => { expect(estimateRoi({ organizationId: "o", period: "p", users: 1, agents: 1, environments: 1, activeChanges: 1, taskExecutions: 1, aiRequests: 1, aiRequestsAvoided: 100, aiCostMyr: 1, automationExecutions: 1 }).isEstimate).toBe(true); });
});

describe("permissions", () => {
  test("viewer cannot deploy, devops can", () => {
    const roles = DEFAULT_ROLES.map((r) => ({ ...r, id: "role_" + r.key }));
    const viewer = { userId: "v", userName: "V", organizationId: "o", membershipId: "m", roleKeys: ["viewer"], permissions: permissionsForRoles(["viewer"], roles), isOwner: false };
    const devops = { ...viewer, roleKeys: ["devops"], permissions: permissionsForRoles(["devops"], roles) };
    expect(can(viewer, "deployment.create")).toBe(false); expect(can(devops, "deployment.create")).toBe(true); expect(can(devops, "security.manage")).toBe(false);
  });
});
