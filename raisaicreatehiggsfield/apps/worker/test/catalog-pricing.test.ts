import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { translateCatalogPricing } from "../src/services/catalog-pricing";
import { ModelSyncService } from "../src/services/model-sync-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { AdminModelService } from "../src/services/admin-model-service";
import { PricingService } from "../src/services/pricing-service";
import { ModelRepository } from "../src/repositories/models";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";

async function admin(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`).bind(userId, `${userId}@example.com`, "h", "Admin").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`).bind(orgId, "Ops", userId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: true };
}

function catalog(entries: unknown[]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ success: true, result: entries }), {
      status: 200, headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

async function currentRate(modelId: string) {
  return env.DB
    .prepare(`SELECT unit, provider_price_json FROM model_pricing WHERE model_id = ? ORDER BY effective_from DESC, rowid DESC LIMIT 1`)
    .bind(modelId)
    .first<{ unit: string; provider_price_json: string }>();
}

describe("reading a rate the way Cloudflare states it", () => {
  it("understands token pricing", () => {
    const t = translateCatalogPricing([
      { unit: "per M input tokens", price: 0.15, currency: "USD" },
      { unit: "per M output tokens", price: 0.5, currency: "USD" },
      { unit: "per M cached input tokens", price: 0.03, currency: "USD" },
    ]);
    expect(t).toEqual({ ok: true, pricing: { unit: "tokens", providerUsd: { perMInputTokens: 0.15, perMOutputTokens: 0.5, perMCachedInputTokens: 0.03 } } });
  });

  it("understands tile and step pricing", () => {
    const t = translateCatalogPricing([
      { unit: "per 512 by 512 tile", price: 0.0000528, currency: "USD" },
      { unit: "per step", price: 0.0001056, currency: "USD" },
    ]);
    expect(t.ok && t.pricing.unit).toBe("tile_step");
  });

  it("turns a per-second audio rate into the per-minute shape the estimate uses", () => {
    const t = translateCatalogPricing([{ unit: "per audio second", price: 0.001, currency: "USD" }], "audio");
    expect(t.ok && t.pricing).toEqual({ unit: "audio_minute", providerUsd: { perAudioMinute: 0.06 } });
  });

  it("reads per second as video time on a video model", () => {
    const t = translateCatalogPricing([{ unit: "per second", price: 0.05, currency: "USD" }], "video");
    expect(t.ok && t.pricing).toEqual({ unit: "video_seconds", providerUsd: { perSecond: 0.05 } });
  });

  it("refuses rather than half-pricing a model with a unit it does not know", () => {
    // A rate the estimate cannot see is a charge the customer was never shown.
    const t = translateCatalogPricing([
      { unit: "per M input tokens", price: 0.15, currency: "USD" },
      { unit: "per reasoning burst", price: 9, currency: "USD" },
    ]);
    expect(t.ok).toBe(false);
    expect(!t.ok && t.unknownUnits).toEqual(["per reasoning burst"]);
  });

  it("refuses a rate in a currency other than dollars", () => {
    const t = translateCatalogPricing([{ unit: "per image", price: 1, currency: "EUR" }]);
    expect(t.ok).toBe(false);
  });
});

describe("prices from the account sync", () => {
  const withCreds = () => ({ ...env, CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_TOKEN: "token" });

  it("prices a newly discovered model from what the account reports", async () => {
    const id = `@cf/test/priced-${newId()}`;
    const result = await new ModelSyncService(withCreds()).sync({
      fetchImpl: catalog([{
        name: id, description: "New", task: { name: "Text Generation" },
        properties: [{ property_id: "price", value: [
          { unit: "per M input tokens", price: 0.2, currency: "USD" },
          { unit: "per M output tokens", price: 0.6, currency: "USD" },
        ] }],
      }]),
    });
    expect(result.priced).toBe(1);

    const rate = await currentRate(id);
    expect(rate?.unit).toBe("tokens");
    expect(JSON.parse(rate!.provider_price_json)).toMatchObject({ perMInputTokens: 0.2, source: "cloudflare-api" });

    // Priced is not offered. The model still has to pass a test and be enabled (§125).
    expect((await new ModelRepository(env).findById(id))?.status).toBe("discovered");
    // But the customer-facing estimate now exists, so an admin sees the real number.
    const preview = await new AdminModelService(env).previewPrice(id);
    expect("estimatedSen" in preview && preview.estimatedSen).toBeGreaterThan(0);
  });

  it("never overwrites a rate an admin set by hand", async () => {
    const id = `@cf/test/manual-${newId()}`;
    const sync = new ModelSyncService(withCreds());
    await sync.sync({ fetchImpl: catalog([{ name: id, task: { name: "Text-to-Image" } }]) });
    await new AdminModelService(env).setPricing(await admin(), id, { unit: "flat", providerUsd: { flat: 0.5 } });

    const result = await sync.sync({
      fetchImpl: catalog([{
        name: id, task: { name: "Text-to-Image" },
        properties: [{ property_id: "price", value: [{ unit: "per image", price: 0.01, currency: "USD" }] }],
      }]),
    });

    expect(result.priced).toBe(0);
    expect(JSON.parse((await currentRate(id))!.provider_price_json)).toEqual({ flat: 0.5 });
  });

  it("refreshes a rate it wrote itself when the account's price moves, keeping history", async () => {
    const id = `@cf/test/moving-${newId()}`;
    const sync = new ModelSyncService(withCreds());
    const at = (price: number) => catalog([{
      name: id, task: { name: "Text-to-Image" },
      properties: [{ property_id: "price", value: [{ unit: "per image", price, currency: "USD" }] }],
    }]);

    await sync.sync({ fetchImpl: at(0.01) });
    const unchanged = await sync.sync({ fetchImpl: at(0.01) });
    expect(unchanged.priced).toBe(0);

    const moved = await sync.sync({ fetchImpl: at(0.02) });
    expect(moved.priced).toBe(1);
    expect(JSON.parse((await currentRate(id))!.provider_price_json).flat).toBe(0.02);

    // The old rate is still there: a charge made under it stays explainable.
    const rows = await env.DB.prepare(`SELECT COUNT(*) AS n FROM model_pricing WHERE model_id = ?`).bind(id).first<{ n: number }>();
    expect(rows?.n).toBe(2);
  });

  it("keeps the admin's markup when a provider rate is refreshed", async () => {
    const id = `@cf/test/markup-${newId()}`;
    const sync = new ModelSyncService(withCreds());
    const at = (price: number) => catalog([{
      name: id, task: { name: "Text-to-Image" },
      properties: [{ property_id: "price", value: [{ unit: "per image", price, currency: "USD" }] }],
    }]);
    await sync.sync({ fetchImpl: at(0.01) });
    await env.DB.prepare(`UPDATE model_pricing SET markup_percent = 55 WHERE model_id = ?`).bind(id).run();

    await sync.sync({ fetchImpl: at(0.02) });

    const row = await env.DB.prepare(`SELECT markup_percent FROM model_pricing WHERE model_id = ? ORDER BY rowid DESC LIMIT 1`).bind(id).first<{ markup_percent: number }>();
    expect(row?.markup_percent).toBe(55);
  });

  it("says which models it could not price and why", async () => {
    const id = `@cf/test/odd-${newId()}`;
    const result = await new ModelSyncService(withCreds()).sync({
      fetchImpl: catalog([{
        name: id, task: { name: "Text Generation" },
        properties: [{ property_id: "price", value: [{ unit: "per thought", price: 1, currency: "USD" }] }],
      }]),
    });
    expect(result.priced).toBe(0);
    expect(result.pricingSkipped).toEqual([{ modelId: id, reason: expect.stringContaining("per thought") }]);
    expect(await currentRate(id)).toBeNull();
  });

  it("leaves a seeded, verified rate alone", async () => {
    await new ModelSeedService(env).seed();
    const flux = "@cf/black-forest-labs/flux-1-schnell";
    const before = await currentRate(flux);

    await new ModelSyncService(withCreds()).sync({
      fetchImpl: catalog([{
        name: flux, task: { name: "Text-to-Image" },
        properties: [{ property_id: "price", value: [{ unit: "per image", price: 99, currency: "USD" }] }],
      }]),
    });

    expect(await currentRate(flux)).toEqual(before);
    // And the estimate customers see did not jump.
    const model = (await new ModelRepository(env).findById(flux))!;
    const estimate = await new PricingService(env).estimate(model, { prompt: "a cat" });
    expect(estimate.estimatedSen).toBeLessThan(100);
  });
});
