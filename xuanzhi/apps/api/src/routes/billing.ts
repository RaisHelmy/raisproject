import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { rateLimit, requireAuth } from "../middleware";
import { ok } from "../lib/http";
import { Errors } from "../lib/errors";
import { createCheckout, createPortal, handleStripeEvent, stripeConfigured, verifyStripeSignature } from "../services/billing";
import { entitlements } from "../services/entitlements";
import { toPlanDTO } from "../services/mappers";

const router = new Hono<HonoEnv>();

router.get("/subscription", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const eff = await entitlements(ctx).effectivePlan(ctx.user!);
  const sub = await ctx.repos.subscriptions.activeForUser(ctx.user!.id);
  return ok(c, { id: sub?.id ?? null, plan: toPlanDTO(eff.plan), source: eff.source, status: sub?.status ?? "active", current_period_end: sub?.current_period_end ?? null, cancel_at_period_end: sub?.cancel_at_period_end ?? false, stripe_configured: stripeConfigured(ctx), managed_by: sub ? sub.managed_by : "none" });
});

router.post("/checkout", requireAuth, rateLimit(10, 600, "checkout"), async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ plan_id: z.string().uuid() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Choose a plan.");
  const plan = await ctx.repos.plans.findById(body.data.plan_id);
  if (!plan || !plan.is_active) throw Errors.notFound("Plan");
  if (plan.code === "enterprise") throw Errors.validation("Enterprise plans are set up by our team. Please contact sales.");
  return ok(c, await createCheckout(ctx, ctx.user!, plan));
});

router.post("/portal", requireAuth, async (c) => ok(c, await createPortal(c.get("ctx"), c.get("ctx").user!)));

/** Stripe webhook: raw body + signature verification; no session, no CSRF. */
router.post("/webhook", async (c) => {
  const ctx = c.get("ctx");
  if (!ctx.env.STRIPE_WEBHOOK_SECRET) throw Errors.notConfigured("Stripe webhook secret not set.");
  const raw = await c.req.text();
  if (!(await verifyStripeSignature(ctx.env.STRIPE_WEBHOOK_SECRET, c.req.header("stripe-signature"), raw))) throw Errors.unauthorized("Invalid Stripe signature.");
  const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
  await handleStripeEvent(ctx, event);
  return ok(c, { received: true });
});

export default router;
