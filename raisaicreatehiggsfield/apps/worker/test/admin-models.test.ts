import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { AdminModelService } from "../src/services/admin-model-service";
import { ModelSyncService } from "../src/services/model-sync-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ModelService } from "../src/services/model-service";
import { ModelRepository } from "../src/repositories/models";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";

const SDXL = "@cf/bytedance/stable-diffusion-xl-lightning";

async function adminContext(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name,role) VALUES (?,?,?,?,'admin')`)
    .bind(userId, `${userId}@example.com`, "h", "Admin").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "Ops", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id) VALUES (?)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: true };
}

describe("admin model management", () => {
  it("refuses to enable a model that has no pricing", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    // SDXL Lightning ships as discovered precisely because it has no rate.
    await expect(new AdminModelService(env).setStatus(auth, SDXL, "enabled")).rejects.toMatchObject({
      code: "invalid_input",
    });
  });

  it("refuses to enable a priced model that has not passed a test", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    const service = new AdminModelService(env);
    await service.setPricing(auth, SDXL, { unit: "tile_step", providerUsd: { per512Tile: 0.0001, perStep: 0.00002 } });

    await expect(service.setStatus(auth, SDXL, "enabled")).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("enables a model once it is priced and proven, and only then", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    const service = new AdminModelService(env);

    await service.setPricing(auth, SDXL, { unit: "tile_step", providerUsd: { per512Tile: 0.0001, perStep: 0.00002 } });
    const test = await service.testRun(auth, SDXL, new FakeAIProvider());
    expect(test.ok).toBe(true);

    const enabled = await service.setStatus(auth, SDXL, "enabled");
    expect(enabled.status).toBe("enabled");

    // And it is now visible to customers, priced.
    const customerView = await new ModelService(env).getEnabled(SDXL);
    expect(customerView.displayName).toBe("SDXL Lightning");
  });

  it("will not enable a model whose most recent test failed, even after an earlier pass", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    const service = new AdminModelService(env);
    const model = "vidu/q3-turbo";
    await service.setPricing(auth, model, { unit: "video_seconds", providerUsd: { perSecond: 0.05 } });

    const passing = await service.testRun(auth, model, new FakeAIProvider());
    expect(passing.ok).toBe(true);

    const provider = new FakeAIProvider();
    provider.failNext(model, { code: "provider_error", message: "Model is offline.", retryable: true });
    const failing = await service.testRun(auth, model, provider);
    expect(failing.ok).toBe(false);
    expect(failing.message).toContain("offline");

    // The stale pass must not be enough: the newest verdict is what counts.
    await expect(service.setStatus(auth, model, "enabled")).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("orders test verdicts by insertion, not by a timestamp that can tie", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    const service = new AdminModelService(env);
    const model = "@cf/bytedance/stable-diffusion-xl-lightning";
    await service.setPricing(auth, model, { unit: "tile_step", providerUsd: { per512Tile: 0.0001 } });

    // Back to back, so both audit rows can share a millisecond.
    const provider = new FakeAIProvider();
    provider.failNext(model, { code: "provider_error", message: "offline", retryable: true });
    await service.testRun(auth, model, provider);
    await service.testRun(auth, model, new FakeAIProvider());

    // The pass came second, so the model may be enabled.
    const enabled = await service.setStatus(auth, model, "enabled");
    expect(enabled.status).toBe("enabled");
  });

  it("keeps old pricing rows so past charges stay explainable", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    const service = new AdminModelService(env);
    const model = "@cf/black-forest-labs/flux-2-klein-9b";

    const before = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM model_pricing WHERE model_id = ?`).bind(model).first<{ n: number }>();
    await service.setPricing(auth, model, { unit: "tile_step", providerUsd: { per512Tile: 0.0001 } });
    await service.setPricing(auth, model, { unit: "tile_step", providerUsd: { per512Tile: 0.0002 } });
    const after = await env.DB
      .prepare(`SELECT COUNT(*) AS n FROM model_pricing WHERE model_id = ?`).bind(model).first<{ n: number }>();

    // Re-pricing adds rows; it never edits the rate a past charge used.
    expect(after!.n - before!.n).toBe(2);
  });

  it("rejects pricing with no rate above zero", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    await expect(
      new AdminModelService(env).setPricing(auth, SDXL, { unit: "tile_step", providerUsd: { per512Tile: 0 } }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("changes the customer price when the markup changes", async () => {
    await new ModelSeedService(env).seed();
    const auth = await adminContext();
    const service = new AdminModelService(env);
    const flux = "@cf/black-forest-labs/flux-1-schnell";

    await service.setPricing(auth, flux, {
      unit: "tile_step",
      providerUsd: { per512Tile: 0.0528, perStep: 0.1056 },
      markupPercent: 20,
    });
    const cheap = await service.previewPrice(flux);

    await service.setPricing(auth, flux, {
      unit: "tile_step",
      providerUsd: { per512Tile: 0.0528, perStep: 0.1056 },
      markupPercent: 100,
    });
    const dear = await service.previewPrice(flux);

    expect("estimatedSen" in cheap && "estimatedSen" in dear).toBe(true);
    if ("estimatedSen" in cheap && "estimatedSen" in dear) {
      expect(dear.estimatedSen).toBeGreaterThan(cheap.estimatedSen);
    }
  });
});

describe("catalog sync", () => {
  it("explains itself instead of failing when credentials are absent", async () => {
    const result = await new ModelSyncService(env).sync();
    expect(result.discovered).toBe(0);
    expect(result.skippedReason).toContain("CLOUDFLARE_ACCOUNT_ID");
  });

  it("records new catalog entries as discovered, never enabled", async () => {
    await new ModelSeedService(env).seed();
    const withCreds = { ...env, CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "token" };

    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: [
            { name: "@cf/new/experimental-image", description: "Brand new", task: { name: "Text-to-Image" } },
            { name: "@cf/black-forest-labs/flux-1-schnell", description: "Very fast image generation. Great default for drafts and iteration.", task: { name: "Text-to-Image" } },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const result = await new ModelSyncService(withCreds).sync({ fetchImpl });
    expect(result.discovered).toBe(1);
    expect(result.unchanged).toBe(1);

    const discovered = await new ModelRepository(env).findById("@cf/new/experimental-image");
    // Nothing a sync finds becomes billable on its own.
    expect(discovered?.status).toBe("discovered");
    expect(discovered?.category).toBe("image");
    expect(discovered?.capabilities).toContain("text-to-image");
  });

  it("flags a model missing from the catalog without disabling it", async () => {
    await new ModelSeedService(env).seed();
    const withCreds = { ...env, CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "token" };
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: true, result: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const result = await new ModelSyncService(withCreds).sync({ fetchImpl });
    expect(result.missingFromCatalog.length).toBeGreaterThan(0);

    // A catalog blip must not take a working model away from customers.
    const flux = await new ModelRepository(env).findById("@cf/black-forest-labs/flux-1-schnell");
    expect(flux?.status).toBe("enabled");
  });

  it("reports a catalog failure in words an operator can act on", async () => {
    const withCreds = { ...env, CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "bad" };
    const fetchImpl = (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;

    await expect(new ModelSyncService(withCreds).sync({ fetchImpl })).rejects.toMatchObject({
      code: "provider_error",
    });
  });
});
