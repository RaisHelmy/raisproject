import { Hono } from "hono";
import { z } from "zod";
import { AppError, hasScope } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { WebhookService, WEBHOOK_EVENTS, type WebhookEvent, type WebhookRow } from "../services/webhook-service";

export const webhooks = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

function toDTO(row: WebhookRow) {
  return {
    id: row.id,
    url: row.url,
    events: JSON.parse(row.events_json) as WebhookEvent[],
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

webhooks.get("/webhooks", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:read")) throw new AppError("insufficient_scope", "This token cannot read webhooks.");
  const list = await new WebhookService(c.env).list(auth);
  return c.json({ items: list.map(toDTO), availableEvents: WEBHOOK_EVENTS });
});

webhooks.post("/webhooks", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:write")) throw new AppError("insufficient_scope", "This token cannot create webhooks.");
  const body = z
    .object({ url: z.string().url(), events: z.array(z.enum(WEBHOOK_EVENTS)) })
    .parse(await c.req.json());

  const { webhook, secret } = await new WebhookService(c.env).create(auth, body);
  return c.json(
    {
      ...toDTO(webhook),
      // Shown once: it is what a receiver checks the signature against.
      secret,
      warning: "Copy this now. It cannot be shown again.",
    },
    201,
  );
});

webhooks.get("/webhooks/:id/deliveries", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:read")) throw new AppError("insufficient_scope", "This token cannot read webhooks.");
  return c.json({ items: await new WebhookService(c.env).deliveries(auth, c.req.param("id")) });
});

webhooks.delete("/webhooks/:id", ...guarded, async (c) => {
  const auth = c.get("auth");
  if (!hasScope(auth, "account:write")) throw new AppError("insufficient_scope", "This token cannot delete webhooks.");
  await new WebhookService(c.env).remove(auth, c.req.param("id"));
  return c.body(null, 204);
});
