import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { GenerationService } from "../src/services/generation-service";
import { AssetService } from "../src/services/asset-service";
import { ProjectService } from "../src/services/project-service";
import { LedgerService } from "../src/services/ledger-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ModelService } from "../src/services/model-service";
import { AdminModelService } from "../src/services/admin-model-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

const VISION = "@cf/meta/llama-3.2-11b-vision-instruct";
const SDXL = "@cf/bytedance/stable-diffusion-xl-lightning";
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 9]).buffer as ArrayBuffer;

async function context(admin = false): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name,role) VALUES (?,?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Ref", admin ? "admin" : "user").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?, 50000)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: admin };
}

async function uploadImage(auth: AuthContext, name = "reference.png"): Promise<string> {
  const project = await new ProjectService(env).getOrCreateDefault(auth);
  const asset = await new AssetService(env).create(auth, {
    projectId: project.id, name, mime: "image/png", bytes: PNG, source: "upload", width: 512, height: 512,
  });
  return asset.id;
}

describe("reference images", () => {
  it("passes an uploaded image through to the model", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const assetId = await uploadImage(auth);
    const provider = new FakeAIProvider();

    const result = await new GenerationService(env).create(auth, {
      modelId: VISION,
      prompt: "What is in this picture?",
      imageAssetIds: [assetId],
      provider,
    });

    expect(result.generation.status).toBe("completed");
    // The bytes reached the provider, not just the id.
    expect(provider.calls[0]!.input.images).toHaveLength(1);
    expect(provider.calls[0]!.input.images![0]!.bytes!.byteLength).toBe(PNG.byteLength);
  });

  it("refuses a reference the model cannot accept, before spending anything", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const assetId = await uploadImage(auth);
    const ledger = new LedgerService(env);
    const before = await ledger.getBalance(auth.orgId);

    // Refused up front, in the model's own words, before a graph or a
    // generation record exists: this request never reached a provider.
    await expect(
      new GenerationService(env).create(auth, {
        modelId: "@cf/black-forest-labs/flux-1-schnell",
        prompt: "a street",
        imageAssetIds: [assetId],
        provider: new FakeAIProvider(),
      }),
    ).rejects.toMatchObject({ code: "model_incompatible" });

    const after = await ledger.getBalance(auth.orgId);
    expect(after.availableSen).toBe(before.availableSen);
    const orphan = await env.DB
      .prepare(`SELECT id FROM generations WHERE org_id = ?`).bind(auth.orgId).first();
    expect(orphan).toBeNull();
  });

  it("enforces the model's own reference-image limit", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const first = await uploadImage(auth, "one.png");
    const second = await uploadImage(auth, "two.png");

    // The vision model declares a limit of one.
    await expect(
      new GenerationService(env).create(auth, {
        modelId: VISION, prompt: "compare these", imageAssetIds: [first, second], provider: new FakeAIProvider(),
      }),
    ).rejects.toMatchObject({ code: "model_incompatible" });
  });

  it("prices a reference image into the estimate", async () => {
    await new ModelSeedService(env).seed();
    const { PricingService } = await import("../src/services/pricing-service");
    const model = await new ModelService(env).getAny("@cf/black-forest-labs/flux-2-klein-9b");
    const pricing = new PricingService(env);

    const withoutReference = await pricing.estimate(model!, { prompt: "x", width: 1024, height: 1024 });
    const withReference = await pricing.estimate(model!, {
      prompt: "x", width: 1024, height: 1024,
      images: [{ mime: "image/png", width: 1024, height: 1024 }],
    });

    // This model charges for input megapixels, so a reference costs more.
    expect(withReference.estimatedSen).toBeGreaterThan(withoutReference.estimatedSen);
  });

  it("works image-to-image once an admin prices, tests and enables such a model", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const admin = await context(true);
    const service = new AdminModelService(env);

    // SDXL Lightning ships disabled because Cloudflare publishes no rate for
    // it. This is the whole path from discovered to usable.
    await service.setPricing(admin, SDXL, { unit: "tile_step", providerUsd: { per512Tile: 0.0002, perStep: 0.00004 } });
    expect((await service.testRun(admin, SDXL, new FakeAIProvider())).ok).toBe(true);
    await service.setStatus(admin, SDXL, "enabled");

    const user = await context();
    const assetId = await uploadImage(user);
    const provider = new FakeAIProvider();
    const result = await new GenerationService(env).create(user, {
      modelId: SDXL, prompt: "make it night", imageAssetIds: [assetId], provider,
    });

    expect(result.generation.status).toBe("completed");
    expect(provider.calls[0]!.input.images).toHaveLength(1);
  });
});
