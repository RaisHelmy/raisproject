import { describe, expect, test, afterEach, mock } from "bun:test";
import { createPaymentIntent, verifyStripeWebhookSignature, StripeError } from "../../api/lib/stripe";

describe("stripe webhook signature verification", () => {
  async function sign(secret: string, timestamp: number, body: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
    return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  test("accepts a correctly signed, fresh payload", async () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ type: "payment_intent.succeeded" });
    const timestamp = Math.floor(Date.now() / 1000);
    const v1 = await sign(secret, timestamp, body);
    const header = `t=${timestamp},v1=${v1}`;

    expect(await verifyStripeWebhookSignature(secret, body, header)).toBe(true);
  });

  test("rejects a tampered body", async () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ type: "payment_intent.succeeded" });
    const timestamp = Math.floor(Date.now() / 1000);
    const v1 = await sign(secret, timestamp, body);
    const header = `t=${timestamp},v1=${v1}`;

    const tampered = JSON.stringify({ type: "payment_intent.succeeded", amount: 999999999 });
    expect(await verifyStripeWebhookSignature(secret, tampered, header)).toBe(false);
  });

  test("rejects a stale timestamp (replay protection)", async () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ type: "payment_intent.succeeded" });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 3600;
    const v1 = await sign(secret, oldTimestamp, body);
    const header = `t=${oldTimestamp},v1=${v1}`;

    expect(await verifyStripeWebhookSignature(secret, body, header)).toBe(false);
  });

  test("rejects a malformed header", async () => {
    expect(await verifyStripeWebhookSignature("secret", "{}", "not-a-valid-header")).toBe(false);
  });
});

describe("createPaymentIntent", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("posts the right amount/currency/metadata and returns the parsed intent", async () => {
    let capturedUrl = "";
    let capturedBody = "";
    global.fetch = mock(async (url: string, init: any) => {
      capturedUrl = url;
      capturedBody = init.body;
      return new Response(
        JSON.stringify({ id: "pi_123", client_secret: "pi_123_secret", status: "requires_payment_method", amount: 5000, currency: "usd" }),
        { status: 200 },
      );
    }) as any;

    const intent = await createPaymentIntent("sk_test_123", {
      amountMinor: 5000,
      currency: "USD",
      metadata: { reservationId: "res_1" },
      description: "Deposit",
    });

    expect(capturedUrl).toBe("https://api.stripe.com/v1/payment_intents");
    expect(capturedBody).toContain("amount=5000");
    expect(capturedBody).toContain("currency=usd");
    expect(capturedBody).toContain("metadata%5BreservationId%5D=res_1");
    expect(intent.id).toBe("pi_123");
    expect(intent.client_secret).toBe("pi_123_secret");
  });

  test("throws StripeError with Stripe's message on failure", async () => {
    global.fetch = mock(async () => new Response(JSON.stringify({ error: { message: "Your card was declined." } }), { status: 402 })) as any;

    await expect(
      createPaymentIntent("sk_test_bad", { amountMinor: 100, currency: "usd", metadata: {} }),
    ).rejects.toBeInstanceOf(StripeError);
  });
});
