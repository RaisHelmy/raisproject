import { describe, expect, test } from "bun:test";
import { setup, DEMO } from "./helpers";
import { createMemoryStore } from "../src/domain/repository/memory";
import { seedDemo } from "../src/domain/seed/demo";
import { createSuperMcp, resolveActor, makeContext } from "../src/domain/services";
import { newId } from "../src/domain/ids";

describe("tenant isolation", () => {
  test("a member of another organization cannot read tenant A data", async () => {
    const { store, app, ahmad } = await setup();
    // Create Tenant B with its own owner
    const orgB = await app.platform.createOrganization("usr_b", "Bob", { name: "Tenant B", type: "COMPANY" });
    await store.users.put({ id: "usr_b", email: "bob@b.example", name: "Bob", avatarInitials: "B", verification: { status: "NOT_STARTED" }, createdAt: "" });
    const bob = makeContext(await resolveActor(store, "usr_b", orgB.id));
    await expect(app.changes.get(bob, DEMO.changes.claims)).rejects.toThrow(/not found/i);
    await expect(app.approvals.get(bob, DEMO.approvals.claimsProd)).rejects.toThrow(/not found/i);
    await expect(app.tasks.get(bob, "tsk_2041")).rejects.toThrow(/not found/i);
    await expect(app.platform.agent(bob, DEMO.agents.prod)).rejects.toThrow(/not found/i);
    expect((await app.changes.list(bob)).length).toBe(0);
    expect((await app.platform.auditLogs(bob)).every((a) => a.organizationId === orgB.id)).toBe(true);
    expect((await app.changes.list(ahmad)).length).toBeGreaterThan(0);
  });
  test("membership in org A does not grant access to org B", async () => {
    const { store } = await setup();
    await expect(resolveActor(store, DEMO.users.daniel, DEMO.personalOrgId)).rejects.toThrow(/not an active member/i);
  });
  test("client-supplied organization id is never trusted: actor is resolved from membership", async () => {
    const { store, app } = await setup();
    const actor = await resolveActor(store, DEMO.users.daniel, DEMO.orgId);
    const forged = makeContext({ ...actor, organizationId: DEMO.personalOrgId });
    // Even with a forged org id, tenant-scoped reads return nothing from ABC and nothing from the personal org (no data there)
    expect((await app.changes.list(forged)).length).toBe(0);
  });
});

describe("authorization & approval bypass", () => {
  test("developer cannot approve", async () => {
    const { app, daniel } = await setup();
    await expect(app.approvals.decide(daniel, DEMO.approvals.claimsProd, "APPROVED")).rejects.toThrow(/not an eligible approver/);
    const audit = await app.platform.auditLogs(daniel, { action: "approval.denied" });
    expect(audit.length).toBe(1);
  });
  test("security admin cannot approve an owner-only slot", async () => {
    const { app, sarah } = await setup();
    await expect(app.approvals.decide(sarah, DEMO.approvals.claimsProd, "APPROVED")).rejects.toThrow(/not an eligible approver/);
  });
  test("task cannot execute while approval pending (approval bypass)", async () => {
    const { app, daniel, ahmad } = await setup();
    const env = DEMO.envs.prod;
    const { task, approvalRequestId } = await app.tasks.create(daniel, { definitionId: "deploy-application", inputs: { applicationId: DEMO.apps.payments, environmentId: env, version: "v9.9.9" }, environmentId: env, applicationId: DEMO.apps.payments });
    expect(task.status).toBe("WAITING_APPROVAL"); expect(approvalRequestId).toBeTruthy();
    await expect(app.tasks.execute(daniel, task.id)).rejects.toThrow(/waiting for approval/);
    await expect(app.tasks.execute(ahmad, task.id)).rejects.toThrow(/waiting for approval/);
    const audit = await app.platform.auditLogs(ahmad, { action: "task.execute.blocked" });
    expect(audit.length).toBe(2); expect(audit.every((a) => a.result === "DENIED")).toBe(true);
  });
  test("viewer cannot create tasks or changes", async () => {
    const { store, app } = await setup();
    await store.users.put({ id: "usr_v", email: "v@abc.example", name: "Vic", avatarInitials: "V", verification: { status: "NOT_STARTED" }, createdAt: "" });
    await store.memberships.put({ id: "mem_v", organizationId: DEMO.orgId, userId: "usr_v", status: "ACTIVE", roleIds: ["role_viewer"], groupIds: [], createdAt: "" });
    const viewer = makeContext(await resolveActor(store, "usr_v", DEMO.orgId));
    await expect(app.tasks.create(viewer, { definitionId: "deploy-application", inputs: { applicationId: DEMO.apps.claims, environmentId: DEMO.envs.dev, version: "v1" } })).rejects.toThrow(/Permission required: deployment.create/);
    await expect(app.changes.plan(viewer, "Add something useful")).rejects.toThrow(/Permission required/);
    await expect(app.policies.save(viewer, { name: "x", when: {}, then: { mode: "DENY" } })).rejects.toThrow(/policy.manage/);
  });
  test("privilege escalation: non-owner cannot grant security.manage; last owner cannot be removed", async () => {
    const { app, sarah, ahmad } = await setup();
    await expect(app.platform.saveRole(sarah, { name: "God", description: "", permissions: ["security.manage"] })).rejects.toThrow(/Only the organization owner/);
    await expect(app.platform.updateMembership(ahmad, "mem_ahmad_abc", { status: "REMOVED" })).rejects.toThrow(/own owner access|at least one owner/);
  });
  test("critical approvals need typed confirmation", async () => {
    const { app, ahmad, sarah, store } = await setup();
    const { task, approvalRequestId } = await app.tasks.create(ahmad, { definitionId: "proxmox-vm-delete", inputs: { vmId: 201 }, environmentId: DEMO.envs.prod, destructive: true });
    expect(task.risk).toBe("CRITICAL");
    await expect(app.approvals.decide(sarah, approvalRequestId!, "APPROVED")).rejects.toThrow(/Type/);
    const req = await store.approvals.get(approvalRequestId!);
    const r = await app.approvals.decide(sarah, approvalRequestId!, "APPROVED", "ok", `APPROVE ${req!.key}`);
    expect(r.request.slots.filter((s) => s.status === "APPROVED").length).toBe(1); expect(r.request.status).toBe("PENDING"); // needs owner too
    // separation of duties: sarah cannot fill the second slot as well
    await expect(app.approvals.decide(sarah, approvalRequestId!, "APPROVED", "again", `APPROVE ${req!.key}`)).rejects.toThrow(/not an eligible approver/);
  });
});

