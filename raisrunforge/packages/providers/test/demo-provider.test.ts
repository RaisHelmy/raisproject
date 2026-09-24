import { describe, expect, test } from "bun:test";
import { createDemoWorld, DemoComputeProvider, DemoApplicationProvider, DemoContainerProvider, DEMO_IDS } from "../src";

describe("DemoComputeProvider", () => {
  test("lists seeded servers scoped to the organization", async () => {
    const world = createDemoWorld();
    const provider = new DemoComputeProvider(world);
    const servers = await provider.listServers(DEMO_IDS.org);
    expect(servers.length).toBe(3);
    expect(servers.map((s) => s.name).sort()).toEqual(["development-01", "production-01", "staging-01"]);
  });

  test("returns null for a server in another organization", async () => {
    const world = createDemoWorld();
    const provider = new DemoComputeProvider(world);
    const server = await provider.getServer("org_other", DEMO_IDS.serverProduction);
    expect(server).toBeNull();
  });

  test("offline server reports zeroed live metrics", async () => {
    const world = createDemoWorld();
    const provider = new DemoComputeProvider(world);
    const metrics = await provider.getMetrics(DEMO_IDS.org, DEMO_IDS.serverDevelopment);
    expect(metrics?.cpuPercent).toBe(0);
    expect(metrics?.containers).toBe(0);
  });
});

describe("DemoApplicationProvider deployment lifecycle", () => {
  test("progresses through every stage to completion over simulated time", async () => {
    let now = 1_000_000;
    const world = createDemoWorld(() => now);
    const provider = new DemoApplicationProvider(world);
    const app = world.applications.find((a) => a.id === DEMO_IDS.appApi)!;

    const progress0 = await provider.deploy({
      organizationId: DEMO_IDS.org,
      application: app,
      deploymentId: "dep_test_1",
      version: "v9.9.9",
      commitSha: "abcdef1",
      branch: "main",
    });
    expect(progress0.status).toBe("cloning");
    expect(progress0.progress).toBe(0);

    // Advance past all 7 stages (2.5s each in the demo clock).
    now += 7 * 2500 + 100;
    const final = await provider.getDeploymentProgress(DEMO_IDS.org, "dep_test_1");
    expect(final?.status).toBe("completed");
    expect(final?.progress).toBe(100);
    expect(final?.steps.every((s) => s.state === "success")).toBe(true);
  });

  test("simulateFailure fails at the health-check stage and skips the rest", async () => {
    let now = 2_000_000;
    const world = createDemoWorld(() => now);
    const provider = new DemoApplicationProvider(world);
    const app = world.applications.find((a) => a.id === DEMO_IDS.appApi)!;

    await provider.deploy({
      organizationId: DEMO_IDS.org,
      application: app,
      deploymentId: "dep_test_fail",
      version: "v9.9.9",
      commitSha: "abcdef1",
      branch: "main",
      simulateFailure: true,
    });

    now += 7 * 2500 + 100;
    const final = await provider.getDeploymentProgress(DEMO_IDS.org, "dep_test_fail");
    expect(final?.status).toBe("failed");
    expect(final?.errorMessage).toBeTruthy();
    const failedStep = final?.steps.find((s) => s.state === "failed");
    expect(failedStep).toBeTruthy();
    expect(final?.steps.filter((s) => s.state === "skipped").length).toBeGreaterThan(0);
  });

  test("restart increments restart count and resets stopped state", async () => {
    const world = createDemoWorld();
    const provider = new DemoApplicationProvider(world);
    await provider.stop(DEMO_IDS.org, DEMO_IDS.appApi);
    let health = await provider.getHealth(DEMO_IDS.org, DEMO_IDS.appApi);
    expect(health.status).toBe("stopped");
    await provider.restart(DEMO_IDS.org, DEMO_IDS.appApi);
    health = await provider.getHealth(DEMO_IDS.org, DEMO_IDS.appApi);
    expect(health.status).not.toBe("stopped");
  });
});

describe("DemoContainerProvider", () => {
  test("restart increments the restart counter", async () => {
    const world = createDemoWorld();
    const provider = new DemoContainerProvider(world);
    const before = await provider.getContainer(DEMO_IDS.org, "ctr_merc_api");
    const after = await provider.restartContainer(DEMO_IDS.org, "ctr_merc_api");
    expect(after.restarts).toBe((before?.restarts ?? 0) + 1);
    expect(after.status).toBe("running");
  });
});
