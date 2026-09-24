import { Hono } from "hono";
import type { Env } from "../env";
import { ADMIN_EMAIL } from "../env";
import type { KeyRow, ProjectRow, ModelRow, AliasRow } from "../db";
import { getSettings, setSetting, loadCatalog, keySpend, globalSpend } from "../db";
import { clearSessionCookie, currentSession, issueSessionCookie, requireAdmin, verifySsoToken } from "../auth";
import { generateKey, maskKey } from "../keys";
import { constantTimeEqual, newId, now, slugify, windows } from "../util";
import { syncCosts } from "../sync";

export const admin = new Hono<{ Bindings: Env }>();

// ---------- auth ----------
admin.post("/auth/login", async (c) => {
  const { password } = (await c.req.json().catch(() => ({}))) as { password?: string };
  if (!c.env.ADMIN_PASSWORD) return c.json({ error: "ADMIN_PASSWORD secret is not set on this Worker." }, 503);
  if (!password || !(await constantTimeEqual(password, c.env.ADMIN_PASSWORD))) return c.json({ error: "Wrong password." }, 401);
  c.header("Set-Cookie", await issueSessionCookie(c.env, "password"));
  return c.json({ ok: true, email: ADMIN_EMAIL });
});
admin.post("/auth/logout", (c) => { c.header("Set-Cookie", clearSessionCookie()); return c.json({ ok: true }); });
admin.get("/auth/me", async (c) => {
  const s = await currentSession(c.req.raw, c.env);
  return s ? c.json({ ok: true, ...s }) : c.json({ ok: false }, 401);
});
// Suite SSO (saas.raishelmy.uk/admin → /api/auth/sso?token=...)
admin.get("/auth/sso", async (c) => {
  const token = c.req.query("token") ?? "";
  const ok = token && (await verifySsoToken(c.env, token));
  if (!ok) return c.redirect("/login?error=sso", 302);
  return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": await issueSessionCookie(c.env, "sso"), "Cache-Control": "no-store" } });
});

admin.use("*", requireAdmin);

// ---------- overview ----------
admin.get("/overview", async (c) => {
  const env = c.env;
  const w = windows(env.BUDGET_TIMEZONE);
  const [settings, gspend, projects, keys] = await Promise.all([
    getSettings(env),
    globalSpend(env, w),
    env.DB.prepare("SELECT * FROM projects ORDER BY name").all<ProjectRow>(),
    env.DB.prepare("SELECT * FROM api_keys ORDER BY created_at DESC").all<KeyRow>(),
  ]);
  const spendRows = await env.DB.prepare(
    `SELECT api_key_id,
       COALESCE(SUM(CASE WHEN created_at >= ?1 THEN cost_usd END), 0) AS day,
       COALESCE(SUM(CASE WHEN created_at >= ?2 THEN cost_usd END), 0) AS week,
       COALESCE(SUM(CASE WHEN created_at >= ?3 THEN cost_usd END), 0) AS month,
       SUM(CASE WHEN created_at >= ?3 THEN 1 ELSE 0 END) AS requests_month
     FROM usage WHERE created_at >= ?3 GROUP BY api_key_id`,
  ).bind(w.dayStart, w.weekStart, w.monthStart).all<{ api_key_id: string; day: number; week: number; month: number; requests_month: number }>();
  const spendByKey = new Map(spendRows.results.map((r) => [r.api_key_id, r]));
  const monthByProject = await env.DB.prepare("SELECT project_id, COALESCE(SUM(cost_usd),0) AS month FROM usage WHERE created_at >= ? GROUP BY project_id").bind(w.monthStart).all<{ project_id: string; month: number }>();
  const pm = new Map(monthByProject.results.map((r) => [r.project_id, r.month]));

  return c.json({
    email: ADMIN_EMAIL,
    timezone: env.BUDGET_TIMEZONE,
    windows: w,
    global: {
      spend: gspend,
      budget: { day: num(settings.global_daily_usd), week: num(settings.global_weekly_usd), month: num(settings.global_monthly_usd) },
    },
    last_cost_sync: num(settings.last_cost_sync),
    projects: projects.results.map((p) => ({
      ...p,
      month_spend: pm.get(p.id) ?? 0,
      keys: keys.results.filter((k) => k.project_id === p.id).map((k) => publicKey(k, spendByKey.get(k.id))),
    })),
  });
});

