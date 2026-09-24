import { AppError, newId, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { assertPublicUrl } from "../engine/nodes/http";

export const WEBHOOK_EVENTS = [
  "generation.completed",
  "generation.failed",
  "workflow.completed",
  "workflow.failed",
  "asset.created",
  "template.executed",
  "balance.low",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookRow {
  id: string;
  org_id: string;
  url: string;
  secret_hash: string;
  events_json: string;
  active: number;
  created_at: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  id: string;
  timestamp: string;
  resource: { type: string; id: string };
  status?: string;
  outputs?: unknown;
  cost?: { chargedSen: number; currency: string };
}

export interface DeliveryJob {
  kind: "webhook";
  deliveryId: string;
}

const MAX_ATTEMPTS = 5;
/** Exponential backoff, capped so a dead endpoint is not retried forever. */
const BACKOFF_SECONDS = [10, 60, 300, 1800];

/**
 * Outbound webhooks (§62).
 *
 * Payloads are signed with the endpoint's own secret so a receiver can prove a
 * request came from RaisAI. Delivery goes through the events queue and is
 * retried with backoff, because a customer's endpoint being briefly down must
 * not lose the notification.
 */
export class WebhookService {
  constructor(private readonly env: Pick<Env, "DB"> & Partial<Pick<Env, "EVENTS">>) {}

  async create(auth: AuthContext, input: { url: string; events: WebhookEvent[] }): Promise<{ webhook: WebhookRow; secret: string }> {
    // The same guard the HTTP node uses: a webhook must not be a way to reach
    // internal infrastructure.
    assertPublicUrl(input.url);

    const unknown = input.events.filter((e) => !WEBHOOK_EVENTS.includes(e));
    if (unknown.length > 0) {
      throw new AppError("invalid_input", `Unknown event: ${unknown.join(", ")}.`, {
        action: `Choose from: ${WEBHOOK_EVENTS.join(", ")}.`,
      });
    }
    if (input.events.length === 0) {
      throw new AppError("invalid_input", "Pick at least one event to send.");
    }

    const id = newId();
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
    await this.env.DB
      .prepare(`INSERT INTO webhooks (id, org_id, url, secret_hash, events_json, active, created_at) VALUES (?,?,?,?,?,1,?)`)
      .bind(id, auth.orgId, input.url, await sha256(secret), JSON.stringify(input.events), nowIso())
      .run();

    const webhook = await this.require(auth, id);
    return { webhook, secret };
  }

  async list(auth: AuthContext): Promise<WebhookRow[]> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM webhooks WHERE org_id = ? ORDER BY created_at DESC`)
      .bind(auth.orgId)
      .all<WebhookRow>();
    return results;
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    await this.require(auth, id);
    await this.env.DB.prepare(`DELETE FROM webhooks WHERE id = ? AND org_id = ?`).bind(id, auth.orgId).run();
  }

  async require(auth: AuthContext, id: string): Promise<WebhookRow> {
    const row = await this.env.DB
      .prepare(`SELECT * FROM webhooks WHERE id = ? AND org_id = ?`)
      .bind(id, auth.orgId)
      .first<WebhookRow>();
    if (!row) throw new AppError("not_found", "Webhook not found.");
    return row;
  }

  /** Queues one delivery per subscribed endpoint. Never throws into the caller. */
  async emit(orgId: string, payload: Omit<WebhookPayload, "id" | "timestamp">): Promise<number> {
    const { results } = await this.env.DB
      .prepare(`SELECT * FROM webhooks WHERE org_id = ? AND active = 1`)
      .bind(orgId)
      .all<WebhookRow>();

    const subscribed = results.filter((w) => (JSON.parse(w.events_json) as string[]).includes(payload.event));
    for (const webhook of subscribed) {
      const deliveryId = newId();
      const body: WebhookPayload = { ...payload, id: deliveryId, timestamp: nowIso() };
      await this.env.DB
        .prepare(
          `INSERT INTO webhook_deliveries (id, webhook_id, event, payload_json, status, attempts, created_at)
           VALUES (?,?,?,?, 'pending', 0, ?)`,
        )
        .bind(deliveryId, webhook.id, payload.event, JSON.stringify(body), nowIso())
        .run();
      await this.env.EVENTS?.send({ kind: "webhook", deliveryId } satisfies DeliveryJob).catch(() => undefined);
    }
    return subscribed.length;
  }

  /**
   * Sends one delivery. Returns whether it should be retried, so the queue
   * consumer decides rather than this deciding for it.
   */
  async deliver(deliveryId: string, fetchImpl: typeof fetch = fetch): Promise<{ delivered: boolean; retry: boolean }> {
    const delivery = await this.env.DB
      .prepare(
        `SELECT d.*, w.url, w.secret_hash FROM webhook_deliveries d
           JOIN webhooks w ON w.id = d.webhook_id WHERE d.id = ?`,
      )
      .bind(deliveryId)
      .first<{ id: string; webhook_id: string; payload_json: string; attempts: number; url: string; secret_hash: string; status: string }>();

    if (!delivery || delivery.status === "delivered") return { delivered: true, retry: false };

    const attempt = delivery.attempts + 1;
    const signature = await signPayload(delivery.secret_hash, delivery.payload_json);

    try {
      const response = await fetchImpl(delivery.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-raisai-signature": signature,
          "x-raisai-delivery": delivery.id,
        },
        body: delivery.payload_json,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        await this.env.DB
          .prepare(`UPDATE webhook_deliveries SET status='delivered', attempts=?, next_retry_at=NULL WHERE id=?`)
          .bind(attempt, deliveryId)
          .run();
        return { delivered: true, retry: false };
      }
      return this.recordFailure(deliveryId, attempt, `HTTP ${response.status}`);
    } catch (error) {
      return this.recordFailure(deliveryId, attempt, error instanceof Error ? error.message : String(error));
    }
  }

  private async recordFailure(deliveryId: string, attempt: number, reason: string): Promise<{ delivered: boolean; retry: boolean }> {
    const exhausted = attempt >= MAX_ATTEMPTS;
    const nextRetry = exhausted
      ? null
      : new Date(Date.now() + (BACKOFF_SECONDS[attempt - 1] ?? 1800) * 1000).toISOString();

    await this.env.DB
      .prepare(`UPDATE webhook_deliveries SET status=?, attempts=?, last_error=?, next_retry_at=? WHERE id=?`)
      .bind(exhausted ? "failed" : "pending", attempt, reason, nextRetry, deliveryId)
      .run();
    return { delivered: false, retry: !exhausted };
  }

  async deliveries(auth: AuthContext, webhookId: string): Promise<{ id: string; event: string; status: string; attempts: number; lastError: string | null; createdAt: string }[]> {
    await this.require(auth, webhookId);
    const { results } = await this.env.DB
      .prepare(`SELECT id, event, status, attempts, last_error, created_at FROM webhook_deliveries WHERE webhook_id = ? ORDER BY id DESC LIMIT 50`)
      .bind(webhookId)
      .all<{ id: string; event: string; status: string; attempts: number; last_error: string | null; created_at: string }>();
    return results.map((r) => ({
      id: r.id, event: r.event, status: r.status, attempts: r.attempts,
      lastError: r.last_error, createdAt: r.created_at,
    }));
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC over the exact bytes sent, so a receiver can verify without ambiguity. */
export async function signPayload(secretHash: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretHash),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `sha256=${[...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
