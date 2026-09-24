import { Hono } from "hono";
import { z } from "zod";
import { SOURCE_TYPE_WEIGHTS, SUPPORTED_UPLOAD_TYPES } from "@xuanzhi/shared-types";
import type { HonoEnv } from "../../middleware";
import { requireAdmin, requireSuperAdmin } from "../../middleware";
import { ok, parsePage } from "../../lib/http";
import { Errors } from "../../lib/errors";
import { audit } from "../../services/audit";
import { encryptString, hashPassword } from "../../lib/crypto";
import { toAuditDTO, toCategoryDTO, toDocumentDTO, toKnowledgeBaseDTO, toModeDTO, toModelDTO, toOrganizationDTO, toPlanDTO, toUserDTO } from "../../services/mappers";
import { providerConfigured } from "../../services/ai/registry";
import { assignPlan } from "../../services/billing";
import { entitlements } from "../../services/entitlements";
import { kindFor } from "../../services/knowledge/extract";
import { DEMO_DOCUMENTS } from "../../demo";
import { uuid } from "../../lib/ids";
import { daysAgo, startOfUtcDay } from "../../lib/time";
import { DEFAULT_GENERAL_PROMPT, DEFAULT_RAG_PROMPT, DEFAULT_SAFETY_PROMPT } from "../../services/chat/prompt-builder";

const router = new Hono<HonoEnv>();
router.use("*", requireAdmin);

const json = async <T extends z.ZodTypeAny>(c: { req: { json(): Promise<unknown> } }, schema: T, msg = "Invalid data."): Promise<z.infer<T>> => {
  const r = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!r.success) throw Errors.validation(msg, r.error.issues);
  return r.data;
};

// ───────── Dashboard & analytics ─────────
router.get("/dashboard", async (c) => {
  const ctx = c.get("ctx"); const r = ctx.repos;
  const today = startOfUtcDay(); const month = daysAgo(30);
  const [users, activeToday, usageToday, usageMonth, kstats, mrr, topModels, topUsers, topKbs, dist, feedback, ksearches] = await Promise.all([
    r.users.count(), r.sessions.activeUsersSince(today), r.usage.summary(today), r.usage.summary(month), r.documents.stats(), r.subscriptions.monthlyRevenue(),
    r.usage.topModels(month), r.usage.topUsers(month), r.usage.topKnowledgeBases(month), r.subscriptions.planDistribution(), r.analytics.feedbackSummary(), r.usage.knowledgeSearches(month),
  ]);
  return ok(c, { users, active_today: activeToday, requests_today: usageToday.requests, tokens_today: usageToday.tokens, cost_today: usageToday.estimated_cost, requests_month: usageMonth.requests, tokens_month: usageMonth.tokens, cost_month: usageMonth.estimated_cost, knowledge: kstats, knowledge_searches_month: ksearches, monthly_revenue: mrr, top_models: topModels, top_users: topUsers, top_knowledge_bases: topKbs, plan_distribution: dist, feedback });
});
router.get("/analytics", async (c) => {
  const ctx = c.get("ctx"); const days = Math.min(365, Math.max(7, Number(c.req.query("days") ?? "30") || 30));
  const [growth, usage, topModels, topics, conversations] = await Promise.all([ctx.repos.analytics.userGrowth(days), ctx.repos.usage.daily(days), ctx.repos.usage.topModels(daysAgo(days), 10), ctx.repos.analytics.popularTopics(daysAgo(days)), ctx.repos.analytics.conversationsCount()]);
  const dist = await ctx.repos.subscriptions.planDistribution();
  const plans = await ctx.repos.plans.listAll();
  const revenue = usage.map((d) => ({ day: d.day, mrr: dist.reduce((a, x) => a + x.n * Number(plans.find((p) => p.code === x.code)?.price_monthly ?? 0), 0) }));
  return ok(c, { user_growth: growth, usage, model_usage: topModels, popular_topics: topics, revenue, conversations });
});
router.get("/usage", async (c) => {
  const ctx = c.get("ctx"); const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? "30") || 30));
  const since = daysAgo(days);
  const [summary, daily, topModels, topUsers, topKbs] = await Promise.all([ctx.repos.usage.summary(since), ctx.repos.usage.daily(days), ctx.repos.usage.topModels(since, 12), ctx.repos.usage.topUsers(since, 12), ctx.repos.usage.topKnowledgeBases(since, 12)]);
  return ok(c, { summary, daily, top_models: topModels, top_users: topUsers, top_knowledge_bases: topKbs });
});

