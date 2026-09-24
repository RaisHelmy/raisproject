import {
  AppError, newId, type AuthContext, type Capability, type ModelDefinition,
  type ModelStatus, type ModelTag, type ParameterDef, type PricingUnit,
} from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";
import { ModelRepository } from "../repositories/models";
import { AuditLogService } from "./audit-log-service";
import { PricingService } from "./pricing-service";
import { CloudflareAIProvider } from "../providers/cloudflare/cloudflare-provider";
import type { AIProvider } from "../providers/types";

export interface ModelPatch {
  displayName?: string;
  description?: string;
  category?: ModelDefinition["category"];
  task?: string;
  capabilities?: Capability[];
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
  parameters?: ParameterDef[];
  limits?: ModelDefinition["limits"];
  tags?: ModelTag[];
  sortOrder?: number;
}

export interface PricingPatch {
  unit: PricingUnit;
  providerUsd: Record<string, number>;
  markupPercent?: number;
  minimumChargeSen?: number;
  roundingSen?: number;
  fxRateUsdMyr?: number;
}

/**
 * Admin control over the catalog (§72, §124).
 *
 * The one rule enforced here rather than left to discipline: a model cannot be
 * enabled until it has pricing and a successful test run. Everything else about
 * the registry assumes an enabled model is safe to charge for.
 */
export class AdminModelService {
  constructor(private readonly env: Pick<Env, "DB" | "ASSETS" | "AI" | "AI_GATEWAY_ID">) {}

  async update(auth: AuthContext, modelId: string, patch: ModelPatch): Promise<ModelDefinition> {
    const repo = new ModelRepository(this.env);
    const existing = await repo.findById(modelId);
    if (!existing) throw new AppError("model_not_found", `No model with id ${modelId}.`);

    await repo.upsert({ ...existing, ...patch } as ModelDefinition);
    await this.audit(auth, "model.updated", modelId, { fields: Object.keys(patch) });
    return (await repo.findById(modelId))!;
  }

  async setPricing(auth: AuthContext, modelId: string, pricing: PricingPatch): Promise<void> {
    const repo = new ModelRepository(this.env);
    if (!(await repo.findById(modelId))) throw new AppError("model_not_found", `No model with id ${modelId}.`);

    const rates = Object.values(pricing.providerUsd).filter((v) => typeof v === "number" && v > 0);
    if (rates.length === 0) {
      throw new AppError("invalid_input", "Pricing needs at least one rate above zero.", {
        action: "Enter the provider's published rate.",
      });
    }

    // A new row rather than an edit: historical charges stay explainable by the
    // rate that was in force when they happened.
    await this.env.DB
      .prepare(
        `INSERT INTO model_pricing (id, model_id, effective_from, unit, provider_price_json,
            markup_percent, minimum_charge_sen, rounding_sen, fx_rate_usd_myr, currency)
         VALUES (?,?,?,?,?,?,?,?,?, 'MYR')`,
      )
      .bind(
        newId(), modelId, nowIso(), pricing.unit, JSON.stringify(pricing.providerUsd),
        pricing.markupPercent ?? 20, pricing.minimumChargeSen ?? 1,
        pricing.roundingSen ?? 1, pricing.fxRateUsdMyr ?? 4.7,
      )
      .run();

    await this.audit(auth, "model.pricing_changed", modelId, {
      unit: pricing.unit, markupPercent: pricing.markupPercent ?? 20,
    });
  }

  /**
   * Runs one real generation to prove the model works before customers can
   * reach it. Cost falls on the operator, not a customer: it is not billed to
   * any workspace ledger.
   */
  async testRun(auth: AuthContext, modelId: string, provider?: AIProvider): Promise<{ ok: boolean; message: string; durationMs: number }> {
    const model = await new ModelRepository(this.env).findById(modelId);
    if (!model) throw new AppError("model_not_found", `No model with id ${modelId}.`);

    const started = Date.now();
    const impl = provider ?? new CloudflareAIProvider(this.env);
    const input = testInputFor(model);

    const validation = impl.validateInput(model, input);
    if (!validation.ok) {
      return { ok: false, message: validation.issues[0]!.message, durationMs: Date.now() - started };
    }

    const job = await impl.execute(model, input, { requestId: auth.requestId });
    const durationMs = Date.now() - started;

    if (job.status === "failed") {
      await this.audit(auth, "model.test_failed", modelId, { error: job.error?.code });
      return { ok: false, message: job.error?.message ?? "The model returned an error.", durationMs };
    }

    await this.env.DB
      .prepare(`UPDATE models SET updated_at = ? WHERE id = ?`)
      .bind(nowIso(), modelId)
      .run();
    // The audit entry is the record of a passing test; setStatus reads it back.
    await this.audit(auth, "model.test_passed", modelId, { durationMs });
    return { ok: true, message: "The model responded correctly.", durationMs };
  }