function num(v: string | undefined): number | null { const n = Number(v); return v !== undefined && v !== "" && Number.isFinite(n) ? n : null; }

function publicKey(k: KeyRow, s?: { day: number; week: number; month: number; requests_month: number }) {
  const { key_hash: _h, ...rest } = k;
  return { ...rest, masked: maskKey(k.key_prefix), allowed_models: safeList(k.allowed_models), spend: s ? { day: s.day, week: s.week, month: s.month } : { day: 0, week: 0, month: 0 }, requests_month: s?.requests_month ?? 0 };
}
function safeList(s: string): string[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } }

// ---------- projects ----------
admin.get("/projects", async (c) => c.json((await c.env.DB.prepare("SELECT * FROM projects ORDER BY name").all<ProjectRow>()).results));
admin.post("/projects", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; description?: string; slug?: string };
  if (!b.name?.trim()) return c.json({ error: "name is required" }, 400);
  const slug = slugify(b.slug || b.name);
  const exists = await c.env.DB.prepare("SELECT id FROM projects WHERE slug = ?").bind(slug).first();
  if (exists) return c.json({ error: `slug '${slug}' already exists` }, 409);
  const row: ProjectRow = { id: newId("prj"), slug, name: b.name.trim(), description: (b.description ?? "").trim(), created_at: now() };
  await c.env.DB.prepare("INSERT INTO projects(id, slug, name, description, created_at) VALUES (?, ?, ?, ?, ?)").bind(row.id, row.slug, row.name, row.description, row.created_at).run();
  return c.json(row, 201);
});
admin.patch("/projects/:id", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as { name?: string; description?: string };
  await c.env.DB.prepare("UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?").bind(b.name?.trim() ?? null, b.description?.trim() ?? null, c.req.param("id")).run();
  return c.json({ ok: true });
});
admin.delete("/projects/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM usage WHERE project_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM api_keys WHERE project_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

// ---------- keys ----------
interface KeyInput {
  project_id?: string; name?: string; daily_usd?: number | null; weekly_usd?: number | null; monthly_usd?: number | null;
  on_limit?: "block" | "fallback"; allowed_models?: string[]; default_model?: string; fallback_model?: string | null;
  requests_per_minute?: number | null; expires_at?: number | null; preset?: string; enabled?: boolean;
}
const money = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Math.max(0, Number(v)) || null);

