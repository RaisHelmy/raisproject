import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { newId, SCOPES, type AuthContext } from "@raisai/shared";
import { WebhookService, signPayload } from "../src/services/webhook-service";
import { GenerationService } from "../src/services/generation-service";
import { LedgerService } from "../src/services/ledger-service";
import { ModelSeedService } from "../src/services/model-seed-service";
import { FakeAIProvider } from "../src/providers/fake/fake-provider";
import { registerBuiltinNodes } from "../src/engine/nodes";

const FLUX = "@cf/black-forest-labs/flux-1-schnell";

async function context(): Promise<AuthContext> {
  const userId = newId();
  const orgId = newId();
  await env.DB.prepare(`INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)`)
    .bind(userId, `${userId}@example.com`, "h", "Hook").run();
  await env.DB.prepare(`INSERT INTO organizations (id,name,kind,owner_user_id) VALUES (?,?,'personal',?)`)
    .bind(orgId, "W", userId).run();
  await env.DB.prepare(`INSERT INTO balances (org_id) VALUES (?)`).bind(orgId).run();
  return { userId, orgId, actorType: "user", scopes: SCOPES, requestId: newId(), isAdmin: false };
}

describe("webhooks", () => {
  it("refuses an endpoint that points at internal infrastructure", async () => {
    const auth = await context();
    await expect(
      new WebhookService(env).create(auth, { url: "http://169.254.169.254/latest/meta-data", events: ["generation.completed"] }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("shows the signing secret once and stores only a hash", async () => {
    const auth = await context();
    const { webhook, secret } = await new WebhookService(env).create(auth, {
      url: "https://example.com/hook", events: ["generation.completed"],
    });
    expect(secret).toMatch(/^whsec_/);
    expect(webhook.secret_hash).not.toContain(secret);
  });

  it("queues a delivery only for endpoints subscribed to that event", async () => {
    const auth = await context();
    const service = new WebhookService(env);
    await service.create(auth, { url: "https://example.com/a", events: ["generation.completed"] });
    await service.create(auth, { url: "https://example.com/b", events: ["balance.low"] });

    const queued = await service.emit(auth.orgId, {
      event: "generation.completed",
      resource: { type: "generation", id: "gen1" },
      cost: { chargedSen: 38, currency: "MYR" },
    });
    expect(queued).toBe(1);
  });

  it("signs the exact bytes it sends, so a receiver can verify them", async () => {
    const auth = await context();
    const service = new WebhookService(env);
    const { webhook } = await service.create(auth, { url: "https://example.com/hook", events: ["generation.completed"] });
    await service.emit(auth.orgId, { event: "generation.completed", resource: { type: "generation", id: "gen1" } });

    const delivery = await env.DB
      .prepare(`SELECT id, payload_json FROM webhook_deliveries WHERE webhook_id = ?`).bind(webhook.id)
      .first<{ id: string; payload_json: string }>();

    let seenBody = "";
    let seenSignature = "";
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      seenBody = String(init?.body ?? "");
      seenSignature = new Headers(init?.headers).get("x-raisai-signature") ?? "";
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await service.deliver(delivery!.id, fetchImpl);
    expect(result.delivered).toBe(true);
    expect(seenBody).toBe(delivery!.payload_json);
    expect(seenSignature).toBe(await signPayload(webhook.secret_hash, seenBody));
  });

  it("retries a failing endpoint, then gives up rather than retrying forever", async () => {
    const auth = await context();
    const service = new WebhookService(env);
    const { webhook } = await service.create(auth, { url: "https://example.com/down", events: ["generation.completed"] });
    await service.emit(auth.orgId, { event: "generation.completed", resource: { type: "generation", id: "gen1" } });
    const delivery = await env.DB
      .prepare(`SELECT id FROM webhook_deliveries WHERE webhook_id = ?`).bind(webhook.id).first<{ id: string }>();

    const failing = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;

    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = await service.deliver(delivery!.id, failing);
      expect(result.retry, `attempt ${attempt} should still retry`).toBe(true);
    }
    const final = await service.deliver(delivery!.id, failing);
    expect(final.retry).toBe(false);

    const row = await env.DB
      .prepare(`SELECT status, attempts, last_error FROM webhook_deliveries WHERE id = ?`).bind(delivery!.id)
      .first<{ status: string; attempts: number; last_error: string }>();
    expect(row).toMatchObject({ status: "failed", attempts: 5 });
    expect(row!.last_error).toContain("500");
  });

  it("records the delivery history an operator needs to debug it", async () => {
    const auth = await context();
    const service = new WebhookService(env);
    const { webhook } = await service.create(auth, { url: "https://example.com/hook", events: ["generation.completed"] });
    await service.emit(auth.orgId, { event: "generation.completed", resource: { type: "generation", id: "gen1" } });

    const history = await service.deliveries(auth, webhook.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ event: "generation.completed", status: "pending", attempts: 0 });
  });

  it("keeps webhooks scoped to their workspace", async () => {
    const owner = await context();
    const stranger = await context();
    const { webhook } = await new WebhookService(env).create(owner, {
      url: "https://example.com/private", events: ["generation.completed"],
    });
    await expect(new WebhookService(env).require(stranger, webhook.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("low balance", () => {
  it("warns once when the balance drops below the threshold", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    const ledger = new LedgerService(env);
    // Just above the RM5.00 default threshold, so one generation crosses it.
    await ledger.deposit(auth.orgId, 501);

    const service = new GenerationService(env);
    await service.create(auth, { modelId: FLUX, prompt: "one", provider: new FakeAIProvider() });
    await service.create(auth, { modelId: FLUX, prompt: "two", provider: new FakeAIProvider() });

    const { results } = await env.DB
      .prepare(`SELECT id FROM audit_log WHERE org_id = ? AND event = 'balance.low'`)
      .bind(auth.orgId)
      .all();
    // Crossed once, warned once: a busy workspace is not spammed (§122).
    expect(results).toHaveLength(1);
  });

  it("does not warn while the balance is healthy", async () => {
    registerBuiltinNodes();
    await new ModelSeedService(env).seed();
    const auth = await context();
    await new LedgerService(env).deposit(auth.orgId, 50000);
    await new GenerationService(env).create(auth, { modelId: FLUX, prompt: "rich", provider: new FakeAIProvider() });

    const row = await env.DB
      .prepare(`SELECT id FROM audit_log WHERE org_id = ? AND event = 'balance.low'`).bind(auth.orgId).first();
    expect(row).toBeNull();
  });
});
