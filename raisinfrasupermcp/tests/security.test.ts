/**
 * Explicit security tests (spec section 140): cross-tenant access, privilege escalation,
 * unauthorized deployment, approval bypass, credential exposure, secret logging, destructive operations.
 */
import { describe, expect, test } from "bun:test";
import { setup, DEMO } from "./helpers";
import { createMemoryStore } from "../src/domain/repository/memory";
import { createSuperMcp, resolveActor, makeContext } from "../src/domain/services";
import { callTool } from "../src/domain/mcp/tools";
import { redactObject } from "../src/domain/engines/privacy";

describe("security", () => {
  test("cross-tenant access via MCP tools is impossible", async () => {
    const { store, app } = await setup();
    const orgB = await app.platform.createOrganization("usr_b2", "Mallory", { name: "Tenant B", type: "COMPANY" });
    await store.users.put({ id: "usr_b2", email: "m@b.example", name: "Mallory", avatarInitials: "M", verification: { status: "NOT_STARTED" }, createdAt: "" });
    const ctx = makeContext(await resolveActor(store, "usr_b2", orgB.id), "AI");
    for (const [tool, args] of [["super.change.get", { changeId: DEMO.changes.claims }], ["super.environment.inspect", { environmentId: DEMO.envs.prod }], ["super.ai.trace", { runId: "air_10482" }]] as const) {
      await expect(callTool(app, ctx, tool, args as Record<string, unknown>, "run")).rejects.toThrow(/not found/i);
    }
    const status = await callTool(app, ctx, "super.change.status", {}, "run");
    expect(status).toEqual([]);
  });

  test("unauthorized deployment: a QA member cannot deploy", async () => {
    const { store, app } = await setup();
    await store.users.put({ id: "usr_qa", email: "qa@abc.example", name: "Qa Tester", avatarInitials: "QT", verification: { status: "NOT_STARTED" }, createdAt: "" });
    await store.memberships.put({ id: "mem_qa", organizationId: DEMO.orgId, userId: "usr_qa", status: "ACTIVE", roleIds: ["role_qa"], groupIds: [], createdAt: "" });
    const qa = makeContext(await resolveActor(store, "usr_qa", DEMO.orgId));
    await expect(app.tasks.create(qa, { definitionId: "deploy-application", inputs: { applicationId: DEMO.apps.claims, environmentId: DEMO.envs.prod, version: "v9" }, environmentId: DEMO.envs.prod })).rejects.toThrow(/deployment.create/);
  });

  test("approval bypass: execution is blocked even for the org owner while pending", async () => {
    const { app, ahmad, daniel } = await setup();
    const { task } = await app.tasks.create(daniel, { definitionId: "deploy-application", inputs: { applicationId: DEMO.apps.claims, environmentId: DEMO.envs.prod, version: "v9" }, environmentId: DEMO.envs.prod, applicationId: DEMO.apps.claims });
    expect(task.status).toBe("WAITING_APPROVAL");
    for (const ctx of [daniel, ahmad]) await expect(app.tasks.execute(ctx, task.id)).rejects.toThrow(/waiting for approval/);
  });

  test("approval bypass via MCP is also blocked", async () => {
    const { store, app } = await setup();
    const ai = makeContext(await resolveActor(store, DEMO.users.daniel, DEMO.orgId), "AI");
    const r = await callTool(app, ai, "super.application.deploy", { applicationSlug: "claims-portal", environment: "PRODUCTION", version: "v2.9.0" }, "run") as { result: string; approvalRequestId?: string };
    expect(r.result).toBe("WAITING_APPROVAL");
    expect(r.approvalRequestId).toBeTruthy();
  });

  test("privilege escalation: a developer cannot grant themselves permissions", async () => {
    const { app, daniel } = await setup();
    await expect(app.platform.saveRole(daniel, { name: "Super", description: "", permissions: ["deployment.create"] })).rejects.toThrow(/role.manage/);
    await expect(app.platform.updateMembership(daniel, "mem_daniel_abc", { roleIds: ["role_org_owner"] })).rejects.toThrow(/role.manage/);
    await expect(app.policies.save(daniel, { name: "allow all", when: {}, then: { mode: "AUTOMATIC" } })).rejects.toThrow(/policy.manage/);
  });

  test("credential exposure: secrets never reach AI, exports or audit", async () => {
    const { store, app, ahmad, sarah } = await setup();
    const creds = await app.platform.credentials(sarah);
    expect(creds.every((c) => !("secret" in c) && !("value" in c) && !("token" in c))).toBe(true);
    // The connection stores a reference only, even when a secret is supplied.
    const conn = await app.platform.createGitConnection(ahmad, { name: "test", provider: "GITHUB", hosting: "CLOUD", authMethod: "PAT", credentialRef: "github-test", tlsVerify: true, secret: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" });
    expect(JSON.stringify(conn)).not.toContain("ghp_");
    expect(conn.credentialRef).toBe("github-test");
    const stored = JSON.stringify(await store.credentials.list());
    expect(stored).not.toContain("ghp_");
    const exported = JSON.stringify(await app.platform.exportMyData(ahmad));
    expect(exported).not.toMatch(/ghp_[A-Za-z0-9]{20}/);
    const learning = JSON.stringify(await app.telemetry.exportLearningData(ahmad));
    expect(learning).not.toMatch(/ghp_[A-Za-z0-9]{20}/);
  });

  test("secret logging: audit detail and telemetry are redacted", async () => {
    const { app, ahmad, store } = await setup();
    const run = await app.telemetry.startRun(ahmad, { purpose: "DEPLOYMENT", client: "Claude", provider: "ANTHROPIC", model: "m", summary: "deploy with token ghp_abcdefghijklmnopqrstuvwxyz01 and pw password=hunter22" });
    const saved = (await store.aiRuns.get(run.id))!;
    expect(JSON.stringify(saved.trace)).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz01");
    expect(JSON.stringify(saved.trace)).not.toContain("hunter22");
    await app.telemetry.recordCall(ahmad, run.id, { toolName: "super.task", durationMs: 10, status: "SUCCESS", inputs: { apiKey: "sk-ant-abcdefghijklmnopqrstuvwx" } });
    const calls = JSON.stringify(await store.mcpCalls.list({ aiRunId: run.id }));
    expect(calls).not.toContain("sk-ant-abcdefghijklmnopqrstuvwx");
    expect(JSON.stringify(redactObject({ password: "x", nested: [{ token: "y" }] }))).not.toContain('"x"');
  });

  test("destructive operations require typed confirmation and 2 approvals in production", async () => {
    const { app, ahmad, sarah, store } = await setup();
    const { task, approvalRequestId } = await app.tasks.create(ahmad, { definitionId: "proxmox-vm-delete", inputs: { vmId: 201 }, environmentId: DEMO.envs.prod, destructive: true });
    expect(task.risk).toBe("CRITICAL");
    expect(task.policyDecision?.typedConfirmation).toBe(true);
    expect(task.policyDecision?.requiredApprovals).toBe(2);
    const req = (await store.approvals.get(approvalRequestId!))!;
    await expect(app.approvals.decide(sarah, approvalRequestId!, "APPROVED", "", "wrong phrase")).rejects.toThrow(/Type/);
    await app.approvals.decide(sarah, approvalRequestId!, "APPROVED", "checked", `APPROVE ${req.key}`);
    await app.approvals.decide(ahmad, approvalRequestId!, "APPROVED", "checked", `APPROVE ${req.key}`);
    expect((await store.approvals.get(approvalRequestId!))!.status).toBe("APPROVED");
  });

  test("policy denial is recorded as an AI failure, not silently swallowed", async () => {
    const { store, app } = await setup();
    await store.policies.put({ id: "pol_freeze", organizationId: DEMO.orgId, scope: "ENVIRONMENT", scopeRef: DEMO.envs.prod, name: "Production freeze", enabled: true, version: 1, priority: 100, builtIn: false, updatedAt: "", when: { environmentKinds: ["PRODUCTION"] }, then: { mode: "DENY" } });
    const ai = makeContext(await resolveActor(store, DEMO.users.daniel, DEMO.orgId), "AI");
    await expect(app.tasks.create(ai, { definitionId: "deploy-application", inputs: { applicationId: DEMO.apps.claims, environmentId: DEMO.envs.prod, version: "v9" }, environmentId: DEMO.envs.prod })).rejects.toThrow(/Policy denied/);
    const denied = await store.auditLogs.list((a) => a.action === "task.denied");
    expect(denied.length).toBe(1);
    expect(denied[0].result).toBe("DENIED");
  });

  test("a fresh store has no data leakage between two new organizations", async () => {
    const store = createMemoryStore();
    const app = createSuperMcp(store);
    const now = new Date().toISOString();
    for (const [uid, name] of [["u1", "One"], ["u2", "Two"]]) await store.users.put({ id: uid, email: `${uid}@x.example`, name, avatarInitials: "X", verification: { status: "NOT_STARTED" }, createdAt: now });
    const o1 = await app.platform.createOrganization("u1", "One", { name: "Org One", type: "COMPANY" });
    const o2 = await app.platform.createOrganization("u2", "Two", { name: "Org Two", type: "COMPANY" });
    const c1 = makeContext(await resolveActor(store, "u1", o1.id));
    const c2 = makeContext(await resolveActor(store, "u2", o2.id));
    const plan = await app.changes.plan(c1, "Add an audit trail to the billing service");
    const change = await app.changes.create(c1, { ...plan.plan, intent: "Add an audit trail to the billing service", aiRunId: plan.aiRunId });
    expect((await app.changes.list(c2)).length).toBe(0);
    await expect(app.changes.get(c2, change.id)).rejects.toThrow(/not found/i);
    expect((await app.platform.auditLogs(c1)).length).toBeGreaterThan(0);
    expect((await app.platform.auditLogs(c2)).every((a) => a.organizationId === o2.id)).toBe(true);
  });
});
