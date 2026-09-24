import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { ComparisonService } from "../src/services/comparison-service";
import { LedgerService } from "../src/services/ledger-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";
const LUCID = "@cf/leonardo/lucid-origin";

async function context(availableSen = 50000): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Comparer").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id, available_sen) VALUES (?,?)`).bind(orgId, availableSen).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

describe("model comparison", () => {
  it("runs the same prompt across models and reports each cost", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const service = new ComparisonService(env);

    const result = await service.run(auth, {
      modelIds: [FLUX, LUCID],
      prompt: "a rainy cyberpunk street",
      provider: new FakeAIProvider(),
    });

    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((e) => e.status === "completed")).toBe(true);
    // The cheap and the quality model cost different amounts, which is the
    // whole point of putting them side by side (§89, §92).
    const flux = result.entries.find((e) => e.modelId === FLUX)!;
    const lucid = result.entries.find((e) => e.modelId === LUCID)!;
    expect(flux.chargedSen).toBeLessThan(lucid.chargedSen);
    expect(result.totalChargedSen).toBe(flux.chargedSen + lucid.chargedSen);
  });

  it("quotes the whole comparison before running it", async () => {
    await new ModelSeedService(env).seed();
    const estimate = await new ComparisonService(env).estimate([FLUX, LUCID], "a street");
    expect(estimate.perModel).toHaveLength(2);
    expect(estimate.totalSen).toBe(estimate.perModel.reduce((sum, m) => sum + m.estimatedSen, 0));
  });

  it("refuses when the balance covers some models but not all", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    // Enough for the 1 sen draft but not the 38 sen quality model.
    const auth = await context(10);

    await expect(
      new ComparisonService(env).run(auth, { modelIds: [FLUX, LUCID], prompt: "x", provider: new FakeAIProvider() }),
    ).rejects.toMatchObject({ code: "insufficient_balance" });

    // Nothing ran, so there is no half-finished comparison to interpret.
    const rows = await env.DB.prepare(`SELECT id FROM generations WHERE org_id = ?`).bind(auth.orgId).all();
    expect(rows.results).toHaveLength(0);
  });

  it("keeps the results of models that worked when one fails", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const provider = new FakeAIProvider();
    provider.failNext(LUCID, { code: "provider_error", message: "Lucid is offline.", retryable: true });

    const result = await new ComparisonService(env).run(auth, {
      modelIds: [FLUX, LUCID], prompt: "a street", provider,
    });

    const flux = result.entries.find((e) => e.modelId === FLUX)!;
    const lucid = result.entries.find((e) => e.modelId === LUCID)!;
    expect(flux.status).toBe("completed");
    expect(lucid.status).toBe("failed");
    expect(lucid.chargedSen).toBe(0);
  });

  it("needs at least two models, and caps how many at once", async () => {
    await new ModelSeedService(env).seed();
    const auth = await context();
    const service = new ComparisonService(env);

    await expect(service.run(auth, { modelIds: [FLUX], prompt: "x" })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(
      service.run(auth, { modelIds: [FLUX, LUCID, "a", "b", "c"], prompt: "x" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("ignores a model listed twice rather than charging for it twice", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const result = await new ComparisonService(env).run(auth, {
      modelIds: [FLUX, LUCID, FLUX], prompt: "a street", provider: new FakeAIProvider(),
    });
    expect(result.entries).toHaveLength(2);
  });
});