// ───────── Users ─────────
router.get("/users", async (c) => {
  const ctx = c.get("ctx"); const q = c.req.query(); const p = parsePage(q, 25, 100);
  const rows = await ctx.repos.users.list({ search: q.search, role: q.role, offset: p.offset, limit: p.page_size });
  const out = [];
  for (const u of rows) { const sub = await ctx.repos.subscriptions.activeForUser(u.id); out.push({ ...toUserDTO(u), is_active: u.is_active, last_login_at: u.last_login_at, plan_code: sub?.plan.code ?? "free", plan_managed_by: sub?.managed_by ?? null }); }
  return ok(c, { items: out, total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size });
});
router.patch("/users/:id", async (c) => {
  const ctx = c.get("ctx"); const id = c.req.param("id");
  const body = await json(c, z.object({ name: z.string().min(1).max(100).optional(), role: z.enum(["user", "admin", "super_admin"]).optional(), is_active: z.boolean().optional(), email_verified: z.boolean().optional(), new_password: z.string().min(8).max(200).optional() }));
  const target = await ctx.repos.users.findById(id); if (!target) throw Errors.notFound("User");
  if ((body.role || body.is_active === false) && ctx.user!.role !== "super_admin" && (target.role !== "user" || body.role !== undefined)) throw Errors.forbidden("Only a super administrator can change roles or disable administrators.");
  if (id === ctx.user!.id && (body.is_active === false || (body.role && body.role !== ctx.user!.role))) throw Errors.validation("You cannot change your own role or disable yourself.");
  const patch: Record<string, unknown> = { name: body.name, role: body.role, is_active: body.is_active };
  if (body.email_verified !== undefined) patch.email_verified_at = body.email_verified ? new Date().toISOString() : null;
  if (body.new_password) patch.password_hash = await hashPassword(body.new_password);
  const u = await ctx.repos.users.update(id, patch);
  if (body.is_active === false) await ctx.repos.sessions.deleteAllForUser(id);
  await audit(ctx, { action: "admin.user_updated", resource_type: "user", resource_id: id, details: { role: body.role, is_active: body.is_active, name: body.name, password_reset: !!body.new_password, email_verified: body.email_verified } });
  return ok(c, toUserDTO(u!));
});
router.post("/users/:id/plan", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ plan_id: z.string().uuid() }));
  if (!(await ctx.repos.users.findById(c.req.param("id")))) throw Errors.notFound("User");
  await assignPlan(ctx, { user_id: c.req.param("id") }, body.plan_id);
  return ok(c, { assigned: true });
});
router.delete("/users/:id", requireSuperAdmin, async (c) => {
  const ctx = c.get("ctx"); const id = c.req.param("id");
  if (id === ctx.user!.id) throw Errors.validation("You cannot delete yourself.");
  await ctx.repos.sessions.deleteAllForUser(id); await ctx.repos.conversations.deleteAllForUser(id); await ctx.repos.users.softDelete(id);
  await audit(ctx, { action: "admin.user_deleted", resource_type: "user", resource_id: id });
  return ok(c, { deleted: true });
});

// ───────── Organizations ─────────
router.get("/organizations", async (c) => {
  const ctx = c.get("ctx"); const q = c.req.query(); const p = parsePage(q, 25, 100);
  const rows = await ctx.repos.organizations.listAll({ search: q.search, offset: p.offset, limit: p.page_size });
  return ok(c, { items: rows.map((o) => ({ ...toOrganizationDTO(o), owner_email: o.owner_email })), total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size });
});
router.post("/organizations", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ name: z.string().min(2).max(100), slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/), owner_email: z.string().email(), plan_id: z.string().uuid().nullable().optional() }));
  const owner = await ctx.repos.users.findByEmail(body.owner_email); if (!owner) throw Errors.notFound("Owner user");
  const org = (await ctx.repos.organizations.create({ name: body.name, slug: body.slug, owner_user_id: owner.id, plan_id: body.plan_id ?? null }))!;
  await ctx.repos.organizations.addMember(org.id, owner.id, "owner");
  await entitlements(ctx).invalidate(owner.id);
  await audit(ctx, { action: "admin.organization_created", resource_type: "organization", resource_id: org.id, details: { name: body.name } });
  return ok(c, toOrganizationDTO(org), undefined, 201);
});
router.patch("/organizations/:id", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ name: z.string().min(2).max(100).optional(), plan_id: z.string().uuid().nullable().optional() }));
  const org = await ctx.repos.organizations.update(c.req.param("id"), body); if (!org) throw Errors.notFound("Organization");
  for (const m of await ctx.repos.organizations.members(org.id)) await entitlements(ctx).invalidate(m.user_id);
  await audit(ctx, { action: "admin.organization_updated", resource_type: "organization", resource_id: org.id, details: body });
  return ok(c, toOrganizationDTO(org));
});
router.get("/organizations/:id/members", async (c) => ok(c, await c.get("ctx").repos.organizations.members(c.req.param("id"))));
router.post("/organizations/:id/members", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ email: z.string().email(), role: z.enum(["owner", "admin", "member"]).default("member") }));
  const u = await ctx.repos.users.findByEmail(body.email); if (!u) throw Errors.notFound("User");
  await ctx.repos.organizations.addMember(c.req.param("id"), u.id, body.role); await entitlements(ctx).invalidate(u.id);
  await audit(ctx, { action: "admin.organization_member_added", resource_type: "organization", resource_id: c.req.param("id"), details: { user_id: u.id, role: body.role } });
  return ok(c, { added: true });
});
router.delete("/organizations/:id/members/:userId", async (c) => {
  const ctx = c.get("ctx"); await ctx.repos.organizations.removeMember(c.req.param("id"), c.req.param("userId")); await entitlements(ctx).invalidate(c.req.param("userId"));
  await audit(ctx, { action: "admin.organization_member_removed", resource_type: "organization", resource_id: c.req.param("id"), details: { user_id: c.req.param("userId") } });
  return ok(c, { removed: true });
});
router.delete("/organizations/:id", requireSuperAdmin, async (c) => {
  const ctx = c.get("ctx"); await ctx.repos.organizations.softDelete(c.req.param("id"));
  await audit(ctx, { action: "admin.organization_deleted", resource_type: "organization", resource_id: c.req.param("id") });
  return ok(c, { deleted: true });
});

