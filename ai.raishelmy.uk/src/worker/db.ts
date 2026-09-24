import type { Env } from "./env";

export interface ProjectRow { id: string; slug: string; name: string; description: string; created_at: number }
export interface KeyRow {
  id: string; project_id: string; name: string; key_prefix: string; key_hash: string; enabled: number;
  expires_at: number | null; created_at: number; last_used_at: number | null;
  daily_usd: number | null; weekly_usd: number | null; monthly_usd: number | null; on_limit: "block" | "fallback";
  allowed_models: string; default_model: string; fallback_model: string | null; requests_per_minute: number | null; preset: string;
}
export interface ModelRow { id: string; provider: string; display_name: string; input_usd_per_m: number; output_usd_per_m: number; enabled: number; tags: string; sort: number }
export interface AliasRow { name: string; description: string; candidates: string }

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return r?.value ?? null;
}
export async function getSettings(env: Env): Promise<Record<string, string>> {
  const rs = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  return Object.fromEntries(rs.results.map((r) => [r.key, r.value]));
}
export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}

export async function loadCatalog(env: Env): Promise<{ models: ModelRow[]; aliases: AliasRow[] }> {
  const [m, a] = await Promise.all([
    env.DB.prepare("SELECT * FROM models ORDER BY sort, id").all<ModelRow>(),
    env.DB.prepare("SELECT * FROM aliases ORDER BY name").all<AliasRow>(),
  ]);
  return { models: m.results, aliases: a.results };
}

export interface SpendWindows { day: number; week: number; month: number }

export async function keySpend(env: Env, keyId: string, w: { dayStart: number; weekStart: number; monthStart: number }): Promise<SpendWindows> {
  const r = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN created_at >= ?1 THEN cost_usd END), 0) AS day,
       COALESCE(SUM(CASE WHEN created_at >= ?2 THEN cost_usd END), 0) AS week,
       COALESCE(SUM(CASE WHEN created_at >= ?3 THEN cost_usd END), 0) AS month
     FROM usage WHERE api_key_id = ?4 AND created_at >= ?3`,
  ).bind(w.dayStart, w.weekStart, w.monthStart, keyId).first<SpendWindows>();
  return r ?? { day: 0, week: 0, month: 0 };
}

export async function globalSpend(env: Env, w: { dayStart: number; weekStart: number; monthStart: number }): Promise<SpendWindows> {
  const r = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN created_at >= ?1 THEN cost_usd END), 0) AS day,
       COALESCE(SUM(CASE WHEN created_at >= ?2 THEN cost_usd END), 0) AS week,
       COALESCE(SUM(CASE WHEN created_at >= ?3 THEN cost_usd END), 0) AS month
     FROM usage WHERE created_at >= ?3`,
  ).bind(w.dayStart, w.weekStart, w.monthStart).first<SpendWindows>();
  return r ?? { day: 0, week: 0, month: 0 };
}

export async function requestsLastMinute(env: Env, keyId: string): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - 60;
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM usage WHERE api_key_id = ? AND created_at >= ?").bind(keyId, since).first<{ n: number }>();
  return r?.n ?? 0;
}
