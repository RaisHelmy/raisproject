import type { Queryable } from "../db/client";
import type { ModeRow, ModelRow, PlanModelRow, PlanRow, PromptRow, PromptVersionRow, ProviderRow } from "./types";

const MODEL_SELECT = `SELECT m.*, p.code AS provider_code, p.name AS provider_name, p.is_active AS provider_active FROM models m JOIN ai_providers p ON p.id = m.provider_id`;

export class PlansRepo {
  constructor(private readonly db: Queryable) {}
  listAll() { return this.db.query<PlanRow>(`SELECT * FROM plans ORDER BY sort_order, price_monthly`); }
  listActive() { return this.db.query<PlanRow>(`SELECT * FROM plans WHERE is_active ORDER BY sort_order, price_monthly`); }
  findById(id: string) { return this.db.one<PlanRow>(`SELECT * FROM plans WHERE id = $1`, [id]); }
  findByCode(code: string) { return this.db.one<PlanRow>(`SELECT * FROM plans WHERE code = $1`, [code]); }
  update(id: string, patch: Partial<PlanRow>) {
    const keys = Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined && k !== "id" && k !== "code");
    if (!keys.length) return this.findById(id);
    const vals = keys.map((k) => { const v = (patch as Record<string, unknown>)[k]; return Array.isArray(v) ? JSON.stringify(v) : v; });
    return this.db.one<PlanRow>(`UPDATE plans SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
  }
  modelsForPlan(planId: string) { return this.db.query<PlanModelRow>(`SELECT * FROM plan_models WHERE plan_id = $1`, [planId]); }
  setPlanModels(modelId: string, planIds: string[]) {
    return this.db.query(
      `WITH del AS (DELETE FROM plan_models WHERE model_id = $1 AND NOT (plan_id = ANY($2::uuid[])))
       INSERT INTO plan_models (plan_id, model_id, enabled, priority) SELECT unnest($2::uuid[]), $1, true, 0 ON CONFLICT (plan_id, model_id) DO UPDATE SET enabled = true`, [modelId, planIds]);
  }
  allPlanModels() { return this.db.query<PlanModelRow & { plan_code: string }>(`SELECT pm.*, p.code AS plan_code FROM plan_models pm JOIN plans p ON p.id = pm.plan_id WHERE pm.enabled`); }
}

export class ProvidersRepo {
  constructor(private readonly db: Queryable) {}
  list() { return this.db.query<ProviderRow>(`SELECT * FROM ai_providers ORDER BY priority DESC, name`); }
  findById(id: string) { return this.db.one<ProviderRow>(`SELECT * FROM ai_providers WHERE id = $1`, [id]); }
  findByCode(code: string) { return this.db.one<ProviderRow>(`SELECT * FROM ai_providers WHERE code = $1`, [code]); }
  update(id: string, patch: { name?: string; base_url?: string | null; api_key_encrypted?: string | null; is_active?: boolean; priority?: number }) {
    const keys = Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined);
    if (!keys.length) return this.findById(id);
    return this.db.one<ProviderRow>(`UPDATE ai_providers SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => (patch as Record<string, unknown>)[k])]);
  }
}