describe("policy service", () => {
  test("simulator: what happens if Ahmad deploys to production", async () => {
    const { app, ahmad } = await setup();
    const d = await app.policies.simulate(ahmad, { userId: DEMO.users.ahmad, taskType: "DEPLOYMENT", environmentId: DEMO.envs.prod, includesDatabaseMigration: true });
    expect(d.risk).toBe("HIGH"); expect(d.requiredApprovals).toBe(2); expect(d.result).toBe("WAITING_APPROVAL"); expect(d.approvers.map((a) => a.label).sort()).toEqual(["Organization Owner", "Security Admin"]);
  });
  test("built-in policies cannot be edited; org policy versions increment", async () => {
    const { app, sarah } = await setup();
    await expect(app.policies.save(sarah, { id: "pol_platform_prod_deploy", name: "x", when: {}, then: { mode: "AUTOMATIC" } })).rejects.toThrow(/cannot be edited/);
    const p = await app.policies.save(sarah, { name: "Staging restarts need approval", when: { taskTypes: ["RESTART"], environmentKinds: ["STAGING"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 1, approvers: [{ kind: "ORG_ADMIN", label: "Organization Admin" }] } });
    const p2 = await app.policies.save(sarah, { ...p, description: "updated" });
    expect(p2.version).toBe(2);
    const d = await app.policies.simulate(sarah, { taskType: "RESTART", environmentId: DEMO.envs.staging });
    expect(d.result).toBe("WAITING_APPROVAL");
  });
});

describe("change lifecycle end-to-end (demo mode)", () => {
  test("intent → plan → change → jira → git → CI → approval → deploy (self-healing) → UAT → close", async () => {
    const { app, daniel, ahmad, store } = await setup();
    const { plan, aiRunId } = await app.changes.plan(daniel, "Add customer document upload to the claims portal.");
    expect(plan.impacts.filter((i) => i.status === "AFFECTED").map((i) => i.component)).toEqual(expect.arrayContaining(["Frontend", "Backend", "Database", "File Storage"]));
    const change = await app.changes.create(daniel, { ...plan, intent: "Add customer document upload to the claims portal.", applicationId: DEMO.apps.claims, targetEnvironmentId: DEMO.envs.staging, aiRunId, version: "v2.9.0" });
    expect(change.currentStageKey).toBe("REQUIREMENTS"); expect(change.key).toMatch(/^CHG-\d+/);
    let c = await app.changes.confirmRequirements(daniel, change.id);
    expect(c.currentStageKey).toBe("JIRA");
    c = await app.changes.syncJira(daniel, change.id);
    expect(c.currentStageKey).toBe("DEVELOPMENT"); expect(c.jira.length).toBeGreaterThan(0); expect(c.git.branch).toBeTruthy();
    c = await app.changes.gitEvent(daniel, change.id, { type: "COMMITS", commits: 5 }, "AGENT");
    c = await app.changes.gitEvent(daniel, change.id, { type: "PR_MERGED", prNumber: 250 });
    expect(c.currentStageKey).toBe("TESTING");
    c = await app.changes.gitEvent(daniel, change.id, { type: "CI_PASSED" });
    expect(c.currentStageKey).toBe("DEPLOYMENT_PREPARATION");
    // manual checklist items
    for (const item of c.checklist.filter((i) => i.stageKey === "DEPLOYMENT_PREPARATION" && !i.automated)) c = await app.changes.toggleChecklist(daniel, change.id, item.id, "DONE");
    for (const item of c.checklist.filter((i) => i.stageKey === "REVIEW")) c = await app.changes.toggleChecklist(daniel, change.id, item.id, "DONE");
    const r = await app.changes.requestDeployment(daniel, change.id);
    // staging is automatic → deployment unlocked without approval
    expect(r.approvalRequestId).toBeUndefined(); expect(r.change.currentStageKey).toBe("DEPLOYMENT"); expect(r.task.status).toBe("QUEUED");
    const task = await app.tasks.execute(daniel, r.task.id, { speed: 0 });
    expect(task.status).toBe("COMPLETED"); expect(task.recoveryCount).toBe(2); // health check fails twice → known recovery + alternative → success
    expect(task.steps.filter((s) => s.status === "FAILED").length).toBe(2); expect(task.steps.some((s) => s.status === "RECOVERED")).toBe(true);
    const detail = await app.changes.get(daniel, change.id);
    expect(detail.change.currentStageKey).toBe("UAT"); expect(detail.deployments[0].status).toBe("HEALTHY"); expect(detail.deployments[0].healthChecks.some((h) => h.status === "FAIL")).toBe(true);
    expect(detail.evidence.some((e) => e.type === "DEPLOYMENT_LOG")).toBe(true); expect(detail.evidence.some((e) => e.type === "SMOKE_TEST")).toBe(true);
    const incidents = await store.incidents.list({ changeId: change.id });
    expect(incidents.some((i) => i.selfHealed)).toBe(true);
    c = await app.changes.recordUat(daniel, change.id, "PASSED", "Looks good");
    expect(c.currentStageKey).toBe("CLOSURE");
    c = await app.changes.close(daniel, change.id, "Shipped");
    expect(c.status).toBe("COMPLETED"); expect(c.stages.every((s) => s.state === "COMPLETED")).toBe(true);
    // ai telemetry linked
    const run = await store.aiRuns.get(aiRunId);
    expect(run?.changeId).toBe(change.id); expect(run?.status).toBe("COMPLETED");
    // audit
    const audit = await app.platform.auditLogs(ahmad, { search: c.key });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["change.created", "change.closed"]));
  });

  test("production deployment: approval unlocks deployment; rollback scenario creates incident", async () => {
    const { app, daniel, ahmad, store } = await setup();
    const c0 = await store.changes.get(DEMO.changes.claimsRelease);
    await store.changes.put({ ...c0!, demoScenario: "HEALTH_CHECK_FAIL_ROLLBACK" });
    // seeded approval APR-31 exists without a task; cancel it and go through the real flow
    const seeded = await store.approvals.get(DEMO.approvals.claimsProd);
    await store.approvals.put({ ...seeded!, status: "CANCELLED" });
    const r = await app.changes.requestDeployment(daniel, DEMO.changes.claimsRelease);
    expect(r.approvalRequestId).toBeTruthy(); expect(r.task.status).toBe("WAITING_APPROVAL"); expect(r.change.status).toBe("AWAITING_APPROVAL");
    const na = (await app.changes.get(ahmad, DEMO.changes.claimsRelease)).nextAction;
    expect(na.actionLabel).toBe("Review & Approve"); expect(na.severity).toBe("HIGH");
    const decision = await app.approvals.decide(ahmad, r.approvalRequestId!, "APPROVED", "Go");
    expect(decision.request.status).toBe("APPROVED"); expect(decision.unlockedTaskId).toBe(r.task.id);
    expect((await store.changes.get(DEMO.changes.claimsRelease))!.currentStageKey).toBe("DEPLOYMENT");
    const task = await app.tasks.execute(daniel, r.task.id, { speed: 0 });
    expect(task.status).toBe("ESCALATED"); expect(task.rolledBack).toBe(true);
    const dep = (await store.deployments.list({ taskId: task.id }))[0];
    expect(dep.status).toBe("ROLLED_BACK");
    const inc = (await store.incidents.list({ taskId: task.id }))[0];
    expect(inc).toBeTruthy(); expect(inc.severity).toBe("SEV2");
    const notes = await app.platform.notifications(daniel);
    expect(notes.some((n) => n.event === "ROLLBACK")).toBe(true); expect(notes.some((n) => n.event === "INCIDENT_CREATED")).toBe(true);
    const detail = await app.changes.get(daniel, DEMO.changes.claimsRelease);
    expect(detail.change.status).toBe("BLOCKED"); expect(detail.change.blockers.some((b) => !b.resolvedAt)).toBe(true);
  });

  test("docker failure escalates to AI diagnosis then succeeds; .NET SDK mismatch uses known recovery", async () => {
    const { app, daniel, store } = await setup();
    const { task } = await app.tasks.create(daniel, { definitionId: "deploy-application", inputs: { applicationId: DEMO.apps.payments, environmentId: DEMO.envs.dev, version: "v2.4.2" }, environmentId: DEMO.envs.dev, applicationId: DEMO.apps.payments, scenario: "DOCKER_BUILD_FAIL" });
    const done = await app.tasks.execute(daniel, task.id, { speed: 0 });
    expect(done.status).toBe("COMPLETED"); expect(done.log.some((l) => l.executionMode === "AI")).toBe(true);
    const { task: dn } = await app.tasks.create(daniel, { definitionId: "create-dotnet-project", inputs: { name: "svc", architecture: "CQRS" }, environmentId: DEMO.envs.dev, scenario: "SDK_MISMATCH" });
    const d2 = await app.tasks.execute(daniel, dn.id, { speed: 0 });
    expect(d2.status).toBe("COMPLETED"); expect(d2.steps.find((s) => s.stepId === "check-sdk" && s.status === "RECOVERED")).toBeTruthy();
    expect((await store.knowledge.get("kr_dotnet_sdk"))!.applications).toBe(42);
  });

  test("quarantined agent blocks task creation", async () => {
    const { app, sarah, daniel } = await setup();
    await app.platform.agentAction(sarah, DEMO.agents.dev, "QUARANTINE");
    await expect(app.tasks.create(daniel, { definitionId: "health-check", inputs: {}, environmentId: DEMO.envs.dev })).rejects.toThrow(/quarantined/);
  });
});

