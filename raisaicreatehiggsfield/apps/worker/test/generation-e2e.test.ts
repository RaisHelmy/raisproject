import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { findForbiddenCustomerFields, formatMYR, newId } from "@raisai/shared";
import { createApp } from "../src/app";
import { ModelSeedService } from "../src/services/model-seed-service";
import { GenerationService } from "../src/services/generation-service";
import { LedgerService } from "../src/services/ledger-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { testContext } from "./helpers/engine-harness";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";
const LUCID = "@cf/leonardo/lucid-origin";

/** A base64 PNG response, matching what a Workers AI image model returns. */
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function envWithStubAI(response: unknown) {
  return { ...env, AI: { run: async () => response } as unknown as Ai };
}

async function signup(app: ReturnType<typeof createApp>, testEnv: typeof env) {
  const res = await app.request(
    "/api/v1/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `gen-${newId()}@example.com`, password: "password123", name: "Creator" }),
    },
    testEnv,
  );
  const setCookies = res.headers.getSetCookie();
  const cookie = setCookies.map((x) => x.split(";")[0]).join("; ");
  const csrf = setCookies.find((x) => x.startsWith("rais_csrf="))!.split(";")[0]!.split("=").slice(1).join("=");
  const body = (await res.json()) as { orgId: string };
  return { cookie, csrf, orgId: body.orgId };
}

describe("Quick Create end to end", () => {
  it("generates an image, charges the balance, and files it in history", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    const ledger = new LedgerService(env);
    await ledger.deposit(auth.orgId, 5000); // RM50.00

    const before = await ledger.getBalance(auth.orgId);
    const provider = new FakeAIProvider();
    const result = await new GenerationService(env).create(auth, {
      modelId: LUCID,
      prompt: "a rainy cyberpunk street in Kuala Lumpur",
      provider,
    });

    expect(result.generation.status).toBe("completed");
    expect(result.outputs.image).toMatchObject({ mime: "image/png" });

    // The user was charged exactly the estimate they were shown: RM0.38.
    expect(formatMYR(result.generation.estimated_cost_sen)).toBe("RM0.38");
    expect(result.generation.actual_cost_sen).toBe(38);
    expect(before.availableSen - result.balanceAfterSen).toBe(38);

    // Nothing is left held once the run settles.
    const balance = await ledger.getBalance(auth.orgId);
    expect(balance.reservedSen).toBe(0);

    // The output is a real asset in the library, linked to the generation.
    const asset = await env.DB
      .prepare(`SELECT * FROM assets WHERE generation_id = ?`)
      .bind(result.generation.id)
      .first<{ kind: string; org_id: string }>();
    expect(asset?.kind).toBe("image");
    expect(asset?.org_id).toBe(auth.orgId);
  });

  it("refunds the difference when the real cost is lower than the estimate", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    const ledger = new LedgerService(env);
    await ledger.deposit(auth.orgId, 5000);
    const before = await ledger.getBalance(auth.orgId);

    // The fake reports usage in a unit that cannot be reconciled with the
    // configured one, so the estimate stands and nothing extra is taken.
    await new GenerationService(env).create(auth, { modelId: FLUX, prompt: "a cat", provider: new FakeAIProvider() });

    const after = await ledger.getBalance(auth.orgId);
    expect(after.reservedSen).toBe(0);
    expect(before.availableSen - after.availableSen).toBe(1); // RM0.01 for a draft image
  });

  it("refuses to start when the balance cannot cover the estimate", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    // Balance starts at RM1000 in the harness; drain it to 10 sen.
    const ledger = new LedgerService(env);
    const balance = await ledger.getBalance(auth.orgId);
    await ledger.adjust(auth.orgId, -(balance.availableSen - 10), "Drain for test");

    await expect(
      new GenerationService(env).create(auth, { modelId: LUCID, prompt: "expensive", provider: new FakeAIProvider() }),
    ).rejects.toMatchObject({
      code: "insufficient_balance",
      details: { estimatedSen: 38, availableSen: 10 },
    });

    // Nothing was spent or held after the refusal.
    const after = await ledger.getBalance(auth.orgId);
    expect(after.availableSen).toBe(10);
    expect(after.reservedSen).toBe(0);
  });

  it("records a failed generation without charging for output that never arrived", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    const ledger = new LedgerService(env);
    await ledger.deposit(auth.orgId, 5000);
    const before = await ledger.getBalance(auth.orgId);

    const provider = new FakeAIProvider();
    provider.failNext(LUCID, { code: "provider_error", message: "Model unavailable.", retryable: true });

    // A failure is a resource, not an exception: it belongs in history with a
    // reason, so the UI can offer Retry / Edit / Change model (§64, §102).
    const result = await new GenerationService(env).create(auth, { modelId: LUCID, prompt: "x", provider });
    expect(result.generation.status).toBe("failed");
    expect(result.generation.error_message).toContain("Model unavailable");

    const after = await ledger.getBalance(auth.orgId);
    // The hold is returned in full; a failed run costs nothing.
    expect(after.availableSen).toBe(before.availableSen);
    expect(after.reservedSen).toBe(0);
  });

  it("treats a repeated request with the same idempotency key as one generation", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    await new LedgerService(env).deposit(auth.orgId, 5000);
    const service = new GenerationService(env);
    const key = newId();

    const first = await service.create(auth, { modelId: FLUX, prompt: "same", idempotencyKey: key, provider: new FakeAIProvider() });
    const second = await service.create(auth, { modelId: FLUX, prompt: "same", idempotencyKey: key, provider: new FakeAIProvider() });

    expect(second.generation.id).toBe(first.generation.id);
    const { results } = await env.DB
      .prepare(`SELECT id FROM generations WHERE org_id = ?`).bind(auth.orgId).all();
    expect(results).toHaveLength(1);
  });

  it("keeps the run linked to the exact graph that produced it", async () => {
    await new ModelSeedService(env).seed();
    const auth = await testContext();
    await new LedgerService(env).deposit(auth.orgId, 5000);
    const result = await new GenerationService(env).create(auth, {
      modelId: FLUX, prompt: "traceable", provider: new FakeAIProvider(),
    });

    const run = await env.DB
      .prepare(`SELECT workflow_version_id FROM workflow_runs WHERE id = ?`)
      .bind(result.generation.workflow_run_id)
      .first<{ workflow_version_id: string }>();
    const version = await env.DB
      .prepare(`SELECT document_json FROM workflow_versions WHERE id = ?`)
      .bind(run!.workflow_version_id)
      .first<{ document_json: string }>();

    // Quick Create really is a workflow, so "open in workflow" has something
    // to show and history cannot drift from what ran (ADR-004, §118).
    const doc = JSON.parse(version!.document_json) as { nodes: { type: string }[] };
    expect(doc.nodes.map((n) => n.type)).toEqual(["prompt", "ai.model", "output"]);
  });
});

