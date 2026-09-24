import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId } from "@raisai/shared";
import { createApp } from "../src/app";
import { ModelSeedService } from "../src/services/model-seed-service";
import { LedgerService } from "../src/services/ledger-service";
import { WorkflowService } from "../src/services/workflow-service";
import { resetRateLimits } from "../src/middleware/rate-limit";
import { workflowDocumentSchema } from "../src/engine/document";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { testContext } from "./helpers/engine-harness";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

function validDoc(prompt = "a street") {
  return workflowDocumentSchema.parse({
    version: 1,
    nodes: [
      { id: "p", type: "prompt", version: 1, config: { template: prompt }, position: { x: 0, y: 0 } },
      { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 200, y: 0 } },
      { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 400, y: 0 } },
    ],
    edges: [
      { id: "e1", from: { node: "p", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e2", from: { node: "ai", port: "image" }, to: { node: "out", port: "value" } },
    ],
  });
}

async function session() {
  const app = createApp();
  const res = await app.request(
    "/api/v1/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `wf-${newId()}@example.com`, password: "password123", name: "WF" }),
    },
    env,
  );
  const setCookies = res.headers.getSetCookie();
  const cookie = setCookies.map((x) => x.split(";")[0]).join("; ");
  const csrf = setCookies.find((x) => x.startsWith("rais_csrf="))!.split(";")[0]!.split("=").slice(1).join("=");
  const body = (await res.json()) as { orgId: string };
  return { app, cookie, csrf, orgId: body.orgId, headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf } };
}

describe("workflow API", () => {
  beforeEach(() => {
    resetRateLimits();
    registerBuiltinNodes();
  });

  it("serves the node palette with beginner nodes flagged", async () => {
    const { app, cookie } = await session();
    const res = await app.request("/api/v1/nodes", { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { type: string; beginner: boolean; inputs: unknown[] }[] };

    const types = body.items.map((i) => i.type);
    expect(types).toContain("ai.model");
    expect(types).toContain("http");
    // The short palette is what a beginner sees first (§78).
    expect(body.items.filter((i) => i.beginner).length).toBeGreaterThan(0);
    expect(body.items.filter((i) => i.beginner).length).toBeLessThan(body.items.length);
  });

  it("creates, autosaves and reloads a workflow", async () => {
    const { app, headers, cookie } = await session();
    const created = await app.request(
      "/api/v1/workflows",
      { method: "POST", headers, body: JSON.stringify({ name: "My first graph" }) },
      env,
    );
    expect(created.status).toBe(201);
    const workflow = (await created.json()) as { id: string };

    const saved = await app.request(
      `/api/v1/workflows/${workflow.id}`,
      { method: "PATCH", headers, body: JSON.stringify({ document: validDoc("autosaved prompt") }) },
      env,
    );
    expect(saved.status).toBe(200);

    const reloaded = await app.request(`/api/v1/workflows/${workflow.id}`, { headers: { cookie } }, env);
    const body = (await reloaded.json()) as { document: { nodes: { config: { template?: string } }[] }; hasUnsavedChanges: boolean };
    expect(body.document.nodes[0]!.config.template).toBe("autosaved prompt");
    expect(body.hasUnsavedChanges).toBe(true); // never frozen into a version yet
  });

  it("previews cost and reports validation problems without charging", async () => {
    await new ModelSeedService(env).seed();
    const { app, headers } = await session();
    const created = await app.request(
      "/api/v1/workflows",
      { method: "POST", headers, body: JSON.stringify({ name: "Preview", document: validDoc() }) },
      env,
    );
    const workflow = (await created.json()) as { id: string };

    const preview = await app.request(`/api/v1/workflows/${workflow.id}/preview`, { method: "POST", headers, body: "{}" }, env);
    const body = (await preview.json()) as { valid: boolean; estimatedSen: number; currency: string };
    expect(body).toMatchObject({ valid: true, currency: "MYR" });
    expect(body.estimatedSen).toBeGreaterThan(0);
  });

  it("returns every validation error at once for a broken graph", async () => {
    const { app, headers } = await session();
    const broken = workflowDocumentSchema.parse({
      version: 1,
      nodes: [{ id: "ai", type: "ai.model", version: 1, config: {}, position: { x: 0, y: 0 } }],
      edges: [],
    });
    const created = await app.request(
      "/api/v1/workflows",
      { method: "POST", headers, body: JSON.stringify({ name: "Broken", document: broken }) },
      env,
    );
    const workflow = (await created.json()) as { id: string };
    const preview = await app.request(`/api/v1/workflows/${workflow.id}/preview`, { method: "POST", headers, body: "{}" }, env);
    const body = (await preview.json()) as { valid: boolean; errors: { code: string }[] };

    expect(body.valid).toBe(false);
    expect(body.errors.length).toBeGreaterThan(1);
    expect(body.errors.map((e) => e.code)).toContain("no_output");
  });

  it("freezes a version on run and reuses it when nothing changed", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    await new LedgerService(env).deposit(auth.orgId, 5000);
    const service = new WorkflowService(env);
    const created = await service.create(auth, { name: "Versioned", projectId: (await defaultProject(auth.orgId)), document: validDoc() });

    const first = await service.freezeVersion(auth, created.workflow.id);
    const second = await service.freezeVersion(auth, created.workflow.id);
    expect(second.versionId).toBe(first.versionId);
    expect(second.version).toBe(1);

    // Moving a node is editor state, not a new version.
    const moved = validDoc();
    moved.nodes[0]!.position = { x: 999, y: 999 };
    const third = await service.freezeVersion(auth, created.workflow.id, moved);
    expect(third.versionId).toBe(first.versionId);

    // Changing the prompt is a real change.
    const changed = await service.freezeVersion(auth, created.workflow.id, validDoc("different"));
    expect(changed.version).toBe(2);
  });

  it("rate limits repeated generation attempts", async () => {
    await new ModelSeedService(env).seed();
    const { app, headers, orgId } = await session();
    await new LedgerService(env).deposit(orgId, 100000);

    let limited = 0;
    for (let i = 0; i < 34; i++) {
      const res = await app.request(
        "/api/v1/generations",
        { method: "POST", headers, body: JSON.stringify({ modelId: FLUX, prompt: `spam ${i}` }) },
        { ...env, AI: { run: async () => ({ image: "aGk=" }) } as unknown as Ai },
      );
      if (res.status === 429) {
        limited += 1;
        expect(res.headers.get("retry-after")).toBeTruthy();
      }
    }
    // The 30-per-minute generation bucket must stop the tail of that burst.
    expect(limited).toBeGreaterThan(0);
  });

  it("caps how many runs a workspace can have in flight", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    const projectId = await defaultProject(auth.orgId);
    const service = new WorkflowService(env);

    // Five runs already in progress fills the allowance.
    for (let i = 0; i < 5; i++) {
      const busy = await service.create(auth, { name: `Busy ${i}`, projectId, document: validDoc() });
      const version = await service.freezeVersion(auth, busy.workflow.id);
      await env.DB
        .prepare(
          `INSERT INTO workflow_runs (id, org_id, project_id, user_id, workflow_id, workflow_version_id, trigger, status, variables_json, estimated_cost_sen)
           VALUES (?,?,?,?,?,?,'api','running','{}',0)`,
        )
        .bind(newId(), auth.orgId, projectId, auth.userId, busy.workflow.id, version.versionId)
        .run();
    }

    const created = await service.create(auth, { name: "Blocked", projectId, document: validDoc() });
    const frozen = await service.freezeVersion(auth, created.workflow.id);
    const { WorkflowExecutionService } = await import("../src/services/workflow-execution-service");

    await expect(
      new WorkflowExecutionService(env).start(auth, {
        doc: frozen.document, workflowId: created.workflow.id, workflowVersionId: frozen.versionId,
        projectId, variables: {}, trigger: "api",
      }),
    ).rejects.toMatchObject({ code: "workflow_limit_exceeded" });
  });
});