  async setStatus(auth: AuthContext, modelId: string, status: ModelStatus): Promise<ModelDefinition> {
    const repo = new ModelRepository(this.env);
    const model = await repo.findById(modelId);
    if (!model) throw new AppError("model_not_found", `No model with id ${modelId}.`);

    if (status === "enabled") {
      // Both gates are checked here because everything downstream, including
      // the customer-facing price, assumes an enabled model is priced and proven.
      const priced = await this.env.DB
        .prepare(`SELECT id FROM model_pricing WHERE model_id = ? LIMIT 1`)
        .bind(modelId)
        .first<{ id: string }>();
      if (!priced) {
        throw new AppError("invalid_input", `${model.displayName} has no pricing yet.`, {
          action: "Set the provider rate before enabling it.",
        });
      }
      const verdict = await this.latestTestVerdict(modelId);
      if (verdict !== "passed") {
        throw new AppError(
          "invalid_input",
          verdict === "failed"
            ? `${model.displayName} failed its last test run.`
            : `${model.displayName} has not passed a test run.`,
          { action: "Run a test generation and make sure it succeeds before enabling it." },
        );
      }
    }

    await repo.setStatus(modelId, status);
    await this.audit(auth, `model.${status}`, modelId, {});
    return (await repo.findById(modelId))!;
  }

  /**
   * The rate currently in force, with what a customer would pay under it.
   *
   * Admins see the provider cost and the markup here, which no customer-facing
   * route ever returns (ADR-006, §164).
   */
  async currentPricing(modelId: string): Promise<
    | null
    | {
        unit: string;
        providerUsd: Record<string, number>;
        markupPercent: number;
        minimumChargeSen: number;
        roundingSen: number;
        fxRateUsdMyr: number;
        effectiveFrom: string;
      }
  > {
    const row = await this.env.DB
      .prepare(
        `SELECT unit, provider_price_json, markup_percent, minimum_charge_sen, rounding_sen,
                fx_rate_usd_myr, effective_from
           FROM model_pricing WHERE model_id = ? ORDER BY effective_from DESC, id DESC LIMIT 1`,
      )
      .bind(modelId)
      .first<{
        unit: string;
        provider_price_json: string;
        markup_percent: number;
        minimum_charge_sen: number;
        rounding_sen: number;
        fx_rate_usd_myr: number;
        effective_from: string;
      }>();
    if (!row) return null;
    return {
      unit: row.unit,
      providerUsd: JSON.parse(row.provider_price_json) as Record<string, number>,
      markupPercent: row.markup_percent,
      minimumChargeSen: row.minimum_charge_sen,
      roundingSen: row.rounding_sen,
      fxRateUsdMyr: row.fx_rate_usd_myr,
      effectiveFrom: row.effective_from,
    };
  }

  /** Customer-facing price of a typical request, so an admin sees what they are setting. */
  async previewPrice(modelId: string): Promise<{ estimatedSen: number } | { error: string }> {
    const model = await new ModelRepository(this.env).findById(modelId);
    if (!model) throw new AppError("model_not_found", `No model with id ${modelId}.`);
    try {
      const estimate = await new PricingService(this.env).estimate(model, testInputFor(model));
      return { estimatedSen: estimate.estimatedSen };
    } catch (error) {
      return { error: error instanceof AppError ? error.message : "Pricing is not configured." };
    }
  }

  /**
   * The most recent test outcome, not merely whether one ever passed. A model
   * that worked last month and fails today must not be enableable on the
   * strength of the old pass; likewise a later config change is verified again.
   */
  private async latestTestVerdict(modelId: string): Promise<"passed" | "failed" | "none"> {
    const row = await this.env.DB
      .prepare(
        // Ordered by id: ids are ULIDs, so this is creation order at millisecond
        // resolution (Postgres has no rowid). A test verdict and a later edit
        // are never written in the same millisecond in practice.
        `SELECT event FROM audit_log
          WHERE target_id = ? AND event IN ('model.test_passed','model.test_failed','model.updated')
          ORDER BY id DESC LIMIT 1`,
      )
      .bind(modelId)
      .first<{ event: string }>();
    if (!row) return "none";
    if (row.event === "model.test_passed") return "passed";
    if (row.event === "model.test_failed") return "failed";
    // The definition changed after the last test, so the old result no longer speaks for it.
    return "none";
  }

  private async audit(auth: AuthContext, event: string, modelId: string, meta: Record<string, unknown>): Promise<void> {
    await new AuditLogService(this.env).record({
      orgId: auth.orgId, actorUserId: auth.userId, actorType: auth.actorType,
      event, targetType: "model", targetId: modelId, meta, requestId: auth.requestId,
    });
  }
}

/** A small, cheap request that still exercises the model's real path. */
function testInputFor(model: ModelDefinition) {
  switch (model.category) {
    case "image":
      return { prompt: "a small red circle on a white background" };
    case "video":
      return { prompt: "a slow pan across a still landscape", durationSeconds: model.limits.durations?.[0] ?? 5 };
    case "audio":
      return { text: "Testing one two three." };
    default:
      return { prompt: "Reply with the word: ready.", maxTokens: 16 };
  }
}