export class ModelsRepo {
  constructor(private readonly db: Queryable) {}
  listAll() { return this.db.query<ModelRow>(`${MODEL_SELECT} ORDER BY m.priority DESC, m.name`); }
  listActive() { return this.db.query<ModelRow>(`${MODEL_SELECT} WHERE m.is_active AND p.is_active ORDER BY m.priority DESC, m.name`); }
  findById(id: string) { return this.db.one<ModelRow>(`${MODEL_SELECT} WHERE m.id = $1`, [id]); }
  create(m: { provider_id: string; name: string; model_identifier: string; description: string | null; context_window: number; max_output_tokens: number; input_cost_per_million: number; output_cost_per_million: number; tier: string; is_active: boolean; priority: number; is_default: boolean }) {
    return this.db.one<{ id: string }>(
      `INSERT INTO models (provider_id, name, model_identifier, description, context_window, max_output_tokens, input_cost_per_million, output_cost_per_million, tier, is_active, priority, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [m.provider_id, m.name, m.model_identifier, m.description, m.context_window, m.max_output_tokens, m.input_cost_per_million, m.output_cost_per_million, m.tier, m.is_active, m.priority, m.is_default]);
  }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== "id");
    if (!keys.length) return this.findById(id);
    return this.db.one<{ id: string }>(`UPDATE models SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING id`, [id, ...keys.map((k) => patch[k])]);
  }
  clearDefault() { return this.db.query(`UPDATE models SET is_default = false WHERE is_default`); }
  delete(id: string) { return this.db.query(`DELETE FROM models WHERE id = $1`, [id]); }
}

export class ModesRepo {
  constructor(private readonly db: Queryable) {}
  listAll() { return this.db.query<ModeRow>(`SELECT * FROM ai_modes ORDER BY sort_order, name`); }
  listActive() { return this.db.query<ModeRow>(`SELECT * FROM ai_modes WHERE is_active ORDER BY sort_order, name`); }
  findById(id: string) { return this.db.one<ModeRow>(`SELECT * FROM ai_modes WHERE id = $1`, [id]); }
  findByCode(code: string) { return this.db.one<ModeRow>(`SELECT * FROM ai_modes WHERE code = $1`, [code]); }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== "id");
    if (!keys.length) return this.findById(id);
    const vals = keys.map((k) => (Array.isArray(patch[k]) ? JSON.stringify(patch[k]) : patch[k]));
    return this.db.one<ModeRow>(`UPDATE ai_modes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
  }
  create(m: { code: string; name: string; name_zh: string; name_zh_tw: string; description: string; description_zh: string; description_zh_tw: string; icon: string; prompt_id: string | null; knowledge_filter: string[]; is_advanced: boolean; sort_order: number }) {
    return this.db.one<ModeRow>(
      `INSERT INTO ai_modes (code, name, name_zh, name_zh_tw, description, description_zh, description_zh_tw, icon, prompt_id, knowledge_filter, is_advanced, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [m.code, m.name, m.name_zh, m.name_zh_tw, m.description, m.description_zh, m.description_zh_tw, m.icon, m.prompt_id, JSON.stringify(m.knowledge_filter), m.is_advanced, m.sort_order]);
  }
}

export class PromptsRepo {
  constructor(private readonly db: Queryable) {}
  list() {
    return this.db.query<PromptRow & { active_version: number | null; version_count: number }>(
      `SELECT p.*, av.version AS active_version, (SELECT count(*)::int FROM prompt_versions v WHERE v.prompt_id = p.id) AS version_count
       FROM prompts p LEFT JOIN prompt_versions av ON av.id = p.active_version_id ORDER BY p.name`);
  }
  findById(id: string) { return this.db.one<PromptRow>(`SELECT * FROM prompts WHERE id = $1`, [id]); }
  findByCode(code: string) { return this.db.one<PromptRow>(`SELECT * FROM prompts WHERE code = $1`, [code]); }
  /** Active content for a prompt code (empty string if none). */
  async activeContent(code: string): Promise<string> {
    const r = await this.db.one<{ content: string }>(`SELECT v.content FROM prompts p JOIN prompt_versions v ON v.id = p.active_version_id WHERE p.code = $1`, [code]);
    return r?.content ?? "";
  }
  async activeContentById(id: string): Promise<string> {
    const r = await this.db.one<{ content: string }>(`SELECT v.content FROM prompts p JOIN prompt_versions v ON v.id = p.active_version_id WHERE p.id = $1`, [id]);
    return r?.content ?? "";
  }
  versions(promptId: string) { return this.db.query<PromptVersionRow>(`SELECT * FROM prompt_versions WHERE prompt_id = $1 ORDER BY version DESC`, [promptId]); }
  async addVersion(promptId: string, content: string, notes: string | null, createdBy: string | null, activate: boolean) {
    const v = (await this.db.one<PromptVersionRow>(
      `INSERT INTO prompt_versions (prompt_id, version, content, notes, created_by)
       VALUES ($1, (SELECT coalesce(max(version), 0) + 1 FROM prompt_versions WHERE prompt_id = $1), $2, $3, $4) RETURNING *`, [promptId, content, notes, createdBy]))!;
    if (activate) await this.activate(promptId, v.id);
    return v;
  }
  activate(promptId: string, versionId: string) { return this.db.query(`UPDATE prompts SET active_version_id = $2, updated_at = now() WHERE id = $1 AND EXISTS (SELECT 1 FROM prompt_versions WHERE id = $2 AND prompt_id = $1)`, [promptId, versionId]); }
  create(code: string, name: string, description: string | null) { return this.db.one<PromptRow>(`INSERT INTO prompts (code, name, description) VALUES ($1,$2,$3) RETURNING *`, [code, name, description]); }
}
