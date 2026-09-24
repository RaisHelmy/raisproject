/**
 * Stripe-ready billing over the REST API (no SDK): Checkout Sessions, Customer Portal, and signed webhooks.
 * When STRIPE_SECRET_KEY is absent the app runs in "manual" mode: admins assign plans from the admin panel.
 */
import type { AppContext, AuthUser } from "./context";
import { Errors } from "../lib/errors";
import { hmacHex, timingSafeEqualString } from "../lib/crypto";
import { entitlements } from "./entitlements";
import { audit } from "./audit";
import type { PlanRow } from "../repositories/types";

export function stripeConfigured(ctx: AppContext): boolean { return !!ctx.env.STRIPE_SECRET_KEY; }

async function stripe<T>(ctx: AppContext, path: string, form?: Record<string, string>): Promise<T> {
  const r = await fetch(`https://api.stripe.com/v1${path}`, { method: form ? "POST" : "GET", headers: { Authorization: `Bearer ${ctx.env.STRIPE_SECRET_KEY}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: form ? new URLSearchParams(form) : undefined });
  const j = (await r.json()) as T & { error?: { message: string } };
  if (!r.ok) throw Errors.provider(`Stripe: ${j.error?.message ?? r.status}`, ctx.correlationId);
  return j;
}

export async function createCheckout(ctx: AppContext, user: AuthUser, plan: PlanRow): Promise<{ url: string }> {
  if (!stripeConfigured(ctx)) throw Errors.notConfigured("Billing is not configured yet. An administrator can assign plans manually.");
  if (!plan.stripe_price_id) throw Errors.notConfigured(`The ${plan.name} plan has no Stripe price configured.`);
  const existing = await ctx.repos.subscriptions.activeForUser(user.id);
  const form: Record<string, string> = {
    mode: "subscription", "line_items[0][price]": plan.stripe_price_id, "line_items[0][quantity]": "1",
    success_url: `${ctx.env.WEB_ORIGIN}/app/subscription?checkout=success`, cancel_url: `${ctx.env.WEB_ORIGIN}/pricing?checkout=cancel`,
    client_reference_id: user.id, "metadata[user_id]": user.id, "metadata[plan_id]": plan.id, "subscription_data[metadata][user_id]": user.id, "subscription_data[metadata][plan_id]": plan.id,
    allow_promotion_codes: "true",
  };
  if (existing?.stripe_customer_id) form.customer = existing.stripe_customer_id; else form.customer_email = user.email;
  const s = await stripe<{ url: string }>(ctx, "/checkout/sessions", form);
  return { url: s.url };
}

export async function createPortal(ctx: AppContext, user: AuthUser): Promise<{ url: string }> {
  if (!stripeConfigured(ctx)) throw Errors.notConfigured("Billing is not configured.");
  const sub = await ctx.repos.subscriptions.activeForUser(user.id);
  if (!sub?.stripe_customer_id) throw Errors.validation("No billing account found for this user.");
  const s = await stripe<{ url: string }>(ctx, "/billing_portal/sessions", { customer: sub.stripe_customer_id, return_url: `${ctx.env.WEB_ORIGIN}/app/subscription` });
  return { url: s.url };
}

/** Verify `Stripe-Signature` (t=…,v1=…) against the raw body. */
export async function verifyStripeSignature(secret: string, header: string | undefined, body: string, toleranceSec = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t; const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  return timingSafeEqualString(await hmacHex(`${t}.${body}`, secret), v1);
}

interface StripeSubscription { id: string; customer: string; status: string; cancel_at_period_end: boolean; current_period_start: number; current_period_end: number; metadata?: { user_id?: string; plan_id?: string }; items?: { data: { price: { id: string } }[] } }

export async function handleStripeEvent(ctx: AppContext, event: { type: string; data: { object: Record<string, unknown> } }): Promise<void> {
  const repos = ctx.repos;
  const upsert = async (s: StripeSubscription) => {
    const priceId = s.items?.data[0]?.price.id;
    const plans = await repos.plans.listAll();
    const plan = plans.find((p) => p.id === s.metadata?.plan_id) ?? plans.find((p) => p.stripe_price_id === priceId);
    if (!plan) { ctx.log.warn("stripe_unknown_plan", { price: priceId }); return; }
    const status = (["active", "trialing", "past_due", "canceled", "incomplete"].includes(s.status) ? s.status : s.status === "unpaid" ? "past_due" : "canceled") as "active";
    const existing = await repos.subscriptions.findByStripeSubscription(s.id);
    const userId = s.metadata?.user_id ?? existing?.user_id ?? (await repos.subscriptions.findByStripeCustomer(s.customer))?.user_id ?? null;
    if (!userId) { ctx.log.warn("stripe_unknown_user", { customer: s.customer }); return; }
    const patch = { plan_id: plan.id, status, stripe_customer_id: s.customer, current_period_start: new Date(s.current_period_start * 1000).toISOString(), current_period_end: new Date(s.current_period_end * 1000).toISOString(), cancel_at_period_end: s.cancel_at_period_end, managed_by: "stripe" };
    let id = existing?.id;
    if (existing) await repos.subscriptions.update(existing.id, patch);
    else id = (await repos.subscriptions.create({ user_id: userId, organization_id: null, ...patch, stripe_subscription_id: s.id }))!.id;
    if (id && status === "active") await repos.subscriptions.cancelOthersForUser(userId, id);
    await entitlements(ctx).invalidate(userId);
    await audit(ctx, { action: `billing.${event.type}`, resource_type: "subscription", resource_id: id ?? null, actor_id: null, details: { plan: plan.code, status } });
  };
  switch (event.type) {
    case "checkout.session.completed": {
      const sess = event.data.object as { subscription?: string };
      if (sess.subscription) await upsert(await stripe<StripeSubscription>(ctx, `/subscriptions/${sess.subscription}`));
      break;
    }
    case "customer.subscription.created": case "customer.subscription.updated": case "customer.subscription.deleted":
      await upsert(event.data.object as unknown as StripeSubscription); break;
    default: ctx.log.info("stripe_event_ignored", { type: event.type });
  }
}

/** Admin assignment (no Stripe): creates an admin-managed subscription and cancels other active ones. */
export async function assignPlan(ctx: AppContext, target: { user_id?: string; organization_id?: string }, planId: string): Promise<void> {
  const plan = await ctx.repos.plans.findById(planId);
  if (!plan) throw Errors.notFound("Plan");
  const s = (await ctx.repos.subscriptions.create({ user_id: target.user_id ?? null, organization_id: target.organization_id ?? null, plan_id: plan.id, status: "active", managed_by: "admin" }))!;
  if (target.user_id) { await ctx.repos.subscriptions.cancelOthersForUser(target.user_id, s.id); await entitlements(ctx).invalidate(target.user_id); }
  if (target.organization_id) { await ctx.repos.subscriptions.cancelOthersForOrg(target.organization_id, s.id); for (const m of await ctx.repos.organizations.members(target.organization_id)) await entitlements(ctx).invalidate(m.user_id); }
  await audit(ctx, { action: "admin.plan_assigned", resource_type: target.user_id ? "user" : "organization", resource_id: target.user_id ?? target.organization_id ?? null, details: { plan: plan.code } });
}