async function defaultProject(orgId: string): Promise<string> {
  const row = await env.DB.prepare(`SELECT id FROM projects WHERE org_id = ? LIMIT 1`).bind(orgId).first<{ id: string }>();
  if (row) return row.id;
  const id = newId();
  const user = await env.DB.prepare(`SELECT owner_user_id FROM organizations WHERE id = ?`).bind(orgId).first<{ owner_user_id: string }>();
  await env.DB
    .prepare(`INSERT INTO projects (id, org_id, name, kind, created_by) VALUES (?,?,?,'general',?)`)
    .bind(id, orgId, "Test project", user!.owner_user_id)
    .run();
  return id;
}

describe("portability", () => {
  beforeEach(() => resetRateLimits());

  it("exports a workflow as portable JSON and imports it back", async () => {
    const { app, headers, cookie } = await session();
    const created = await app.request(
      "/api/v1/workflows",
      { method: "POST", headers, body: JSON.stringify({ name: "Portable", document: validDoc("exported prompt") }) },
      env,
    );
    const workflow = (await created.json()) as { id: string };

    const exported = await app.request(`/api/v1/workflows/${workflow.id}/export`, { headers: { cookie, "x-csrf-token": "" } }, env);
    expect(exported.status).toBe(200);
    const file = (await exported.json()) as { format: string; document: unknown; name: string };
    expect(file.format).toBe("raisai.workflow");

    const imported = await app.request(
      "/api/v1/workflows/import",
      { method: "POST", headers, body: JSON.stringify({ ...file, name: "Imported copy" }) },
      env,
    );
    expect(imported.status).toBe(201);
    const body = (await imported.json()) as { id: string; document: { nodes: { config: { template?: string } }[] } };
    expect(body.id).not.toBe(workflow.id);
    expect(body.document.nodes[0]!.config.template).toBe("exported prompt");

    // The round trip must hold for a workflow with no description, which is
    // exactly the case that used to fail.
    const roundTripped = await app.request(`/api/v1/workflows/${body.id}/export`, { headers: { cookie } }, env);
    const again = await app.request(
      "/api/v1/workflows/import",
      { method: "POST", headers, body: JSON.stringify(await roundTripped.json()) },
      env,
    );
    expect(again.status).toBe(201);
  });

  it("refuses a file that is not a valid workflow", async () => {
    const { app, headers } = await session();
    const res = await app.request(
      "/api/v1/workflows/import",
      { method: "POST", headers, body: JSON.stringify({ document: { nodes: "not an array" } }) },
      env,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain("not a valid RaisAI workflow");
  });

  it("duplicates a workflow without touching the original", async () => {
    const { app, headers, cookie } = await session();
    const created = await app.request(
      "/api/v1/workflows",
      { method: "POST", headers, body: JSON.stringify({ name: "Original", document: validDoc() }) },
      env,
    );
    const workflow = (await created.json()) as { id: string };

    const copied = await app.request(`/api/v1/workflows/${workflow.id}/duplicate`, { method: "POST", headers }, env);
    const copy = (await copied.json()) as { id: string; name: string };
    expect(copy.name).toBe("Original (copy)");
    expect(copy.id).not.toBe(workflow.id);

    const original = await app.request(`/api/v1/workflows/${workflow.id}`, { headers: { cookie } }, env);
    expect(((await original.json()) as { name: string }).name).toBe("Original");
  });
});
