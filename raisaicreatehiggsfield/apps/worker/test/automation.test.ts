import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { ScheduleService, nextRunAt } from "../src/services/schedule-service";
import { WorkflowService } from "../src/services/workflow-service";
import { LedgerService } from "../src/services/ledger-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ProjectService } from "../src/services/project-service";
import { workflowDocumentSchema } from "../src/engine/document";
import { runWorkflow } from "../src/engine/execute";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { makeHarness, testContext } from "./helpers/engine-harness";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

beforeAll(() => registerBuiltinNodes());

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Scheduler").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 50000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

function simpleDoc() {
  return workflowDocumentSchema.parse({
    version: 1,
    nodes: [
      { id: "p", type: "prompt", version: 1, config: { template: "scheduled art" }, position: { x: 0, y: 0 } },
      { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 1, y: 0 } },
      { id: "o", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
    ],
    edges: [
      { id: "e1", from: { node: "p", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e2", from: { node: "ai", port: "image" }, to: { node: "o", port: "value" } },
    ],
  });
}

describe("schedule times", () => {
  it("moves to the next hour, day or weekday", () => {
    const from = new Date("2026-03-10T09:30:00Z"); // a Tuesday
    expect(nextRunAt("hourly", 0, undefined, from).toISOString()).toBe("2026-03-10T10:00:00.000Z");
    expect(nextRunAt("daily", 9, undefined, from).toISOString()).toBe("2026-03-11T09:00:00.000Z");
    // Day 5 is Friday.
    expect(nextRunAt("weekly", 9, 5, from).toISOString()).toBe("2026-03-13T09:00:00.000Z");
  });

  it("always lands in the future", () => {
    const from = new Date("2026-03-10T09:00:00Z");
    expect(nextRunAt("daily", 9, undefined, from).getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("schedules", () => {
  async function scheduled() {
    await new ModelSeedService(env).seed();
    const auth = await context();
    const project = await new ProjectService(env).getOrCreateDefault(auth);
    const workflow = await new WorkflowService(env).create(auth, {
      name: "Nightly", projectId: project.id, document: simpleDoc(),
    });
    return { auth, workflowId: workflow.workflow.id };
  }

  it("insists on a spending limit", async () => {
    const { auth, workflowId } = await scheduled();
    await expect(
      new ScheduleService(env).create(auth, { workflowId, name: "No limit", cadence: "daily", maxCostSen: 0 }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("needs a day for a weekly schedule", async () => {
    const { auth, workflowId } = await scheduled();
    await expect(
      new ScheduleService(env).create(auth, { workflowId, name: "Weekly", cadence: "weekly", maxCostSen: 100 }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("runs what is due and advances the next time", async () => {
    const { auth, workflowId } = await scheduled();
    const service = new ScheduleService(env);
    const schedule = await service.create(auth, { workflowId, name: "Nightly", cadence: "daily", maxCostSen: 500 });

    // Pretend its time has come.
    await env.DB.prepare(`UPDATE workflow_schedules SET next_run_at = ? WHERE id = ?`)
      .bind("2020-01-01T00:00:00.000Z", schedule.id).run();

    const result = await service.runDue(new Date(), { provider: new FakeAIProvider() });
    expect(result.fired).toBeGreaterThanOrEqual(1);

    const after = await service.require(auth, schedule.id);
    expect(after.run_count).toBe(1);
    expect(new Date(after.next_run_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("advances the clock even when a run fails, so it cannot fire in a loop", async () => {
    const { auth, workflowId } = await scheduled();
    const service = new ScheduleService(env);
    const schedule = await service.create(auth, { workflowId, name: "Broken", cadence: "hourly", maxCostSen: 100 });

    // Break the workflow so the run throws.
    await env.DB.prepare(`UPDATE workflows SET deleted_at = ? WHERE id = ?`).bind(new Date().toISOString(), workflowId).run();
    await env.DB.prepare(`UPDATE workflow_schedules SET next_run_at = ? WHERE id = ?`)
      .bind("2020-01-01T00:00:00.000Z", schedule.id).run();

    const result = await service.runDue(new Date(), { provider: new FakeAIProvider() });
    expect(result.failed).toBe(1);

    const after = await service.require(auth, schedule.id);
    // Still active, and not due again immediately: one bad run neither disables
    // the schedule nor lets it spin.
    expect(after.active).toBe(1);
    expect(new Date(after.next_run_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("leaves a paused schedule alone", async () => {
    const { auth, workflowId } = await scheduled();
    const service = new ScheduleService(env);
    const schedule = await service.create(auth, { workflowId, name: "Paused", cadence: "hourly", maxCostSen: 100 });
    await service.setActive(auth, schedule.id, false);
    await env.DB.prepare(`UPDATE workflow_schedules SET next_run_at = ? WHERE id = ?`)
      .bind("2020-01-01T00:00:00.000Z", schedule.id).run();

    const result = await service.runDue(new Date(), { provider: new FakeAIProvider() });
    expect(result.fired).toBe(0);
  });
});

describe("MCP tool node", () => {
  function mcpDoc(config: Record<string, unknown>) {
    return workflowDocumentSchema.parse({
      version: 1,
      nodes: [
        { id: "mcp", type: "mcp.tool", version: 1, config, position: { x: 0, y: 0 } },
        { id: "out", type: "output", version: 1, config: { name: "result" }, position: { x: 1, y: 0 } },
      ],
      edges: [{ id: "e1", from: { node: "mcp", port: "result" }, to: { node: "out", port: "value" } }],
    });
  }

  it("calls a tool and returns what it gave back", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    let seen: { url: string; body: unknown } | null = null;

    harness.services.fetch = (async (url: string, init: RequestInit) => {
      seen = { url: String(url), body: JSON.parse(String(init.body)) };
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { structuredContent: { weather: "rain" }, content: [{ type: "text", text: "rain" }] } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await runWorkflow({
      doc: mcpDoc({ serverUrl: "https://tools.example.com/mcp", toolName: "get_weather", arguments: { city: "KL" } }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("completed");
    expect(result.outputs.result).toEqual({ weather: "rain" });
    expect((seen as unknown as { body: { params: { name: string; arguments: unknown } } }).body.params).toMatchObject({
      name: "get_weather", arguments: { city: "KL" },
    });
  });

  it("takes its credential from a connector, never from the document", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    harness.connectors.set("conn1", { url: "https://tools.example.com/mcp", token: "secret-token" });

    let authorization: string | null = null;
    harness.services.fetch = (async (_url: string, init: RequestInit) => {
      authorization = new Headers(init.headers).get("authorization");
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { structuredContent: { ok: true } } }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const doc = mcpDoc({ connectorId: "conn1", toolName: "ping" });
    const result = await runWorkflow({
      doc, variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });

    expect(result.status).toBe("completed");
    expect(authorization).toBe("Bearer secret-token");
    // The token is nowhere in the workflow itself, so sharing it is safe.
    expect(JSON.stringify(doc)).not.toContain("secret-token");
  });

  it("passes the remote server's own refusal through", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    harness.services.fetch = (async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "City not found." } }), {
        status: 200, headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const result = await runWorkflow({
      doc: mcpDoc({ serverUrl: "https://tools.example.com/mcp", toolName: "get_weather" }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("City not found.");
  });

  it("refuses a server address that points inward", async () => {
    const auth = await testContext();
    const harness = await makeHarness();
    const result = await runWorkflow({
      doc: mcpDoc({ serverUrl: "http://169.254.169.254/mcp", toolName: "x" }),
      variables: {}, auth, projectId: "p", workflowRunId: "r", services: harness.services,
    });
    expect(result.status).toBe("failed");
    expect(result.error?.message).toContain("not reachable");
  });
});
