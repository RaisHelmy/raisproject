import { describe, expect, test } from "bun:test";
import { RunForge } from "../src/runforge";
import type { AuthContext } from "@runforge/shared";
import { isTerminalDeploymentStatus } from "@runforge/shared";

function ownerCtx(organizationId: string): AuthContext {
  return {
    actorType: "user", actorId: "usr_owner", organizationId, role: "owner",
    maxLevel: "DANGEROUS", correlationId: "corr_deploy", demo: true,
  };
}

async function waitUntilTerminal(rf: RunForge, ctx: AuthContext, deploymentId: string, maxTicks = 50) {
  // The demo pipeline runs 7 stages at ~2.5s of real wall-clock time each
  // (DEMO_STAGE_MS in @runforge/providers), so this needs a generous budget.
  for (let i = 0; i < maxTicks; i++) {
    await rf.tick();
    const d = await rf.deployments.get(ctx, deploymentId);
    if (isTerminalDeploymentStatus(d.status)) return d;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Deployment never reached a terminal state");
}

describe("DeploymentService end-to-end", () => {
  test("a successful deployment updates the application's current revision and emits a completed event", async () => {
    const rf = new RunForge({ mode: "demo" });
    const org = rf.world!.organizations[0].id;
    const ctx = ownerCtx(org);
    const apps = await rf.applications.list(ctx);
    const app = apps.find((a) => a.name.includes("API") && a.environment === "production")!;

    const deployment = await rf.deployments.deploy(ctx, app.id);
    expect(deployment.status).toBe("queued");

    const final = await waitUntilTerminal(rf, ctx, deployment.id);
    expect(final.status).toBe("completed");

    const updatedApp = await rf.applications.get(ctx, app.id);
    expect(updatedApp.currentVersion).toBe(deployment.version);
    expect(updatedApp.status).toBe("healthy");

    const events = await rf.events.list(ctx, { resourceId: deployment.id });
    expect(events.some((e) => e.action === "deployment.completed")).toBe(true);
  }, 30000);

  test("a simulated failing deployment marks the application degraded and records deployment.failed", async () => {
    const rf = new RunForge({ mode: "demo" });
    const org = rf.world!.organizations[0].id;
    const ctx = ownerCtx(org);
    const apps = await rf.applications.list(ctx);
    const app = apps[0];

    const deployment = await rf.deployments.deploy(ctx, app.id, { simulateFailure: true });
    const final = await waitUntilTerminal(rf, ctx, deployment.id);
    expect(final.status).toBe("failed");

    const updatedApp = await rf.applications.get(ctx, app.id);
    expect(updatedApp.status).toBe("degraded");

    const events = await rf.events.list(ctx, { resourceId: deployment.id });
    expect(events.some((e) => e.action === "deployment.failed")).toBe(true);
  }, 30000);

  test("deploying to production requires DANGEROUS permission — a developer role is forbidden", async () => {
    const rf = new RunForge({ mode: "demo" });
    const org = rf.world!.organizations[0].id;
    const devCtx: AuthContext = { ...ownerCtx(org), role: "developer" };
    const apps = await rf.applications.list(devCtx);
    const prodApp = apps.find((a) => a.environment === "production")!;
    await expect(rf.deployments.deploy(devCtx, prodApp.id)).rejects.toThrow();
  });
});
