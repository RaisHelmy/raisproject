import { AppError, type AuthContext, type Sen } from "@raisai/shared";
import type { Env } from "../env";
import { GenerationService, type GenerationRow } from "./generation-service";
import { ModelService } from "./model-service";
import { PricingService } from "./pricing-service";
import { LedgerService } from "./ledger-service";
import type { AIProvider } from "../providers/types";

export interface ComparisonEntry {
  modelId: string;
  displayName: string;
  status: "completed" | "failed";
  generation?: GenerationRow;
  outputs?: Record<string, unknown>;
  chargedSen: Sen;
  durationMs: number | null;
  error?: { code: string; message: string };
}

export interface ComparisonResult {
  prompt: string;
  entries: ComparisonEntry[];
  totalChargedSen: Sen;
  balanceAfterSen: Sen;
}

const MAX_MODELS = 4;

/**
 * Runs one prompt across several models so they can be judged side by side
 * (§89). With a catalog this wide, comparing is often the only honest way to
 * choose, and the per-model cost sits next to each result.
 */
export class ComparisonService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID">) {}

  /** Total cost before running, so nobody is surprised by a multiplied bill. */
  async estimate(modelIds: string[], prompt: string): Promise<{ totalSen: Sen; perModel: { modelId: string; estimatedSen: Sen }[] }> {
    const models = new ModelService(this.env);
    const pricing = new PricingService(this.env);
    const perModel: { modelId: string; estimatedSen: Sen }[] = [];

    for (const modelId of modelIds.slice(0, MAX_MODELS)) {
      const model = await models.getEnabled(modelId);
      const estimate = await pricing.estimate(model, { prompt });
      perModel.push({ modelId, estimatedSen: estimate.estimatedSen });
    }
    return { totalSen: perModel.reduce((sum, m) => sum + m.estimatedSen, 0), perModel };
  }

  async run(
    auth: AuthContext,
    input: { modelIds: string[]; prompt: string; projectId?: string; provider?: AIProvider },
  ): Promise<ComparisonResult> {
    const unique = [...new Set(input.modelIds)];
    if (unique.length < 2) {
      throw new AppError("invalid_input", "Pick at least two models to compare.");
    }
    if (unique.length > MAX_MODELS) {
      throw new AppError("invalid_input", `Compare at most ${MAX_MODELS} models at once.`, {
        action: "Remove some models and try again.",
      });
    }

    // Checked once up front: running two and then stopping halfway would leave
    // a comparison that cannot be compared.
    const ledger = new LedgerService(this.env);
    const { totalSen } = await this.estimate(unique, input.prompt);
    const balance = await ledger.getBalance(auth.orgId);
    if (balance.availableSen < totalSen) {
      throw new AppError("insufficient_balance", "Your balance does not cover this comparison.", {
        action: "Add balance, or compare fewer models.",
        details: { estimatedSen: totalSen, availableSen: balance.availableSen },
      });
    }

    const generations = new GenerationService(this.env);
    const models = new ModelService(this.env);
    const entries: ComparisonEntry[] = [];

    for (const modelId of unique) {
      const model = await models.getEnabled(modelId);
      try {
        const result = await generations.create(auth, {
          modelId,
          prompt: input.prompt,
          projectId: input.projectId,
          provider: input.provider,
        });
        entries.push({
          modelId,
          displayName: model.displayName,
          status: result.generation.status === "completed" ? "completed" : "failed",
          generation: result.generation,
          outputs: result.outputs,
          chargedSen: result.generation.actual_cost_sen ?? 0,
          durationMs: result.generation.duration_ms,
          ...(result.generation.error_code
            ? { error: { code: result.generation.error_code, message: result.generation.error_message ?? "" } }
            : {}),
        });
      } catch (error) {
        // One model failing must not lose the results of the others.
        entries.push({
          modelId,
          displayName: model.displayName,
          status: "failed",
          chargedSen: 0,
          durationMs: null,
          error: {
            code: error instanceof AppError ? error.code : "internal",
            message: error instanceof AppError ? error.message : "That model could not be run.",
          },
        });
      }
    }

    const after = await ledger.getBalance(auth.orgId);
    return {
      prompt: input.prompt,
      entries,
      totalChargedSen: entries.reduce((sum, e) => sum + e.chargedSen, 0),
      balanceAfterSen: after.availableSen,
    };
  }
}
