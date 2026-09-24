import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { workflowDocumentSchema } from "../src/engine/document";
import { TemplateService } from "../src/services/template-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { LedgerService } from "../src/services/ledger-service";
import { ProjectService } from "../src/services/project-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";
import { testContext } from "./helpers/engine-harness";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

/** A reusable "styled image" template with one typed input. */
function templateDoc(promptTemplate = "a {{subject}}, cinematic lighting") {
  return workflowDocumentSchema.parse({
    version: 1,
    nodes: [
      { id: "p", type: "prompt", version: 1, config: { template: promptTemplate }, position: { x: 0, y: 0 } },
      { id: "ai", type: "ai.model", version: 1, config: { modelId: FLUX, parameters: {} }, position: { x: 1, y: 0 } },
      { id: "out", type: "output", version: 1, config: { name: "image" }, position: { x: 2, y: 0 } },
    ],
    edges: [
      { id: "e1", from: { node: "p", port: "prompt" }, to: { node: "ai", port: "prompt" } },
      { id: "e2", from: { node: "ai", port: "image" }, to: { node: "out", port: "value" } },
    ],
    variables: [{ name: "subject", type: "string", required: true, label: "Subject" }],
  });
}

async function setup() {
  registerBuiltinNodes();
  await new ModelSeedService(env).seed();
  const auth = await testContext();
  await new LedgerService(env).deposit(auth.orgId, 5000);
  const project = await new ProjectService(env).getOrCreateDefault(auth);
  return { auth, projectId: project.id, service: new TemplateService(env) };
}

describe("templates", () => {
  it("saves a workflow as a reusable template with declared inputs", async () => {
    const { auth, projectId, service } = await setup();
    const { template, version } = await service.create(auth, {
      name: "Cinematic Portrait", description: "A styled portrait", projectId, doc: templateDoc(),
    });

    expect(template.slug).toBe("cinematic-portrait");
    expect(version.version).toBe(1);
    // The estimated cost is captured at publish so the card can show it (§52).
    expect(template.estimated_cost_sen).toBeGreaterThan(0);

    const { variables } = await service.requireTemplate(auth, template.id);
    expect(variables.map((v) => v.name)).toEqual(["subject"]);
  });

  it("runs a template, substituting the supplied inputs", async () => {
    const { auth, projectId, service } = await setup();
    const { template } = await service.create(auth, { name: "Styled Image", projectId, doc: templateDoc() });
    const provider = new FakeAIProvider();

    const run = await service.execute(auth, template.id, { subject: "tiger" }, { projectId, provider });

    expect(run.status).toBe("completed");
    expect(provider.calls[0]!.input.prompt).toBe("a tiger, cinematic lighting");
    expect(run.outputs.image).toBeDefined();
  });

  it("refuses to run without a required input", async () => {
    const { auth, projectId, service } = await setup();
    const { template } = await service.create(auth, { name: "Needs Input", projectId, doc: templateDoc() });

    await expect(service.execute(auth, template.id, {}, { projectId, provider: new FakeAIProvider() }))
      .rejects.toMatchObject({ code: "invalid_input" });
  });

  it("keeps an older version running exactly as it did when published", async () => {
    const { auth, projectId, service } = await setup();
    const { template, version: v1 } = await service.create(auth, {
      name: "Versioned", projectId, doc: templateDoc("v1 style: {{subject}}"),
    });

    await service.publishVersion(auth, template.id, templateDoc("v2 style: {{subject}}"), "Changed the style");

    const providerV2 = new FakeAIProvider();
    await service.execute(auth, template.id, { subject: "a car" }, { projectId, provider: providerV2 });
    expect(providerV2.calls[0]!.input.prompt).toBe("v2 style: a car");

    // Pinning the old version still produces the old behaviour (§54, §119).
    const providerV1 = new FakeAIProvider();
    await service.execute(auth, template.id, { subject: "a car" }, { projectId, versionId: v1.id, provider: providerV1 });
    expect(providerV1.calls[0]!.input.prompt).toBe("v1 style: a car");
  });

  it("binds each run to the template version that produced it", async () => {
    const { auth, projectId, service } = await setup();
    const { template, version } = await service.create(auth, { name: "Traceable", projectId, doc: templateDoc() });
    const run = await service.execute(auth, template.id, { subject: "a boat" }, { projectId, provider: new FakeAIProvider() });

    const row = await env.DB
      .prepare(`SELECT template_version_id, trigger FROM workflow_runs WHERE id = ?`)
      .bind(run.id)
      .first<{ template_version_id: string; trigger: string }>();
    expect(row?.template_version_id).toBe(version.id);
    expect(row?.trigger).toBe("template");
  });

  it("counts usage so popular templates can be surfaced", async () => {
    const { auth, projectId, service } = await setup();
    const { template } = await service.create(auth, { name: "Counted", projectId, doc: templateDoc() });
    await service.execute(auth, template.id, { subject: "one" }, { projectId, provider: new FakeAIProvider() });
    await service.execute(auth, template.id, { subject: "two" }, { projectId, provider: new FakeAIProvider() });

    const { template: refreshed } = await service.requireTemplate(auth, template.id);
    expect(refreshed.usage_count).toBe(2);
  });

  it("hides a private template from another workspace but shares a public one", async () => {
    const { auth, projectId, service } = await setup();
    const stranger = await testContext();
    const privateOne = await service.create(auth, { name: "Private One", projectId, doc: templateDoc() });
    const publicOne = await service.create(auth, { name: "Public One", projectId, doc: templateDoc(), visibility: "public" });

    await expect(service.requireTemplate(stranger, privateOne.template.id)).rejects.toMatchObject({ code: "not_found" });
    const shared = await service.requireTemplate(stranger, publicOne.template.id);
    expect(shared.template.name).toBe("Public One");
  });

  it("refuses to save a workflow that could not run", async () => {
    const { auth, projectId, service } = await setup();
    const broken = workflowDocumentSchema.parse({
      version: 1,
      nodes: [{ id: "ai", type: "ai.model", version: 1, config: {}, position: { x: 0, y: 0 } }],
      edges: [],
    });
    await expect(service.create(auth, { name: "Broken", projectId, doc: broken }))
      .rejects.toMatchObject({ code: "workflow_invalid" });
  });
});