// ───────── Providers & models ─────────
router.get("/providers", async (c) => {
  const ctx = c.get("ctx"); const out = [];
  for (const p of await ctx.repos.providers.list()) out.push({ id: p.id, code: p.code, name: p.name, base_url: p.base_url, is_active: p.is_active, priority: p.priority, has_key: !!p.api_key_encrypted, configured: await providerConfigured(ctx, p), env_key: p.code === "openai" ? !!ctx.env.OPENAI_API_KEY : p.code === "anthropic" ? !!ctx.env.ANTHROPIC_API_KEY : p.code === "google" ? !!ctx.env.GOOGLE_API_KEY : false });
  return ok(c, out);
});
router.patch("/providers/:id", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ name: z.string().min(1).max(80).optional(), base_url: z.string().url().nullable().optional(), api_key: z.string().max(500).nullable().optional(), is_active: z.boolean().optional(), priority: z.number().int().optional() }));
  const patch: Record<string, unknown> = { name: body.name, base_url: body.base_url, is_active: body.is_active, priority: body.priority };
  if (body.api_key !== undefined) {
    if (body.api_key === null || body.api_key === "") patch.api_key_encrypted = null;
    else { if (!ctx.env.ENCRYPTION_KEY) throw Errors.notConfigured("ENCRYPTION_KEY is not set; cannot store API keys."); patch.api_key_encrypted = await encryptString(body.api_key, ctx.env.ENCRYPTION_KEY); }
  }
  const p = await ctx.repos.providers.update(c.req.param("id"), patch as never); if (!p) throw Errors.notFound("Provider");
  await audit(ctx, { action: "admin.provider_updated", resource_type: "ai_provider", resource_id: p.id, details: { fields: Object.keys(body), key_changed: body.api_key !== undefined } });
  return ok(c, { id: p.id, code: p.code, name: p.name, base_url: p.base_url, is_active: p.is_active, priority: p.priority, has_key: !!p.api_key_encrypted, configured: await providerConfigured(ctx, p) });
});

