import { SEED_MODELS, type SeedModel } from "@raisai/seed-models";
import { newId } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso, type PgDatabase } from "../db/client";
import { ModelRepository } from "../repositories/models";

export interface SeedResult {
  seeded: number;
  enabled: number;
  skippedPricing: number;
}

/**
 * Loads the curated catalog into D1 (task 0.5.4). Idempotent: re-running
 * refreshes definitions and pricing without duplicating rows.
 *
 * A seed model only carries pricing when Cloudflare publishes a rate; models
 * without one stay `discovered` so nobody can be charged against a guessed price.
 */
export class ModelSeedService {
  private readonly repo: ModelRepository;
  private readonly db: PgDatabase;

  constructor(env: Pick<Env, "DB">) {
    this.repo = new ModelRepository(env);
    this.db = env.DB;
  }

  async seed(models: SeedModel[] = SEED_MODELS): Promise<SeedResult> {
    let enabled = 0;
    let skippedPricing = 0;

    for (const model of models) {
      await this.repo.upsert(model.definition);
      if (model.definition.status === "enabled") enabled += 1;

      if (!model.pricing) {
        skippedPricing += 1;
        continue;
      }
      const existing = await this.db
        .prepare(`SELECT id FROM model_pricing WHERE model_id = ? ORDER BY effective_from DESC LIMIT 1`)
        .bind(model.definition.id)
        .first<{ id: string }>();
      const providerPrice = JSON.stringify({ ...model.pricing.providerUsd, source: model.pricing.source, verifiedOn: model.pricing.verifiedOn });

      if (existing) {
        await this.db
          .prepare(`UPDATE model_pricing SET unit = ?, provider_price_json = ? WHERE id = ?`)
          .bind(model.pricing.unit, providerPrice, existing.id)
          .run();
      } else {
        await this.db
          .prepare(
            `INSERT INTO model_pricing (id, model_id, effective_from, unit, provider_price_json, markup_percent, minimum_charge_sen, rounding_sen, fx_rate_usd_myr, currency)
             VALUES (?, ?, ?, ?, ?, 20, 1, 1, 4.70, 'MYR')`,
          )
          .bind(newId(), model.definition.id, nowIso(), model.pricing.unit, providerPrice)
          .run();
      }
    }
    return { seeded: models.length, enabled, skippedPricing };
  }
}
