import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { SearchService } from "../src/services/search-service";
import { ProjectService } from "../src/services/project-service";
import { WorkflowService } from "../src/services/workflow-service";
import { MovieService } from "../src/services/movie-service";
import { TemplateService } from "../src/services/template-service";
import { GenerationService } from "../src/services/generation-service";
import { LedgerService } from "../src/services/ledger-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { workflowDocumentSchema } from "../src/engine/document";
import { registerBuiltinNodes } from "../src/engine/nodes";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Searcher").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 50000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

function doc() {
  return workflowDocumentSchema.parse({
    version: 1,
    nodes: [
      { id: "p", type: "prompt", version: 1, config: { template: "x" }, position: { x: 0, y: 0 } },
      { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 1, y: 0 } },
      { id: "o", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
    ],
    edges: [
      { id: "e1", from: { node: "p", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e2", from: { node: "ai", port: "image" }, to: { node: "o", port: "value" } },
    ],
  });
}

async function workspaceWithThings() {
  registerBuiltinNodes();
  await new ModelSeedService(env).seed();
  const auth = await context();
  const project = await new ProjectService(env).create(auth, { name: "Cyberpunk Movie" });
  await new WorkflowService(env).create(auth, { name: "Cyberpunk pipeline", projectId: project.id, document: doc() });
  await new TemplateService(env).create(auth, { name: "Cyberpunk poster", projectId: project.id, doc: doc() });
  await new MovieService(env).create(auth, { title: "Cyberpunk Rain", idea: "a cyberpunk detective", projectId: project.id });
  await new GenerationService(env).create(auth, {
    modelId: FLUX, prompt: "a cyberpunk street at night", projectId: project.id, provider: new FakeAIProvider(),
  });
  return { auth, project };
}

describe("global search", () => {
  it("finds work of every kind from one query", async () => {
    const { auth } = await workspaceWithThings();
    const hits = await new SearchService(env).search(auth, "cyberpunk");
    const kinds = new Set(hits.map((h) => h.kind));

    expect(kinds).toContain("project");
    expect(kinds).toContain("workflow");
    expect(kinds).toContain("template");
    expect(kinds).toContain("movie");
    expect(kinds).toContain("generation");
  });

  it("gives every hit somewhere to go", async () => {
    const { auth } = await workspaceWithThings();
    const hits = await new SearchService(env).search(auth, "cyberpunk");
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.href.startsWith("/"), `${hit.kind} needs a destination`).toBe(true);
      expect(hit.title.length, `${hit.kind} needs a title`).toBeGreaterThan(0);
    }
  });

  it("puts an exact title match first", async () => {
    const { auth } = await workspaceWithThings();
    const hits = await new SearchService(env).search(auth, "cyberpunk movie");
    expect(hits[0]!.title.toLowerCase()).toBe("cyberpunk movie");
  });

  it("can be narrowed to one kind", async () => {
    const { auth } = await workspaceWithThings();
    const hits = await new SearchService(env).search(auth, "cyberpunk", { kinds: ["movie"] });
    expect(hits.every((h) => h.kind === "movie")).toBe(true);
  });

  it("ignores a query too short to mean anything", async () => {
    const { auth } = await workspaceWithThings();
    expect(await new SearchService(env).search(auth, "c")).toEqual([]);
    expect(await new SearchService(env).search(auth, "  ")).toEqual([]);
  });

  it("never returns another workspace's work", async () => {
    await workspaceWithThings();
    const stranger = await context();
    const hits = await new SearchService(env).search(stranger, "cyberpunk");
    // Scoping happens in SQL, not by filtering afterwards.
    expect(hits.filter((h) => h.kind !== "template")).toEqual([]);
  });

  it("does find someone else's published template, which is the point of publishing", async () => {
    const { auth, project } = await workspaceWithThings();
    const templates = new TemplateService(env);
    const { template } = await templates.create(auth, { name: "Shared cyberpunk look", projectId: project.id, doc: doc() });
    await templates.setVisibility(auth, template.id, "public");

    const stranger = await context();
    const hits = await new SearchService(env).search(stranger, "shared cyberpunk");
    expect(hits.map((h) => h.title)).toContain("Shared cyberpunk look");
  });
});