describe("discovery and sharing", () => {
  it("finds templates by name, description or tag", async () => {
    const { auth, projectId, service } = await setup();
    await service.create(auth, { name: "Cinematic Portrait", projectId, doc: templateDoc(), tags: ["film"] });
    await service.create(auth, { name: "Product Shot", projectId, doc: templateDoc(), description: "For a shop listing" });

    expect((await service.list(auth, { search: "portrait" })).map((t) => t.name)).toEqual(["Cinematic Portrait"]);
    expect((await service.list(auth, { search: "shop" })).map((t) => t.name)).toEqual(["Product Shot"]);
    expect((await service.list(auth, { search: "film" })).map((t) => t.name)).toEqual(["Cinematic Portrait"]);
  });

  it("filters by category and lists only categories that exist", async () => {
    const { auth, projectId, service } = await setup();
    await service.create(auth, { name: "Ad One", projectId, doc: templateDoc(), category: "marketing" });
    await service.create(auth, { name: "Film One", projectId, doc: templateDoc(), category: "film" });

    expect((await service.list(auth, { category: "film" })).map((t) => t.name)).toEqual(["Film One"]);
    const categories = (await service.categories(auth)).map((c) => c.category);
    expect(categories).toContain("film");
    expect(categories).toContain("marketing");
  });

  it("sorts by popularity when asked", async () => {
    const { auth, projectId, service } = await setup();
    const quiet = await service.create(auth, { name: "Quiet", projectId, doc: templateDoc() });
    const busy = await service.create(auth, { name: "Busy", projectId, doc: templateDoc() });
    for (let i = 0; i < 3; i++) {
      await service.execute(auth, busy.template.id, { subject: "x" }, { projectId, provider: new FakeAIProvider() });
    }

    const popular = await service.list(auth, { sort: "popular" });
    expect(popular[0]!.name).toBe("Busy");
    expect(quiet.template.usage_count).toBe(0);
  });

  it("will not publish a template that has no version yet", async () => {
    const { auth, projectId, service } = await setup();
    const { template } = await service.create(auth, { name: "Publishable", projectId, doc: templateDoc() });
    await env.DB.prepare(`UPDATE templates SET current_version = 0 WHERE id = ?`).bind(template.id).run();

    await expect(service.setVisibility(auth, template.id, "public")).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("makes a published template visible to another workspace", async () => {
    const { auth, projectId, service } = await setup();
    const stranger = await testContext();
    const { template } = await service.create(auth, { name: "Shared", projectId, doc: templateDoc() });

    await expect(service.requireTemplate(stranger, template.id)).rejects.toMatchObject({ code: "not_found" });
    await service.setVisibility(auth, template.id, "public");
    expect((await service.requireTemplate(stranger, template.id)).template.name).toBe("Shared");
  });

  it("duplicates a public template into the copier's own workspace", async () => {
    const { auth, projectId, service } = await setup();
    const { template } = await service.create(auth, { name: "Popular", projectId, doc: templateDoc("copied: {{subject}}") });
    await service.setVisibility(auth, template.id, "public");

    const copier = await testContext();
    await new LedgerService(env).deposit(copier.orgId, 5000);
    const copierProject = await new ProjectService(env).getOrCreateDefault(copier);
    const copy = await service.duplicate(copier, template.id, copierProject.id);

    expect(copy.name).toBe("Popular (copy)");
    expect(copy.org_id).toBe(copier.orgId);

    // The copy is independently runnable, not a pointer at someone else's work.
    const run = await service.execute(copier, copy.id, { subject: "a boat" }, { projectId: copierProject.id, provider: new FakeAIProvider() });
    expect(run.status).toBe("completed");
  });
});
