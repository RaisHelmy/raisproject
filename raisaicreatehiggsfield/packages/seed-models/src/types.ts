import type { ModelDefinition, PricingUnit } from "@raisai/shared";

/**
 * Provider rates in USD, transcribed verbatim from Cloudflare's public pricing
 * page. The customer price is derived from these at runtime
 * (BILLING.md: providerUsd -> fx -> markup -> rounding); these numbers are
 * admin-only and never reach a customer payload.
 */
export interface SeedPricing {
  unit: PricingUnit;
  /** Keyed by measure name, USD per unit of that measure. */
  providerUsd: Record<string, number>;
  /** Where the rate came from, so it can be re-verified. */
  source: string;
  verifiedOn: string;
}

export interface SeedModel {
  definition: ModelDefinition;
  /** Absent when Cloudflare publishes no rate: such models stay `discovered`. */
  pricing?: SeedPricing;
  /** Why a model is not enabled, shown to admins in the catalog view. */
  notEnabledReason?: string;
}