router.get("/models", async (c) => {
  const ctx = c.get("ctx");
  const [models, pm, plans] = await Promise.all([ctx.repos.models.listAll(), ctx.repos.plans.allPlanModels(), ctx.repos.plans.listAll()]);
  return ok(c, { models: models.map((m) => ({ ...toModelDTO(m), provider_id: m.provider_id, model_active: m.is_active, plan_codes: pm.filter((x) => x.model_id === m.id).map((x) => x.plan_code) })), plans: plans.map(toPlanDTO) });
});
const ModelSchema = z.object({ provider_id: z.string().uuid(), name: z.string().min(1).max(100), model_identifier: z.string().min(1).max(200), description: z.string().max(500).nullable().optional(), context_window: z.number().int().min(1000).max(10_000_000), max_output_tokens: z.number().int().min(64).max(200_000), input_cost_per_million: z.number().min(0), output_cost_per_million: z.number().min(0), tier: z.enum(["basic", "advanced", "premium"]), is_active: z.boolean().default(true), priority: z.number().int().default(0), is_default: z.boolean().default(false), plan_ids: z.array(z.string().uuid()).optional() });
router.post("/models", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, ModelSchema);
  if (body.is_default) await ctx.repos.models.clearDefault();
  const r = (await ctx.repos.models.create({ ...body, description: body.description ?? null }))!;
  if (body.plan_ids) await ctx.repos.plans.setPlanModels(r.id, body.plan_ids);
  await audit(ctx, { action: "admin.model_created", resource_type: "model", resource_id: r.id, details: { name: body.name, model_identifier: body.model_identifier } });
  return ok(c, toModelDTO((await ctx.repos.models.findById(r.id))!), undefined, 201);
});
router.patch("/models/:id", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, ModelSchema.partial());
  const before = await ctx.repos.models.findById(c.req.param("id")); if (!before) throw Errors.notFound("Model");
  const { plan_ids, ...patch } = body;
  if (patch.is_default) await ctx.repos.models.clearDefault();
  await ctx.repos.models.update(before.id, patch);
  if (plan_ids) await ctx.repos.plans.setPlanModels(before.id, plan_ids);
  const after = (await ctx.repos.models.findById(before.id))!;
  await audit(ctx, { action: before.is_active && patch.is_active === false ? "admin.model_disabled" : "admin.model_updated", resource_type: "model", resource_id: before.id, details: { changes: Object.keys(body), before: { is_active: before.is_active, input_cost_per_million: before.input_cost_per_million, output_cost_per_million: before.output_cost_per_million, model_identifier: before.model_identifier }, after: { is_active: after.is_active, input_cost_per_million: after.input_cost_per_million, output_cost_per_million: after.output_cost_per_million, model_identifier: after.model_identifier, plan_ids } } });
  return ok(c, toModelDTO(after));
});
router.delete("/models/:id", requireSuperAdmin, async (c) => {
  const ctx = c.get("ctx"); await ctx.repos.models.delete(c.req.param("id"));
  await audit(ctx, { action: "admin.model_deleted", resource_type: "model", resource_id: c.req.param("id") });
  return ok(c, { deleted: true });
});

// ───────── Plans ─────────
router.get("/plans", async (c) => ok(c, (await c.get("ctx").repos.plans.listAll()).map(toPlanDTO)));
router.patch("/plans/:id", async (c) => {
  const ctx = c.get("ctx");
  const body = await json(c, z.object({ name: z.string().min(1).max(60).optional(), description: z.string().max(300).nullable().optional(), price_monthly: z.number().min(0).optional(), currency: z.string().length(3).optional(), message_limit_daily: z.number().int().min(0).nullable().optional(), knowledge_search_limit_daily: z.number().int().min(0).nullable().optional(), context_window_tokens: z.number().int().min(1000).optional(), max_upload_files_per_day: z.number().int().min(0).optional(), max_conversations: z.number().int().min(1).nullable().optional(), allow_file_upload: z.boolean().optional(), allow_advanced_modes: z.boolean().optional(), allow_premium_knowledge: z.boolean().optional(), allow_api_access: z.boolean().optional(), priority: z.number().int().optional(), features: z.array(z.string().max(120)).max(12).optional(), stripe_price_id: z.string().max(100).nullable().optional(), is_active: z.boolean().optional(), sort_order: z.number().int().optional() }));
  const before = await ctx.repos.plans.findById(c.req.param("id")); if (!before) throw Errors.notFound("Plan");
  const p = (await ctx.repos.plans.update(before.id, body as never))!;
  await audit(ctx, { action: body.price_monthly !== undefined && Number(body.price_monthly) !== Number(before.price_monthly) ? "admin.plan_price_changed" : "admin.plan_updated", resource_type: "plan", resource_id: p.id, details: { before: { price_monthly: before.price_monthly }, after: { price_monthly: p.price_monthly }, changes: Object.keys(body) } });
  return ok(c, toPlanDTO(p));
});

// ───────── Modes ─────────
router.get("/modes", async (c) => ok(c, (await c.get("ctx").repos.modes.listAll()).map((m) => ({ ...toModeDTO(m), prompt_id: m.prompt_id }))));
const ModeSchema = z.object({ code: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/), name: z.string().min(1).max(80), name_zh: z.string().min(1).max(80), name_zh_tw: z.string().min(1).max(80), description: z.string().max(300).default(""), description_zh: z.string().max(300).default(""), description_zh_tw: z.string().max(300).default(""), icon: z.string().max(40).default("bi-stars"), prompt_id: z.string().uuid().nullable().default(null), knowledge_filter: z.array(z.string()).default([]), is_advanced: z.boolean().default(false), is_active: z.boolean().default(true), sort_order: z.number().int().default(0) });
router.post("/modes", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, ModeSchema);
  const m = (await ctx.repos.modes.create(body))!; if (!body.is_active) await ctx.repos.modes.update(m.id, { is_active: false });
  await audit(ctx, { action: "admin.mode_created", resource_type: "ai_mode", resource_id: m.id, details: { code: body.code } });
  return ok(c, toModeDTO(m), undefined, 201);
});
router.patch("/modes/:id", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, ModeSchema.partial().omit({ code: true }));
  const m = await ctx.repos.modes.update(c.req.param("id"), body); if (!m) throw Errors.notFound("Mode");
  await audit(ctx, { action: "admin.mode_updated", resource_type: "ai_mode", resource_id: m.id, details: { changes: Object.keys(body) } });
  return ok(c, toModeDTO(m));
});

