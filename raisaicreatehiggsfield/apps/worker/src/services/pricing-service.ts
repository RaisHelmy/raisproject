import { AppError, type ModelDefinition, type PricingUnit, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import type { PgDatabase } from "../db/client";
import type { CanonicalInput, ProviderUsage } from "../providers/types";
import {
  DEFAULT_POLICY,
  measuresForInput,
  providerUsdFor,
  toCustomerSen,
  type Measures,
  type PricingPolicy,
} from "../billing/pricing";

export interface CostEstimate {
  estimatedSen: Sen;
  /** Shown as "Estimated from current provider pricing" when true (§5). */
  approximate: boolean;
  unit: PricingUnit;
  measures: Measures;
  /** Admin-only. Never serialized into a customer DTO (ADR-006). */
  providerCostMicroUsd: number;
}

interface PricingRow {
  unit: PricingUnit;
  provider_price_json: string;
  markup_percent: number;
  minimum_charge_sen: number;
  rounding_sen: number;
  fx_rate_usd_myr: number;
}

export class PricingService {
  private readonly db: PgDatabase;
  private readonly cache = new Map<string, { rates: Record<string, number>; unit: PricingUnit; policy: PricingPolicy }>();

  constructor(env: Pick<Env, "DB">) {
    this.db = env.DB;
  }

  /** Cost before running. Used for the Generate button and workflow previews. */
  async estimate(model: ModelDefinition, input: CanonicalInput): Promise<CostEstimate> {
    const { unit, rates, policy } = await this.loadPricing(model.id);
    const { measures, approximate } = measuresForInput(model, unit, input);
    const providerUsd = providerUsdFor(unit, rates, measures);
    return {
      estimatedSen: toCustomerSen(providerUsd, policy),
      approximate,
      unit,
      measures,
      providerCostMicroUsd: Math.round(providerUsd * 1_000_000),
    };
  }

  /**
   * Cost after running, from what the provider says it consumed. Falls back to
   * the estimate when a provider reports no usage; the caller then records
   * cost_basis 'estimated' (BILLING.md).
   */
  async actual(model: ModelDefinition, usage: ProviderUsage | undefined, fallback: CostEstimate): Promise<{ actualSen: Sen; basis: "actual" | "estimated"; providerCostMicroUsd: number }> {
    if (!usage) {
      return { actualSen: fallback.estimatedSen, basis: "estimated", providerCostMicroUsd: fallback.providerCostMicroUsd };
    }
    const { unit, rates, policy } = await this.loadPricing(model.id);

    // The configured unit is authoritative. If a provider reports usage in a
    // different unit we cannot convert it, and pricing the mismatched measures
    // would silently charge zero, so the estimate stands instead.
    if (usage.unit !== unit) {
      return { actualSen: fallback.estimatedSen, basis: "estimated", providerCostMicroUsd: fallback.providerCostMicroUsd };
    }
    const providerUsd = providerUsdFor(usage.unit, rates, usage.measures);
    return {
      actualSen: toCustomerSen(providerUsd, policy),
      basis: "actual",
      providerCostMicroUsd: usage.providerCostMicroUsd ?? Math.round(providerUsd * 1_000_000),
    };
  }

  private async loadPricing(modelId: string): Promise<{ unit: PricingUnit; rates: Record<string, number>; policy: PricingPolicy }> {
    const cached = this.cache.get(modelId);
    if (cached) return cached;

    const row = await this.db
      .prepare(
        `SELECT unit, provider_price_json, markup_percent, minimum_charge_sen, rounding_sen, fx_rate_usd_myr
         FROM model_pricing WHERE model_id = ? ORDER BY effective_from DESC LIMIT 1`,
      )
      .bind(modelId)
      .first<PricingRow>();

    if (!row) {
      // Refusing to guess is deliberate: a model with no configured rate must
      // not be billable (seeded models without a published rate stay discovered).
      throw new AppError("model_not_enabled", "This model has no pricing configured yet.", {
        action: "Choose another model.",
        details: { modelId },
      });
    }

    const parsed = JSON.parse(row.provider_price_json) as Record<string, unknown>;
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === "number") rates[k] = v;

    const entry = {
      unit: row.unit,
      rates,
      policy: {
        markupPercent: row.markup_percent ?? DEFAULT_POLICY.markupPercent,
        fxRateUsdMyr: row.fx_rate_usd_myr ?? DEFAULT_POLICY.fxRateUsdMyr,
        roundingSen: row.rounding_sen ?? DEFAULT_POLICY.roundingSen,
        minimumChargeSen: row.minimum_charge_sen ?? DEFAULT_POLICY.minimumChargeSen,
      } satisfies PricingPolicy,
    };
    this.cache.set(modelId, entry);
    return entry;
  }
}
