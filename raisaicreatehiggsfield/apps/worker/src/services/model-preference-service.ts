import { AppError, type AuthContext } from "@raisai/shared";
import type { Env } from "../env";
import { nowIso } from "../db/client";

export interface ModelPreference {
  modelId: string;
  favourite: boolean;
  lastUsedAt: string | null;
  useCount: number;
}

/**
 * What one person favours and reaches for (§90).
 *
 * Kept per user, not per workspace: two people sharing an organization do not
 * share taste. Nothing here affects what a model costs or whether it may be
 * used, so it is safe to read and write on any signed-in request.
 */
export class ModelPreferenceService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  async list(auth: AuthContext): Promise<ModelPreference[]> {
    const { results } = await this.env.DB
      .prepare(
        `SELECT model_id, favourite, last_used_at, use_count
           FROM model_favourites WHERE user_id = ?
          ORDER BY favourite DESC, last_used_at DESC`,
      )
      .bind(auth.userId)
      .all<{ model_id: string; favourite: number; last_used_at: string | null; use_count: number }>();
    return (results ?? []).map((row) => ({
      modelId: row.model_id,
      favourite: row.favourite === 1,
      lastUsedAt: row.last_used_at,
      useCount: row.use_count,
    }));
  }

  async setFavourite(auth: AuthContext, modelId: string, favourite: boolean): Promise<ModelPreference> {
    const exists = await this.env.DB.prepare(`SELECT id FROM models WHERE id = ?`).bind(modelId).first<{ id: string }>();
    if (!exists) throw new AppError("model_not_found", `No model with id ${modelId}.`);

    await this.env.DB
      .prepare(
        `INSERT INTO model_favourites (user_id, model_id, favourite) VALUES (?, ?, ?)
         ON CONFLICT (user_id, model_id) DO UPDATE SET favourite = excluded.favourite`,
      )
      .bind(auth.userId, modelId, favourite ? 1 : 0)
      .run();

    const row = await this.env.DB
      .prepare(`SELECT model_id, favourite, last_used_at, use_count FROM model_favourites WHERE user_id = ? AND model_id = ?`)
      .bind(auth.userId, modelId)
      .first<{ model_id: string; favourite: number; last_used_at: string | null; use_count: number }>();
    return { modelId, favourite: row!.favourite === 1, lastUsedAt: row!.last_used_at, useCount: row!.use_count };
  }

  /**
   * Records that a model was used. Never fails a generation: this is a
   * convenience, and losing it must not cost someone work they paid for.
   */
  async recordUse(auth: AuthContext, modelId: string): Promise<void> {
    await this.env.DB
      .prepare(
        `INSERT INTO model_favourites (user_id, model_id, last_used_at, use_count) VALUES (?, ?, ?, 1)
         ON CONFLICT (user_id, model_id) DO UPDATE SET last_used_at = excluded.last_used_at, use_count = use_count + 1`,
      )
      .bind(auth.userId, modelId, nowIso())
      .run()
      .catch(() => undefined);
  }
}
