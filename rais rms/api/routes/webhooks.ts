import { Hono } from "hono";
import type { AppEnv } from "../types";
import { verifyStripeWebhookSignature } from "../lib/stripe";
import { getPaymentByProviderRef, setPaymentStatus } from "../db/payments";
import { setReservationDeposit } from "../db/reservations";
import { badRequest, forbidden } from "../lib/errors";

export const webhookRoutes = new Hono<AppEnv>();

/**
 * Stripe webhook — no session, no tenant middleware. The tenant is derived
 * from the payment row (looked up by the PaymentIntent id), never trusted
 * from the request. Signature verification is mandatory: without it anyone
 * could POST a fake "payment succeeded" event.
 */
webhookRoutes.post("/stripe", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) throw badRequest("Stripe webhooks not configured");

  const signature = c.req.header("Stripe-Signature");
  if (!signature) throw forbidden("Missing signature");

  const rawBody = await c.req.text();
  const valid = await verifyStripeWebhookSignature(c.env.STRIPE_WEBHOOK_SECRET, rawBody, signature);
  if (!valid) throw forbidden("Invalid signature");

  const event = JSON.parse(rawBody) as { type: string; data: { object: { id: string } } };
  const intentId = event.data.object.id;

  const payment = await getPaymentByProviderRef(c.env.DB, intentId);
  if (!payment) {
    // Unknown PaymentIntent for this app — ack anyway so Stripe stops retrying.
    return c.json({ ok: true, data: { ignored: true } });
  }

  if (event.type === "payment_intent.succeeded") {
    await setPaymentStatus(c.env.DB, payment.tenant_id, payment.id, "captured");
    if (payment.reservation_id && payment.type === "deposit") {
      await setReservationDeposit(c.env.DB, payment.tenant_id, payment.reservation_id, payment.id);
    }
  } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    await setPaymentStatus(c.env.DB, payment.tenant_id, payment.id, "failed");
  }

  return c.json({ ok: true, data: { received: true } });
});
