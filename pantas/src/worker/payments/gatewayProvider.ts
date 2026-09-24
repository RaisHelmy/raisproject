export interface ChargeInput {
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  description: string;
}

export interface ChargeResult {
  transactionId: string;
  status: "succeeded" | "failed";
  provider: string;
}

export interface PaymentGatewayProvider {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

/**
 * Stands in for a real gateway (Billplz, Stripe, iPay88, etc. — common
 * choices for a Malaysia-facing product) until real merchant credentials
 * exist. Always "succeeds" and never touches a network. THIS IS NOT
 * PRODUCTION-READY — swap it for a real provider implementing the same
 * PaymentGatewayProvider interface, wired to real API keys via
 * `wrangler secret put`, before any real money is meant to move through
 * the `gateway` payment method. Left explicitly as a stub rather than
 * guessing at a specific provider's API — see CLAUDE.md build order Step 12.
 */
export class SandboxGatewayProvider implements PaymentGatewayProvider {
  async charge(input: ChargeInput): Promise<ChargeResult> {
    return {
      transactionId: `sandbox_${crypto.randomUUID()}`,
      status: "succeeded",
      provider: "sandbox",
    };
  }
}

export function getGatewayProvider(_env: Env): PaymentGatewayProvider {
  return new SandboxGatewayProvider();
}