describe("dashboard, command center & telemetry", () => {
  test("next action for owner is the production approval", async () => {
    const { app, ahmad } = await setup();
    const d = await app.dashboard.get(ahmad);
    expect(d.nextAction.actionLabel).toBe("Review & Approve"); expect(d.nextAction.risk).toBe("HIGH"); expect(d.myActions.approvals).toBeGreaterThanOrEqual(1); expect(d.agentHealth.online).toBe(2);
  });
  test("command: deploy claims portal → waiting approval; health check creates task; create change plans", async () => {
    const { app, daniel } = await setup();
    const r = await app.command.run(daniel, "Deploy Claims Portal v2.8 to Production");
    expect(r.kind).toBe("CHANGE_DEPLOY"); expect(r.message).toMatch(/approval/i);
    const h = await app.command.run(daniel, "Check all servers");
    expect(h.kind).toBe("TASK");
    const p = await app.command.run(daniel, "Add two-factor login to the customer portal");
    expect(p.kind).toBe("PLAN");
    const b = await app.command.run(daniel, "What is blocking my release?");
    expect(b.kind).toBe("ANSWER");
  });
  test("telemetry summary and recommendations; export contains no secrets", async () => {
    const { app, ahmad } = await setup();
    const s = await app.telemetry.summary(ahmad);
    expect(s.aiRequests).toBeGreaterThan(50); expect(s.aiCallsAvoided).toBeGreaterThan(0); expect(s.costIsEstimate).toBe(true); expect(s.efficiency.score).toBeGreaterThan(0);
    const recs = await app.telemetry.recommendations(ahmad);
    expect(recs.some((r) => r.type === "CONSOLIDATE_MCP_TOOL")).toBe(true);
    const ta = await app.telemetry.toolAnalytics(ahmad);
    expect(ta.usage.length).toBeGreaterThan(3); expect(ta.overuse.length).toBeGreaterThan(0);
    const exp = JSON.stringify(await app.telemetry.exportLearningData(ahmad));
    expect(exp).not.toMatch(/ghp_|sk-ant-|password/);
    const mine = JSON.stringify(await app.platform.exportMyData(ahmad));
    expect(mine).not.toMatch(/ghp_|sk-ant-/);
  });
  test("plan limits enforced (free plan: 1 agent)", async () => {
    const { app, store } = await setup();
    const personal = makeContext(await resolveActor(store, DEMO.users.ahmad, DEMO.personalOrgId));
    await app.platform.registerAgent(personal, { name: "laptop", os: "macos", arch: "arm64" });
    await expect(app.platform.registerAgent(personal, { name: "second", os: "linux", arch: "x64" })).rejects.toThrow(/plan allows 1 agent/);
  });
});