// ───────── Prompts (versioned) ─────────
router.get("/prompts", async (c) => ok(c, (await c.get("ctx").repos.prompts.list()).map((p) => ({ id: p.id, code: p.code, name: p.name, description: p.description, active_version: p.active_version, version_count: p.version_count, updated_at: p.updated_at }))));
router.get("/prompts/:id", async (c) => {
  const ctx = c.get("ctx"); const p = await ctx.repos.prompts.findById(c.req.param("id")); if (!p) throw Errors.notFound("Prompt");
  const versions = await ctx.repos.prompts.versions(p.id);
  const defaults: Record<string, string> = { general: DEFAULT_GENERAL_PROMPT, safety: DEFAULT_SAFETY_PROMPT, rag_system: DEFAULT_RAG_PROMPT };
  return ok(c, { id: p.id, code: p.code, name: p.name, description: p.description, active_version_id: p.active_version_id, built_in_default: defaults[p.code] ?? null, versions: versions.map((v) => ({ id: v.id, prompt_id: v.prompt_id, version: v.version, content: v.content, notes: v.notes, created_by: v.created_by, created_at: v.created_at, is_active: v.id === p.active_version_id })) });
});
router.post("/prompts", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ code: z.string().min(2).max(40).regex(/^[a-z0-9_:]+$/), name: z.string().min(1).max(80), description: z.string().max(300).nullable().default(null), content: z.string().min(1).max(20_000) }));
  const p = (await ctx.repos.prompts.create(body.code, body.name, body.description))!;
  await ctx.repos.prompts.addVersion(p.id, body.content, "Initial version", ctx.user!.id, true);
  await audit(ctx, { action: "admin.prompt_created", resource_type: "prompt", resource_id: p.id, details: { code: body.code } });
  return ok(c, { id: p.id }, undefined, 201);
});
router.post("/prompts/:id/versions", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ content: z.string().min(1).max(20_000), notes: z.string().max(300).nullable().default(null), activate: z.boolean().default(true) }));
  const p = await ctx.repos.prompts.findById(c.req.param("id")); if (!p) throw Errors.notFound("Prompt");
  const v = await ctx.repos.prompts.addVersion(p.id, body.content, body.notes, ctx.user!.id, body.activate);
  await audit(ctx, { action: body.activate ? "admin.prompt_changed" : "admin.prompt_version_added", resource_type: "prompt", resource_id: p.id, details: { code: p.code, version: v.version, activated: body.activate } });
  return ok(c, { id: v.id, version: v.version }, undefined, 201);
});
router.post("/prompts/:id/activate/:versionId", async (c) => {
  const ctx = c.get("ctx"); const p = await ctx.repos.prompts.findById(c.req.param("id")); if (!p) throw Errors.notFound("Prompt");
  await ctx.repos.prompts.activate(p.id, c.req.param("versionId"));
  await audit(ctx, { action: "admin.prompt_rollback", resource_type: "prompt", resource_id: p.id, details: { code: p.code, version_id: c.req.param("versionId") } });
  return ok(c, { activated: true });
});

// ───────── Knowledge: categories, bases, documents ─────────
router.get("/knowledge/categories", async (c) => ok(c, (await c.get("ctx").repos.categories.list()).map(toCategoryDTO)));
const CategorySchema = z.object({ code: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/), name: z.string().min(1).max(80), name_zh: z.string().min(1).max(80), name_zh_tw: z.string().min(1).max(80), description: z.string().max(300).nullable().default(null), icon: z.string().max(40).default("bi-book"), sort_order: z.number().int().default(100) });
router.post("/knowledge/categories", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, CategorySchema);
  if (await ctx.repos.categories.findByCode(body.code)) throw Errors.conflict("A category with this code already exists.");
  const cat = (await ctx.repos.categories.create(body))!;
  await audit(ctx, { action: "admin.category_created", resource_type: "knowledge_category", resource_id: cat.id, details: { code: body.code } });
  return ok(c, toCategoryDTO(cat), undefined, 201);
});
router.patch("/knowledge/categories/:id", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, CategorySchema.partial().omit({ code: true }));
  const cat = await ctx.repos.categories.update(c.req.param("id"), body); if (!cat) throw Errors.notFound("Category");
  await audit(ctx, { action: "admin.category_updated", resource_type: "knowledge_category", resource_id: cat.id, details: body });
  return ok(c, toCategoryDTO(cat));
});
router.delete("/knowledge/categories/:id", async (c) => {
  const ctx = c.get("ctx"); const cat = await ctx.repos.categories.findById(c.req.param("id")); if (!cat) throw Errors.notFound("Category");
  if (cat.is_system) throw Errors.validation("System categories cannot be deleted.");
  await ctx.repos.categories.delete(cat.id);
  await audit(ctx, { action: "admin.category_deleted", resource_type: "knowledge_category", resource_id: cat.id });
  return ok(c, { deleted: true });
});

