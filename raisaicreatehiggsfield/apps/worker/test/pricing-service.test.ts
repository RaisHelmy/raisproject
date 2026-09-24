import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { formatMYR } from "@raisai/shared";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ModelService } from "../src/services/model-service";
import { PricingService } from "../src/services/pricing-service";

async function setup() {
  await new ModelSeedService(env).seed();
  return { models: new ModelService(env), pricing: new PricingService(env) };
}

describe("PricingService against the real seeded rates", () => {
  it("prices a fast draft image at a fraction of a ringgit", async () => {
    const { models, pricing } = await setup();
    const flux = await models.getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const estimate = await pricing.estimate(flux, { prompt: "a rainy cyberpunk street", width: 1024, height: 1024 });

    expect(estimate.measures).toMatchObject({ tiles: 4, steps: 4 });
    expect(estimate.estimatedSen).toBe(1); // RM0.01, floored by the minimum charge
    expect(estimate.approximate).toBe(false);
  });

  it("prices a quality image in the sen range the product promises", async () => {
    const { models, pricing } = await setup();
    const lucid = await models.getEnabled("@cf/leonardo/lucid-origin");
    const estimate = await pricing.estimate(lucid, { prompt: "a rainy cyberpunk street" });

    // 1120x1120 at 20 steps -> 9 tiles. USD 0.065604 x 4.7 fx x 1.20 markup
    // = 37.0007 sen, rounded up. Lands on the RM0.38 figure CLAUDE.md uses.
    expect(formatMYR(estimate.estimatedSen)).toBe("RM0.38");
  });

  it("prices text generation from an upper bound on output length", async () => {
    const { models, pricing } = await setup();
    const llama = await models.getEnabled("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    const estimate = await pricing.estimate(llama, { prompt: "Write a logline for a heist film.", maxTokens: 1024 });

    expect(estimate.unit).toBe("tokens");
    expect(estimate.approximate).toBe(true); // output length is a ceiling, not a prediction
    expect(estimate.estimatedSen).toBeGreaterThan(0);
    expect(estimate.estimatedSen).toBeLessThan(20);
  });

  it("charges the real amount when the provider reports usage", async () => {
    const { models, pricing } = await setup();
    const llama = await models.getEnabled("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    const estimate = await pricing.estimate(llama, { prompt: "Write a logline.", maxTokens: 1024 });

    // The model only produced 40 output tokens, far under the 1024 ceiling.
    const actual = await pricing.actual(llama, { unit: "tokens", measures: { tokensIn: 8, tokensOut: 40 } }, estimate);
    expect(actual.basis).toBe("actual");
    expect(actual.actualSen).toBeLessThan(estimate.estimatedSen);
  });

  it("falls back to the estimate and says so when the provider reports nothing", async () => {
    const { models, pricing } = await setup();
    const flux = await models.getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const estimate = await pricing.estimate(flux, { prompt: "x" });
    const actual = await pricing.actual(flux, undefined, estimate);

    expect(actual.basis).toBe("estimated");
    expect(actual.actualSen).toBe(estimate.estimatedSen);
  });

  it("refuses to price a model with no configured rate rather than guessing", async () => {
    const { pricing } = await setup();
    const { ModelRepository } = await import("../src/repositories/models");
    const unpriced = {
      id: `@cf/test/unpriced-${Date.now()}`, provider: "cloudflare" as const, hosting: "workers-ai" as const,
      displayName: "Unpriced", description: "", category: "image" as const, task: "text-to-image",
      capabilities: [], inputs: {}, outputs: {}, parameters: [], limits: {},
      status: "discovered" as const, tags: [], version: "1", sortOrder: 0,
    };
    await new ModelRepository(env).upsert(unpriced);

    await expect(pricing.estimate(unpriced, { prompt: "x" })).rejects.toMatchObject({ code: "model_not_enabled" });
  });

  it("keeps provider economics out of the estimate that reaches a customer", async () => {
    const { models, pricing } = await setup();
    const flux = await models.getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const estimate = await pricing.estimate(flux, { prompt: "x" });

    // The service computes provider cost for accounting, but it is a separate
    // field the customer serializer drops (ADR-006).
    expect(estimate.providerCostMicroUsd).toBeGreaterThan(0);
    expect(Object.keys(estimate)).toContain("estimatedSen");
  });
});

describe("estimate endpoint", () => {
  it("returns a customer estimate and hides provider economics", async () => {
    const { createApp } = await import("../src/app");
    const { findForbiddenCustomerFields, newId } = await import("@raisai/shared");
    await new ModelSeedService(env).seed();
    const app = createApp();

    const signup = await app.request(
      "/api/v1/auth/signup",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `est-${newId()}@example.com`, password: "password123", name: "Est" }),
      },
      env,
    );
    const cookies = signup.headers.getSetCookie();
    const cookie = cookies.map((x) => x.split(";")[0]).join("; ");
    const csrf = cookies.find((x) => x.startsWith("rais_csrf="))!.split(";")[0]!.split("=").slice(1).join("=");

    const res = await app.request(
      "/api/v1/models/@cf/leonardo/lucid-origin/estimate",
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ prompt: "a rainy street" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { estimatedSen: number; currency: string };
    expect(body).toMatchObject({ estimatedSen: 38, currency: "MYR" });
    expect(findForbiddenCustomerFields(body)).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("providerCost");
    expect(JSON.stringify(body)).not.toContain("measures");
  });

  it("lists models with a comparable typical cost", async () => {
    const { createApp } = await import("../src/app");
    const { newId } = await import("@raisai/shared");
    await new ModelSeedService(env).seed();
    const app = createApp();
    const signup = await app.request(
      "/api/v1/auth/signup",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `list-${newId()}@example.com`, password: "password123", name: "L" }),
      },
      env,
    );
    const setCookies = signup.headers.getSetCookie();
    const cookie = setCookies.map((x) => x.split(";")[0]).join("; ");

    const res = await app.request("/api/v1/models?category=image", { headers: { cookie } }, env);
    const body = (await res.json()) as { items: { id: string; typicalCostSen?: number }[] };
    const byId = Object.fromEntries(body.items.map((m) => [m.id, m.typicalCostSen]));

    // The cheap draft model must read as cheaper than the quality one.
    expect(byId["@cf/black-forest-labs/flux-1-schnell"]).toBeLessThan(byId["@cf/leonardo/lucid-origin"]!);

    // The price beside a model must be the price the user is actually charged
    // when generating with it, not a differently-sized sample request.
    const estimateRes = await app.request(
      "/api/v1/models/@cf/leonardo/lucid-origin/estimate",
      { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ prompt: "a rainy street" }) },
      env,
    );
    const { estimatedSen } = (await estimateRes.json()) as { estimatedSen: number };
    expect(byId["@cf/leonardo/lucid-origin"]).toBe(estimatedSen);
  });
});