admin.post("/keys", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as KeyInput;
  if (!b.project_id || !b.name?.trim()) return c.json({ error: "project_id and name are required" }, 400);
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(b.project_id).first<ProjectRow>();
  if (!project) return c.json({ error: "project not found" }, 404);
  const gen = await generateKey(project.slug);
  const id = newId("key");
  await c.env.DB.prepare(
    `INSERT INTO api_keys(id, project_id, name, key_prefix, key_hash, enabled, expires_at, created_at, daily_usd, weekly_usd, monthly_usd, on_limit, allowed_models, default_model, fallback_model, requests_per_minute, preset)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, project.id, b.name.trim(), gen.prefix, gen.hash, b.expires_at ?? null, now(), money(b.daily_usd), money(b.weekly_usd), money(b.monthly_usd),
    b.on_limit === "fallback" ? "fallback" : "block", JSON.stringify(b.allowed_models ?? []), b.default_model || "auto", b.fallback_model || null,
    b.requests_per_minute ? Math.max(1, Math.floor(Number(b.requests_per_minute))) : null, b.preset || "custom").run();
  const row = await c.env.DB.prepare("SELECT * FROM api_keys WHERE id = ?").bind(id).first<KeyRow>();
  return c.json({ key: gen.key, credential: publicKey(row!), project }, 201);
});

admin.get("/keys/:id", async (c) => {
  const k = await c.env.DB.prepare("SELECT * FROM api_keys WHERE id = ?").bind(c.req.param("id")).first<KeyRow>();
  if (!k) return c.json({ error: "not found" }, 404);
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(k.project_id).first<ProjectRow>();
  const w = windows(c.env.BUDGET_TIMEZONE);
  const spend = await keySpend(c.env, k.id, w);
  return c.json({ credential: publicKey(k, { ...spend, requests_month: 0 }), project });
});

admin.patch("/keys/:id", async (c) => {
  const id = c.req.param("id");
  const b = (await c.req.json().catch(() => ({}))) as KeyInput;
  const cur = await c.env.DB.prepare("SELECT * FROM api_keys WHERE id = ?").bind(id).first<KeyRow>();
  if (!cur) return c.json({ error: "not found" }, 404);
  const has = (k: keyof KeyInput) => Object.prototype.hasOwnProperty.call(b, k);
  await c.env.DB.prepare(
    `UPDATE api_keys SET name = ?, enabled = ?, expires_at = ?, daily_usd = ?, weekly_usd = ?, monthly_usd = ?, on_limit = ?, allowed_models = ?, default_model = ?, fallback_model = ?, requests_per_minute = ?, preset = ? WHERE id = ?`,
  ).bind(
    has("name") && b.name?.trim() ? b.name.trim() : cur.name,
    has("enabled") ? (b.enabled ? 1 : 0) : cur.enabled,
    has("expires_at") ? (b.expires_at ?? null) : cur.expires_at,
    has("daily_usd") ? money(b.daily_usd) : cur.daily_usd,
    has("weekly_usd") ? money(b.weekly_usd) : cur.weekly_usd,
    has("monthly_usd") ? money(b.monthly_usd) : cur.monthly_usd,
    has("on_limit") ? (b.on_limit === "fallback" ? "fallback" : "block") : cur.on_limit,
    has("allowed_models") ? JSON.stringify(b.allowed_models ?? []) : cur.allowed_models,
    has("default_model") ? (b.default_model || "auto") : cur.default_model,
    has("fallback_model") ? (b.fallback_model || null) : cur.fallback_model,
    has("requests_per_minute") ? (b.requests_per_minute ? Math.max(1, Math.floor(Number(b.requests_per_minute))) : null) : cur.requests_per_minute,
    has("preset") ? (b.preset || "custom") : cur.preset,
    id,
  ).run();
  const row = await c.env.DB.prepare("SELECT * FROM api_keys WHERE id = ?").bind(id).first<KeyRow>();
  return c.json(publicKey(row!));
});

/** Rotate: new secret, same id/settings/usage history. Old key stops working immediately. */
admin.post("/keys/:id/rotate", async (c) => {
  const id = c.req.param("id");
  const cur = await c.env.DB.prepare("SELECT k.*, p.slug FROM api_keys k JOIN projects p ON p.id = k.project_id WHERE k.id = ?").bind(id).first<KeyRow & { slug: string }>();
  if (!cur) return c.json({ error: "not found" }, 404);
  const gen = await generateKey(cur.slug);
  await c.env.DB.prepare("UPDATE api_keys SET key_prefix = ?, key_hash = ? WHERE id = ?").bind(gen.prefix, gen.hash, id).run();
  return c.json({ key: gen.key, masked: maskKey(gen.prefix) });
});

admin.delete("/keys/:id", async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM usage WHERE api_key_id = ?").bind(c.req.param("id")),
    c.env.DB.prepare("DELETE FROM api_keys WHERE id = ?").bind(c.req.param("id")),
  ]);
  return c.json({ ok: true });
});

admin.get("/keys/:id/usage", async (c) => {
  const id = c.req.param("id");
  const days = Math.min(90, Math.max(1, Number(c.req.query("days") ?? 30)));
  const since = now() - days * 86400;
  const [daily, byModel, recent] = await Promise.all([
    c.env.DB.prepare("SELECT day, COALESCE(SUM(cost_usd),0) AS cost, COALESCE(SUM(cf_cost_usd),0) AS cf_cost, COUNT(*) AS requests, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens FROM usage WHERE api_key_id = ? AND created_at >= ? GROUP BY day ORDER BY day").bind(id, since).all(),
    c.env.DB.prepare("SELECT model, provider, COALESCE(SUM(cost_usd),0) AS cost, COUNT(*) AS requests, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors FROM usage WHERE api_key_id = ? AND created_at >= ? GROUP BY model, provider ORDER BY cost DESC").bind(id, since).all(),
    c.env.DB.prepare("SELECT id, requested_model, model, provider, input_tokens, output_tokens, cost_usd, cf_cost_usd, latency_ms, status, error, streamed, created_at FROM usage WHERE api_key_id = ? ORDER BY created_at DESC LIMIT 50").bind(id).all(),
  ]);
  return c.json({ days, daily: daily.results, by_model: byModel.results, recent: recent.results });
});

// ---------- catalog ----------
admin.get("/catalog", async (c) => c.json(await loadCatalog(c.env)));
admin.put("/models/:id", async (c) => {
  const id = decodeURIComponent(c.req.param("id"));
  const b = (await c.req.json().catch(() => ({}))) as Partial<ModelRow>;
  const cur = await c.env.DB.prepare("SELECT * FROM models WHERE id = ?").bind(id).first<ModelRow>();
  if (!cur) {
    const provider = b.provider || id.split("/")[0] || "unknown";
    await c.env.DB.prepare("INSERT INTO models(id, provider, display_name, input_usd_per_m, output_usd_per_m, enabled, tags, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, provider, b.display_name || id, Number(b.input_usd_per_m) || 0, Number(b.output_usd_per_m) || 0, b.enabled === undefined ? 1 : (b.enabled ? 1 : 0), b.tags ?? "", Number(b.sort) || 100).run();
    return c.json({ ok: true, created: true }, 201);
  }
  await c.env.DB.prepare("UPDATE models SET display_name = ?, input_usd_per_m = ?, output_usd_per_m = ?, enabled = ?, tags = ?, sort = ? WHERE id = ?")
    .bind(b.display_name ?? cur.display_name, b.input_usd_per_m ?? cur.input_usd_per_m, b.output_usd_per_m ?? cur.output_usd_per_m, b.enabled === undefined ? cur.enabled : (b.enabled ? 1 : 0), b.tags ?? cur.tags, b.sort ?? cur.sort, id).run();
  return c.json({ ok: true });
});
admin.delete("/models/:id", async (c) => { await c.env.DB.prepare("DELETE FROM models WHERE id = ?").bind(decodeURIComponent(c.req.param("id"))).run(); return c.json({ ok: true }); });
admin.put("/aliases/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  const b = (await c.req.json().catch(() => ({}))) as Partial<AliasRow> & { candidates?: string[] | string };
  const candidates = Array.isArray(b.candidates) ? b.candidates : safeList(String(b.candidates ?? "[]"));
  await c.env.DB.prepare("INSERT INTO aliases(name, description, candidates) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET description = excluded.description, candidates = excluded.candidates")
    .bind(name, b.description ?? "", JSON.stringify(candidates)).run();
  return c.json({ ok: true });
});
admin.delete("/aliases/:name", async (c) => { await c.env.DB.prepare("DELETE FROM aliases WHERE name = ?").bind(decodeURIComponent(c.req.param("name"))).run(); return c.json({ ok: true }); });

// ---------- settings / sync ----------
admin.get("/settings", async (c) => {
  const s = await getSettings(c.env);
  const providers = ["workers-ai", "anthropic", "openai", "openrouter", "google-ai-studio", "groq", "mistral", "deepseek"];
  const configured = providers.filter((p) => (p === "workers-ai" ? !!(c.env.CLOUDFLARE_API_TOKEN || c.env.AI_GATEWAY_TOKEN) : !!(c.env[p.toUpperCase().replace(/-/g, "_") + "_API_KEY"] || c.env.AI_GATEWAY_TOKEN)));
  return c.json({ settings: s, providers_configured: configured, gateway_id: c.env.AI_GATEWAY_ID, timezone: c.env.BUDGET_TIMEZONE, base_url: c.env.PUBLIC_BASE_URL, sso_configured: !!c.env.SAAS_SSO_SECRET, cost_sync_available: !!c.env.CLOUDFLARE_API_TOKEN });
});
admin.put("/settings", async (c) => {
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const allowed = ["global_daily_usd", "global_weekly_usd", "global_monthly_usd"];
  for (const k of allowed) if (k in b) await setSetting(c.env, k, b[k] === null || b[k] === "" ? "" : String(Math.max(0, Number(b[k]) || 0)));
  return c.json({ ok: true });
});
admin.post("/sync-costs", async (c) => {
  try { return c.json(await syncCosts(c.env, { force: true })); } catch (e) { return c.json({ error: (e as Error).message }, 502); }
});
