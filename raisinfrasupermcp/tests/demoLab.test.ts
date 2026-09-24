import { describe, expect, test } from "bun:test";
import { setup, DEMO } from "./helpers";

describe("Demo Lab showcase", () => {
  test("prepare → policy-produced approval → approve → deploy with self-healing → production healthy", async () => {
    const { app, ahmad, daniel, store } = await setup();
    const prep = await app.demoLab.prepare(daniel, "showcase");
    expect(prep.changeId).toBe(DEMO.changes.claimsRelease);
    expect(prep.taskId).toBeTruthy();
    expect(prep.approvalRequestId).toBeTruthy();
    // the approval bound to the task is the one the Policy Engine created, not the seeded fixture
    const task = (await store.tasks.get(prep.taskId!))!;
    expect(task.approvalRequestId).toBe(prep.approvalRequestId!);
    expect(task.status).toBe("WAITING_APPROVAL");
    const req = (await store.approvals.get(prep.approvalRequestId!))!;
    expect(req.taskId).toBe(task.id);
    expect(req.risk).toBe("HIGH");
    expect(req.requiredApprovals).toBe(1);
    expect(req.slots.map((s) => s.approver.label)).toEqual(["Organization Owner"]);
    // the seeded fixture approval is cancelled so only one is pending
    const pending = (await store.approvals.list({ changeId: DEMO.changes.claimsRelease })).filter((a) => a.status === "PENDING");
    expect(pending.length).toBe(1);
    // execution is blocked before approval — the same guard MCP clients hit
    await expect(app.tasks.execute(daniel, prep.taskId!)).rejects.toThrow(/waiting for approval/);
    const decision = await app.approvals.decide(ahmad, prep.approvalRequestId!, "APPROVED", "Ship it");
    expect(decision.request.status).toBe("APPROVED");
    expect(decision.unlockedTaskId).toBe(prep.taskId!);
    const done = await app.demoLab.execute(daniel, prep.taskId!, { speed: 0 });
    expect(done.status).toBe("COMPLETED");
    expect(done.recoveryCount).toBeGreaterThan(0);
    expect(done.steps.some((s) => s.status === "FAILED")).toBe(true);
    const dep = (await store.deployments.list({ taskId: done.id }))[0];
    expect(dep.status).toBe("HEALTHY");
    expect(dep.health).toBe("HEALTHY");
    const change = (await store.changes.get(DEMO.changes.claimsRelease))!;
    expect(change.currentStageKey).toBe("UAT");
    const app2 = (await store.applications.get(DEMO.apps.claims))!;
    expect(app2.deployedVersions[DEMO.envs.prod]).toBe("v2.8.0");
    const selfHealed = (await store.incidents.list({ taskId: done.id })).filter((i) => i.selfHealed);
    expect(selfHealed.length).toBe(1);
  });

  test("rollback scenario creates an incident and blocks the change", async () => {
    const { app, ahmad, daniel, store } = await setup();
    const prep = await app.demoLab.prepare(daniel, "rollback");
    await app.approvals.decide(ahmad, prep.approvalRequestId!, "APPROVED");
    const done = await app.demoLab.execute(daniel, prep.taskId!, { speed: 0 });
    expect(done.status).toBe("ESCALATED");
    expect(done.rolledBack).toBe(true);
    const inc = (await store.incidents.list({ taskId: done.id }))[0];
    expect(inc.selfHealed).toBe(false);
    expect((await store.changes.get(DEMO.changes.claimsRelease))!.status).toBe("BLOCKED");
  });

  test("demo lab refuses to run outside a demo organization", async () => {
    const { app, store, ahmad } = await setup();
    const org = (await store.organizations.get(DEMO.orgId))!;
    await store.organizations.put({ ...org, demo: false });
    await expect(app.demoLab.prepare(ahmad, "showcase")).rejects.toThrow(/demo organization/i);
  });

  test("capability-scoped policy adds Security approval for database work", async () => {
    const { app, daniel } = await setup();
    const d = await app.policies.simulate(daniel, { taskType: "DATABASE_MIGRATION", environmentId: DEMO.envs.prod, includesDatabaseMigration: true });
    expect(d.approvers.map((a) => a.label).sort()).toEqual(["Organization Owner", "Security Admin"]);
    expect(d.requiredApprovals).toBe(2);
  });
});
