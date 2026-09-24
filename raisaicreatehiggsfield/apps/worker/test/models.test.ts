import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { SEED_MODELS } from "@raisai/seed-models";
import { findForbiddenCustomerFields, newId } from "@raisai/shared";
import { createApp } from "../src/app";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ModelService } from "../src/services/model-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";

async function session(app: ReturnType<typeof createApp>, opts: { admin?: boolean } = {}) {
  const res = await app.request(
    "/api/v1/auth/signup",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `m-${newId()}@example.com`, password: "password123", name: "Model User" }),
    },
    env,
  );
  const cookies = res.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith("rais_session="))!.split(";")[0]!;
  const csrfCookie = cookies.find((c) => c.startsWith("rais_csrf="))!.split(";")[0]!;
  const body = (await res.json()) as { user: { id: string } };
  if (opts.admin) await env.DB.prepare(`UPDATE users SET role='admin' WHERE id = ?`).bind(body.user.id).run();
  return { cookie: `${session}; ${csrfCookie}`, csrf: csrfCookie.split("=").slice(1).join("=") };
}

describe("model registry", () => {
  it("seeds the curated catalog idempotently", async () => {
    const seeder = new ModelSeedService(env);
    const first = await seeder.seed();
    const second = await seeder.seed();
    expect(first.seeded).toBe(SEED_MODELS.length);
    expect(second.seeded).toBe(SEED_MODELS.length);

    // Re-seeding must not duplicate: every seeded model appears exactly once.
    for (const model of SEED_MODELS) {
      const row = await env.DB
        .prepare(`SELECT COUNT(*) AS n FROM models WHERE id = ?`).bind(model.definition.id).first<{ n: number }>();
      expect(row!.n, model.definition.id).toBe(1);
      if (model.pricing) {
        const priced = await env.DB
          .prepare(`SELECT COUNT(*) AS n FROM model_pricing WHERE model_id = ?`).bind(model.definition.id).first<{ n: number }>();
        expect(priced!.n, `${model.definition.id} pricing`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("never seeds a model as enabled without a verified provider rate", () => {
    // Guards the rule that nobody is charged against a guessed price.
    for (const model of SEED_MODELS) {
      if (model.definition.status === "enabled") {
        expect(model.pricing, `${model.definition.id} is enabled without pricing`).toBeDefined();
      } else {
        expect(model.notEnabledReason, `${model.definition.id} needs a reason`).toBeTruthy();
      }
    }
  });

  it("hides non-enabled models from customers but shows them to admins", async () => {
    await new ModelSeedService(env).seed();
    const service = new ModelService(env);
    const customerVisible = await service.list();
    const all = await service.list({ includeAllStatuses: true });

    expect(customerVisible.every((m) => m.status === "enabled")).toBe(true);
    expect(all.length).toBeGreaterThan(customerVisible.length);
    await expect(service.getEnabled("@cf/bytedance/stable-diffusion-xl-lightning")).rejects.toMatchObject({
      code: "model_not_enabled",
    });
  });

  it("filters by capability, not by model id", async () => {
    await new ModelSeedService(env).seed();
    const service = new ModelService(env);
    const withImageInput = await service.findCompatible(["image-input"]);
    const imageModels = await service.list({ category: "image" });

    // flux-1-schnell generates images but takes no image input; the filter must
    // exclude it without any model-id special casing.
    expect(imageModels.map((m) => m.id)).toContain("@cf/black-forest-labs/flux-1-schnell");
    expect(withImageInput.map((m) => m.id)).not.toContain("@cf/black-forest-labs/flux-1-schnell");
    expect(withImageInput.map((m) => m.id)).toContain("@cf/meta/llama-3.2-11b-vision-instruct");
  });

  it("explains an incompatible model in words a user can act on", async () => {
    await new ModelSeedService(env).seed();
    const service = new ModelService(env);
    const flux = await service.getEnabled("@cf/black-forest-labs/flux-1-schnell");
    expect(() => service.assertSupports(flux, ["image-input"])).toThrowError(/does not support image references/);
  });

  it("serves models over the API without leaking internals", async () => {
    await new ModelSeedService(env).seed();
    const app = createApp();
    const user = await session(app);
    const res = await app.request("/api/v1/models?group=recommended", { headers: { cookie: user.cookie } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; tags: string[] }[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((m) => m.tags.includes("recommended"))).toBe(true);
    expect(findForbiddenCustomerFields(body)).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("hosting");
    expect(JSON.stringify(body)).not.toContain("status");
  });

  it("requires admin for the full catalog", async () => {
    const app = createApp();
    const user = await session(app);
    const res = await app.request("/api/v1/admin/models", { headers: { cookie: user.cookie } }, env);
    expect(res.status).toBe(403);
  });
});

describe("FakeAIProvider", () => {
  it("produces deterministic output and usage for an image model", async () => {
    await new ModelSeedService(env).seed();
    const model = await new ModelService(env).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const provider = new FakeAIProvider();
    const job = await provider.execute(model, { prompt: "a cat", width: 1024, height: 1024 }, { requestId: "r1" });

    expect(job.status).toBe("completed");
    expect(job.output?.image?.mime).toBe("image/png");
    expect(job.usage?.unit).toBe("megapixel_tiered");
    expect(provider.calls).toHaveLength(1);
  });

  it("injects failures a configured number of times", async () => {
    await new ModelSeedService(env).seed();
    const model = await new ModelService(env).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const provider = new FakeAIProvider();
    provider.failNext(model.id, { code: "provider_timeout", message: "Timed out.", retryable: true, times: 1 });

    const failed = await provider.execute(model, { prompt: "x" }, { requestId: "r1" });
    expect(failed.status).toBe("failed");
    expect(failed.error?.retryable).toBe(true);

    const recovered = await provider.execute(model, { prompt: "x" }, { requestId: "r2" });
    expect(recovered.status).toBe("completed");
  });

  it("rejects image input for a model that cannot take it", async () => {
    await new ModelSeedService(env).seed();
    const service = new ModelService(env);
    const flux = await service.getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const provider = new FakeAIProvider();
    const result = provider.validateInput(flux, { prompt: "x", images: [{ mime: "image/png" }] });
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.action).toMatch(/supports image input/);
  });

  it("simulates an async job that completes on a later poll", async () => {
    await new ModelSeedService(env).seed();
    const model = await new ModelService(env).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const provider = new FakeAIProvider({ async: true });
    const started = await provider.execute(model, { prompt: "x" }, { requestId: "r1" });
    expect(started.status).toBe("queued");

    const running = await provider.getJob(started.handle!);
    expect(running.status).toBe("running");
    const done = await provider.getJob(started.handle!);
    expect(done.status).toBe("completed");
    expect(done.output?.image).toBeDefined();
  });
});