describe("generation API", () => {
  it("creates a generation over HTTP and hides provider economics", async () => {
    await new ModelSeedService(env).seed();
    const testEnv = envWithStubAI({ image: PNG_B64 });
    const app = createApp();
    const user = await signup(app, testEnv);
    await new LedgerService(env).deposit(user.orgId, 5000);

    const res = await app.request(
      "/api/v1/generations",
      {
        method: "POST",
        headers: { cookie: user.cookie, "content-type": "application/json", "x-csrf-token": user.csrf },
        body: JSON.stringify({ modelId: FLUX, prompt: "a neon alley" }),
      },
      testEnv,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      generation: { status: string; chargedSen: number; costEstimated: boolean; outputs: Record<string, unknown> };
      balanceAfterSen: number;
    };
    expect(body.generation.status).toBe("completed");
    expect(body.generation.outputs.image).toBeDefined();
    // Workers AI image models report no usage, so the estimate stands and is
    // what gets charged: 1 sen for a draft image.
    expect(body.generation.chargedSen).toBe(1);
    expect(body.generation.costEstimated).toBe(true);
    expect(findForbiddenCustomerFields(body)).toEqual([]);
  });

  it("serves the generated image bytes back to its owner only", async () => {
    await new ModelSeedService(env).seed();
    const testEnv = envWithStubAI({ image: PNG_B64 });
    const app = createApp();
    const owner = await signup(app, testEnv);
    const stranger = await signup(app, testEnv);
    await new LedgerService(env).deposit(owner.orgId, 5000);

    const created = await app.request(
      "/api/v1/generations",
      {
        method: "POST",
        headers: { cookie: owner.cookie, "content-type": "application/json", "x-csrf-token": owner.csrf },
        body: JSON.stringify({ modelId: FLUX, prompt: "private art" }),
      },
      testEnv,
    );
    const body = (await created.json()) as { generation: { outputs: { image: { assetId: string } } } };
    const assetId = body.generation.outputs.image.assetId;

    const mine = await app.request(`/api/v1/assets/${assetId}/content`, { headers: { cookie: owner.cookie } }, testEnv);
    expect(mine.status).toBe(200);
    expect(mine.headers.get("content-type")).toBe("image/png");

    const theirs = await app.request(`/api/v1/assets/${assetId}/content`, { headers: { cookie: stranger.cookie } }, testEnv);
    expect(theirs.status).toBe(404);
  });

  it("lists history newest first", async () => {
    await new ModelSeedService(env).seed();
    const testEnv = envWithStubAI({ image: PNG_B64 });
    const app = createApp();
    const user = await signup(app, testEnv);
    await new LedgerService(env).deposit(user.orgId, 5000);

    for (const prompt of ["first", "second"]) {
      await app.request(
        "/api/v1/generations",
        {
          method: "POST",
          headers: { cookie: user.cookie, "content-type": "application/json", "x-csrf-token": user.csrf },
          body: JSON.stringify({ modelId: FLUX, prompt }),
        },
        testEnv,
      );
    }

    const res = await app.request("/api/v1/generations", { headers: { cookie: user.cookie } }, testEnv);
    const body = (await res.json()) as { items: { prompt: string }[] };
    expect(body.items.map((i) => i.prompt)).toEqual(["second", "first"]);
  });
});
