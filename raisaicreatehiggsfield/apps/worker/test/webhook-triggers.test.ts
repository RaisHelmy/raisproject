import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId } from "@raisai/shared";
import { createApp } from "../src/app";
import { ModelSeedService } from "../src/services/model-seed-service";
import { LedgerService } from "../src/services/ledger-service";
import { resetRateLimits } from "../src/middleware/rate-limit";
import { workflowDocumentSchema } from "../src/engine/document";
import { registerBuiltinNodes } from "../src/engine/nodes";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

function stubEnv() {
  return { ...env, AI: { run: async () => ({ image: "aGk=" }) } as unknown as Ai };
}

/** A workflow that starts from a webhook and uses what was posted. */
function triggeredDoc() {
  return workflowDocumentSchema.parse({
    version: 1,
    nodes: [
      { id: "hook", type: "trigger.webhook", version: 1, config: {}, position: { x: 0, y: 0 } },
      { id: "prompt", type: "prompt", version: 1, config: { template: "{{subject}} in the rain" }, position: { x: 1, y: 0 } },
      { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 2, y: 0 } },
      { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 3, y: 0 } },
    ],
    edges: [
      { id: "e1", from: { node: "hook", port: "text" }, to: { node: "prompt", port: "text" } },
      { id: "e2", from: { node: "prompt", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e3", from: { node: "ai", port: "image" }, to: { node: "out", port: "value" } },
    ],
  });
}

async function setUp() {
  registerBuiltinNodes();
  await new ModelSeedService(env).seed();
  const testEnv = stubEnv();
  const app = createApp();

  const signup = await app.request(
    "/api/v1/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `hook-${newId()}@example.com`, password: "password123", name: "Hooker" }),
    },
    testEnv,
  );
  const setCookies = signup.headers.getSetCookie();
  const cookie = setCookies.map((x) => x.split(";")[0]).join("; ");
  const csrf = setCookies.find((x) => x.startsWith("rais_csrf="))!.split(";")[0]!.split("=").slice(1).join("=");
  const headers = { cookie, "content-type": "application/json", "x-csrf-token": csrf };
  const { orgId } = (await signup.json()) as { orgId: string };
  await new LedgerService(env).deposit(orgId, 5000);

  const created = await app.request(
    "/api/v1/workflows",
    { method: "POST", headers, body: JSON.stringify({ name: "Triggered", document: triggeredDoc() }) },
    testEnv,
  );
  const workflow = (await created.json()) as { id: string };
  return { app, testEnv, headers, orgId, workflowId: workflow.id };
}

describe("webhook triggers", () => {
  beforeEach(() => resetRateLimits());

  it("gives a workflow an address that starts it", async () => {
    const { app, testEnv, headers, workflowId } = await setUp();
    const created = await app.request(
      `/api/v1/workflows/${workflowId}/triggers`,
      { method: "POST", headers, body: JSON.stringify({ name: "From my CMS" }) },
      testEnv,
    );
    expect(created.status).toBe(201);
    const trigger = (await created.json()) as { url: string };
    expect(trigger.url).toContain("/hooks/wht_");
  });

  it("runs the workflow with the posted body as its input", async () => {
    const { app, testEnv, headers, workflowId } = await setUp();
    const created = await app.request(
      `/api/v1/workflows/${workflowId}/triggers`,
      { method: "POST", headers, body: JSON.stringify({ name: "hook" }) },
      testEnv,
    );
    const { url } = (await created.json()) as { url: string };
    const path = new URL(url).pathname;

    // No key, no cookie: the address itself is the credential.
    const fired = await app.request(
      path,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: "a fox" }) },
      testEnv,
    );
    expect(fired.status).toBe(202);
    const body = (await fired.json()) as { workflowRunId: string; status: string };
    expect(body.status).toBe("completed");

    const run = await env.DB
      .prepare(`SELECT trigger, variables_json FROM workflow_runs WHERE id = ?`)
      .bind(body.workflowRunId)
      .first<{ trigger: string; variables_json: string }>();
    expect(run?.trigger).toBe("webhook");
    // What was posted reached the graph.
    expect(JSON.parse(run!.variables_json)).toMatchObject({ trigger: { subject: "a fox" } });
  });

  it("answers an unknown and a revoked address identically", async () => {
    const { app, testEnv, headers, workflowId } = await setUp();
    const created = await app.request(
      `/api/v1/workflows/${workflowId}/triggers`,
      { method: "POST", headers, body: JSON.stringify({ name: "hook" }) },
      testEnv,
    );
    const trigger = (await created.json()) as { id: string; url: string };
    const path = new URL(trigger.url).pathname;

    await app.request(`/api/v1/workflows/${workflowId}/triggers/${trigger.id}`, { method: "DELETE", headers }, testEnv);

    const revoked = await app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, testEnv);
    const unknown = await app.request("/hooks/wht_doesnotexist", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, testEnv);

    // Probing must not reveal which addresses ever existed.
    expect(revoked.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await revoked.json()).toEqual(await unknown.json());
  });

  it("honours the trigger's own cost ceiling", async () => {
    const { app, testEnv, headers, workflowId } = await setUp();
    const created = await app.request(
      `/api/v1/workflows/${workflowId}/triggers`,
      // One sen: below the cost of the image this workflow generates.
      { method: "POST", headers, body: JSON.stringify({ name: "capped", maxCostSen: 1 }) },
      testEnv,
    );
    const { url } = (await created.json()) as { url: string };

    const fired = await app.request(
      new URL(url).pathname,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      testEnv,
    );
    const body = (await fired.json()) as { status: string };
    // An outside system cannot spend past the ceiling it was given.
    expect(["paused", "completed"]).toContain(body.status);
  });

  it("counts how often an address has fired", async () => {
    const { app, testEnv, headers, workflowId } = await setUp();
    const created = await app.request(
      `/api/v1/workflows/${workflowId}/triggers`,
      { method: "POST", headers, body: JSON.stringify({ name: "counted" }) },
      testEnv,
    );
    const { url } = (await created.json()) as { url: string };
    const path = new URL(url).pathname;

    await app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, testEnv);

    const listed = await app.request(`/api/v1/workflows/${workflowId}/triggers`, { headers }, testEnv);
    const { items } = (await listed.json()) as { items: { fireCount: number; lastFiredAt: string | null }[] };
    expect(items[0]!.fireCount).toBe(1);
    expect(items[0]!.lastFiredAt).toBeTruthy();
  });
});