router.get("/knowledge/bases", async (c) => ok(c, (await c.get("ctx").repos.knowledgeBases.list()).map(toKnowledgeBaseDTO)));
router.post("/knowledge/bases", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ name: z.string().min(1).max(100), description: z.string().max(300).nullable().default(null), organization_id: z.string().uuid().nullable().default(null), visibility: z.enum(["public", "premium", "private", "admin"]).default("public") }));
  if (body.visibility === "private" && !body.organization_id) throw Errors.validation("Private knowledge bases must belong to an organization.");
  const kb = (await ctx.repos.knowledgeBases.create(body))!;
  await audit(ctx, { action: "admin.knowledge_base_created", resource_type: "knowledge_base", resource_id: kb.id, details: { name: body.name, visibility: body.visibility } });
  return ok(c, toKnowledgeBaseDTO(kb), undefined, 201);
});
router.patch("/knowledge/bases/:id", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ name: z.string().min(1).max(100).optional(), description: z.string().max(300).nullable().optional(), organization_id: z.string().uuid().nullable().optional(), visibility: z.enum(["public", "premium", "private", "admin"]).optional() }));
  const kb = await ctx.repos.knowledgeBases.update(c.req.param("id"), body); if (!kb) throw Errors.notFound("Knowledge base");
  await audit(ctx, { action: "admin.knowledge_base_updated", resource_type: "knowledge_base", resource_id: kb.id, details: body });
  return ok(c, toKnowledgeBaseDTO(kb));
});
router.delete("/knowledge/bases/:id", requireSuperAdmin, async (c) => {
  const ctx = c.get("ctx"); await ctx.repos.knowledgeBases.softDelete(c.req.param("id"));
  await audit(ctx, { action: "admin.knowledge_base_deleted", resource_type: "knowledge_base", resource_id: c.req.param("id") });
  return ok(c, { deleted: true });
});

router.get("/knowledge", async (c) => {
  const ctx = c.get("ctx"); const q = c.req.query(); const p = parsePage(q, 25, 100);
  const [rows, stats] = await Promise.all([ctx.repos.documents.list({ search: q.search, category_id: q.category_id, language: q.language, status: q.status, visibility: q.visibility, author: q.author, knowledge_base_id: q.knowledge_base_id, source_type: q.source_type, offset: p.offset, limit: p.page_size }), ctx.repos.documents.stats()]);
  return ok(c, { items: rows.map(toDocumentDTO), total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size, stats });
});
router.get("/knowledge/:id", async (c) => {
  const ctx = c.get("ctx"); const d = await ctx.repos.documents.findById(c.req.param("id")); if (!d) throw Errors.notFound("Document");
  const p = parsePage(c.req.query(), 20, 100); const chunks = await ctx.repos.chunks.listForDocument(d.id, p.offset, p.page_size);
  return ok(c, { document: toDocumentDTO(d), preview: d.extracted_text?.slice(0, 4000) ?? null, chunks: chunks.map((x) => ({ id: x.id, document_id: x.document_id, chunk_index: x.chunk_index, content: x.content, token_count: x.token_count, page_number: x.page_number, section: x.section })), total_chunks: chunks[0]?.total ?? 0 });
});
const DocMeta = z.object({ title: z.string().min(1).max(200).optional(), category_id: z.string().uuid().nullable().optional(), knowledge_base_id: z.string().uuid().optional(), language: z.enum(["en", "zh-CN", "zh-TW", "other"]).optional(), author: z.string().max(120).nullable().optional(), source: z.string().max(300).nullable().optional(), publication_date: z.string().max(40).nullable().optional(), tags: z.array(z.string().max(40)).max(20).optional(), source_type: z.enum(["primary_classical", "scholarly", "historical", "modern_commentary", "community"]).optional(), visibility: z.enum(["public", "premium", "private", "admin"]).optional() });

