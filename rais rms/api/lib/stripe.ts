/**
 * Minimal Stripe REST client over fetch — Workers-compatible (the official
 * stripe-node SDK assumes Node APIs and doesn't run reliably on Workers).
 * Only the calls this app needs: create/retrieve a PaymentIntent, and verify
 * webhook signatures.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export class StripeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function toFormBody(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.set(k, String(v));
  }
  return usp.toString();
}

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  status: string;
  amount: number;
  currency: string;
}

export async function createPaymentIntent(
  secretKey: string,
  input: { amountMinor: number; currency: string; metadata: Record<string, string>; description?: string },
): Promise<StripePaymentIntent> {
  const res = await fetch(`${STRIPE_API_BASE}/payment_intents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody({
      amount: input.amountMinor,
      currency: input.currency.toLowerCase(),
      description: input.description,
      ...Object.fromEntries(Object.entries(input.metadata).map(([k, v]) => [`metadata[${k}]`, v])),
    }),
  });

  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new StripeError(json?.error?.message ?? "Stripe request failed", res.status);
  }
  return json as StripePaymentIntent;
}

export async function retrievePaymentIntent(secretKey: string, id: string): Promise<StripePaymentIntent> {
  const res = await fetch(`${STRIPE_API_BASE}/payment_intents/${id}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new StripeError(json?.error?.message ?? "Stripe request failed", res.status);
  }
  return json as StripePaymentIntent;
}

/**
 * Verifies a Stripe webhook signature: header is `t=<timestamp>,v1=<hex hmac>`,
 * where the hmac is SHA-256 over `${timestamp}.${rawBody}` keyed by the
 * endpoint's webhook secret. Rejects signatures older than 5 minutes (replay).
 */
export async function verifyStripeWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signatureHeader: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string]),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const age = Date.now() / 1000 - Number(timestamp);
  if (Number.isNaN(age) || age > 300 || age < -60) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