/** Multipart upload → R2 → document row → background processing. Metadata fields travel alongside the file. */
router.post("/knowledge/upload", async (c) => {
  const ctx = c.get("ctx");
  const form = await c.req.parseBody();
  const file = form.file; if (!(file instanceof File)) throw Errors.validation("Attach a file in the `file` field.");
  const max = Number(ctx.env.MAX_UPLOAD_BYTES || "26214400"); if (file.size > max) throw Errors.tooLarge(max);
  const kind = kindFor(file.type, file.name); if (!kind) throw Errors.unsupported("Supported: PDF, DOCX, TXT, Markdown, HTML, CSV, JSON.");
  const metaRaw: Record<string, unknown> = {}; for (const k of Object.keys(DocMeta.shape)) if (typeof form[k] === "string" && form[k] !== "") metaRaw[k] = k === "tags" ? String(form[k]).split(",").map((t) => t.trim()).filter(Boolean) : form[k];
  const meta = DocMeta.safeParse(metaRaw); if (!meta.success) throw Errors.validation("Invalid document metadata.", meta.error.issues);
  const kb = meta.data.knowledge_base_id ? await ctx.repos.knowledgeBases.findById(meta.data.knowledge_base_id) : await ctx.repos.knowledgeBases.findDefault();
  if (!kb) throw Errors.validation("Knowledge base not found.");
  const mime = file.type || Object.entries(SUPPORTED_UPLOAD_TYPES).find(([, v]) => v === kind)?.[0] || "application/octet-stream";
  const key = `knowledge/${kb.id}/${uuid()}-${file.name.replace(/[^\w.\-一-鿿]+/g, "_").slice(0, 120)}`;
  await ctx.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: mime } });
  const source_type = meta.data.source_type ?? "modern_commentary";
  const d = (await ctx.repos.documents.create({ knowledge_base_id: kb.id, category_id: meta.data.category_id ?? null, title: meta.data.title ?? file.name.replace(/\.[^.]+$/, ""), filename: file.name.slice(0, 200), mime_type: mime, file_key: key, file_size: file.size, language: meta.data.language ?? "en", author: meta.data.author ?? null, source: meta.data.source ?? null, publication_date: meta.data.publication_date ?? null, tags: meta.data.tags ?? [], source_type, source_weight: SOURCE_TYPE_WEIGHTS[source_type], visibility: meta.data.visibility ?? kb.visibility, is_demo: false, uploaded_by: ctx.user!.id }))!;
  await ctx.repos.documents.appendLog(d.id, "upload", `Uploaded ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  await ctx.enqueue({ type: "PROCESS_DOCUMENT", document_id: d.id, correlation_id: ctx.correlationId });
  await audit(ctx, { action: "admin.document_uploaded", resource_type: "document", resource_id: d.id, details: { title: d.title, filename: file.name, size: file.size, visibility: d.visibility } });
  return ok(c, toDocumentDTO((await ctx.repos.documents.findById(d.id))!), undefined, 201);
});
router.put("/knowledge/:id", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, DocMeta);
  const before = await ctx.repos.documents.findById(c.req.param("id")); if (!before) throw Errors.notFound("Document");
  const patch: Record<string, unknown> = { ...body }; if (body.source_type) patch.source_weight = SOURCE_TYPE_WEIGHTS[body.source_type];
  const d = (await ctx.repos.documents.update(before.id, patch))!;
  await audit(ctx, { action: body.visibility && body.visibility !== before.visibility ? "admin.document_visibility_changed" : "admin.document_updated", resource_type: "document", resource_id: d.id, details: { changes: Object.keys(body), before: { visibility: before.visibility, category_id: before.category_id }, after: { visibility: d.visibility, category_id: d.category_id } } });
  return ok(c, toDocumentDTO((await ctx.repos.documents.findById(d.id))!));
});
router.post("/knowledge/:id/reprocess", async (c) => {
  const ctx = c.get("ctx"); const d = await ctx.repos.documents.findById(c.req.param("id")); if (!d) throw Errors.notFound("Document");
  await ctx.repos.documents.update(d.id, { status: "uploaded", progress: 0, error: null, processing_log: [{ at: new Date().toISOString(), step: "reprocess", message: "Reprocessing requested" }] });
  await ctx.enqueue({ type: "PROCESS_DOCUMENT", document_id: d.id, correlation_id: ctx.correlationId });
  await audit(ctx, { action: "admin.document_reprocessed", resource_type: "document", resource_id: d.id });
  return ok(c, { queued: true });
});
router.post("/knowledge/:id/status", async (c) => {
  const ctx = c.get("ctx"); const body = await json(c, z.object({ enabled: z.boolean() }));
  const d = await ctx.repos.documents.findById(c.req.param("id")); if (!d) throw Errors.notFound("Document");
  if (body.enabled && d.status !== "disabled") return ok(c, toDocumentDTO(d));
  const u = (await ctx.repos.documents.update(d.id, { status: body.enabled ? (d.chunk_count > 0 && d.embedded_count >= d.chunk_count ? "ready" : "uploaded") : "disabled" }))!;
  await audit(ctx, { action: body.enabled ? "admin.document_enabled" : "admin.document_disabled", resource_type: "document", resource_id: d.id });
  return ok(c, toDocumentDTO((await ctx.repos.documents.findById(u.id))!));
});
router.delete("/knowledge/:id", async (c) => {
  const ctx = c.get("ctx"); const d = await ctx.repos.documents.findById(c.req.param("id")); if (!d) throw Errors.notFound("Document");
  await ctx.repos.chunks.deleteForDocument(d.id); await ctx.repos.documents.softDelete(d.id);
  if (d.file_key) ctx.waitUntil(ctx.env.FILES.delete(d.file_key).catch(() => undefined));
  await audit(ctx, { action: "admin.document_deleted", resource_type: "document", resource_id: d.id, details: { title: d.title } });
  return ok(c, { deleted: true });
});

/** Load the bundled demonstration documents (clearly labelled) so the library works right after setup. Idempotent. */
router.post("/knowledge/demo", async (c) => {
  const ctx = c.get("ctx");
  const kb = await ctx.repos.knowledgeBases.findDefault(); if (!kb) throw Errors.validation("No default knowledge base.");
  const cats = await ctx.repos.categories.list();
  const existing = await ctx.repos.documents.list({ offset: 0, limit: 200 });
  const created: string[] = [];
  for (const demo of DEMO_DOCUMENTS) {
    if (existing.some((d) => d.is_demo && d.title === demo.title)) continue;
    const cat = cats.find((x) => x.code === demo.category);
    const d = (await ctx.repos.documents.create({ knowledge_base_id: kb.id, category_id: cat?.id ?? null, title: demo.title, filename: demo.filename, mime_type: "text/markdown", file_key: null, file_size: demo.content.length, language: demo.language, author: demo.author, source: demo.source, publication_date: null, tags: demo.tags, source_type: demo.source_type, source_weight: SOURCE_TYPE_WEIGHTS[demo.source_type], visibility: "public", is_demo: true, uploaded_by: ctx.user!.id, extracted_text: demo.content }))!;
    await ctx.repos.documents.appendLog(d.id, "upload", "Bundled demonstration document loaded");
    await ctx.enqueue({ type: "PROCESS_DOCUMENT", document_id: d.id, correlation_id: ctx.correlationId });
    created.push(d.id);
  }
  await audit(ctx, { action: "admin.demo_content_loaded", resource_type: "knowledge_base", resource_id: kb.id, details: { created: created.length } });
  return ok(c, { created: created.length, skipped: DEMO_DOCUMENTS.length - created.length });
});

// ───────── Settings & audit ─────────
router.get("/settings", async (c) => {
  const ctx = c.get("ctx");
  return ok(c, { settings: await ctx.repos.settings.all(), env: { embedding_model: ctx.env.EMBEDDING_MODEL, job_mode: ctx.env.JOB_MODE, web_origin: ctx.env.WEB_ORIGIN, stripe: !!ctx.env.STRIPE_SECRET_KEY, email: !!ctx.env.RESEND_API_KEY, oauth: { google: !!ctx.env.GOOGLE_CLIENT_ID, microsoft: !!ctx.env.MICROSOFT_CLIENT_ID, apple: !!ctx.env.APPLE_CLIENT_ID }, encryption_key: !!ctx.env.ENCRYPTION_KEY } });
});
router.put("/settings/:key", async (c) => {
  const ctx = c.get("ctx"); const key = c.req.param("key");
  if (!/^[a-z0-9_.]{2,60}$/.test(key)) throw Errors.validation("Invalid setting key.");
  const body = await json(c, z.object({ value: z.unknown() }));
  await ctx.repos.settings.set(key, body.value, ctx.user!.id);
  await audit(ctx, { action: "admin.setting_changed", resource_type: "system_setting", resource_id: key, details: { value: body.value } });
  return ok(c, { saved: true });
});
router.get("/audit", async (c) => {
  const ctx = c.get("ctx"); const q = c.req.query(); const p = parsePage(q, 50, 200);
  const rows = await ctx.repos.audit.list({ action: q.action, actor_id: q.actor_id, resource_type: q.resource_type, offset: p.offset, limit: p.page_size });
  return ok(c, { items: rows.map(toAuditDTO), total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size });
});

export default router;
