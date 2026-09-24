import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { requireAuth } from "../middleware";
import { ok } from "../lib/http";
import { Errors } from "../lib/errors";
import { toMessageDTO, toOrganizationDTO, toUserDTO } from "../services/mappers";
import { entitlements } from "../services/entitlements";
import { createApiKey } from "../services/auth";
import { audit } from "../services/audit";
import { slugify } from "../lib/ids";
import { globalSearch } from "../services/search";
import { parsePage } from "../lib/http";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

const ProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(), avatar_url: z.string().url().max(500).nullable().optional(), locale: z.enum(["en", "zh-CN", "zh-TW"]).optional(), theme: z.enum(["system", "light", "dark"]).optional(),
  default_model_id: z.string().uuid().nullable().optional(), default_mode_id: z.string().uuid().nullable().optional(), response_style: z.enum(["balanced", "concise", "detailed", "scholarly"]).optional(),
  memory_enabled: z.boolean().optional(), history_enabled: z.boolean().optional(), interests: z.array(z.string().max(40)).max(12).optional(), onboarding_completed: z.boolean().optional(),
});
router.patch("/profile", async (c) => {
  const ctx = c.get("ctx");
  const body = ProfileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid profile data.", body.error.issues);
  if (body.data.default_model_id) { const m = await ctx.repos.models.findById(body.data.default_model_id); if (!m || !(await entitlements(ctx).canUseModel(ctx.user!, m)).allowed) throw Errors.validation("That model is not available on your plan."); }
  const u = await ctx.repos.users.update(ctx.user!.id, body.data as never);
  return ok(c, { user: toUserDTO(u!) });
});

router.get("/entitlements", async (c) => ok(c, await entitlements(c.get("ctx")).entitlements(c.get("ctx").user!)));

router.get("/usage", async (c) => { const ctx = c.get("ctx"); return ok(c, { daily: await ctx.repos.usage.userDaily(ctx.user!.id, 30) }); });

router.get("/saved", async (c) => {
  const ctx = c.get("ctx"); const p = parsePage(c.req.query(), 30, 100);
  const rows = await ctx.repos.messages.bookmarks(ctx.user!.id, p.offset, p.page_size);
  const sources = await ctx.repos.messageSources.listForMessages(rows.map((r) => r.id));
  return ok(c, { items: rows.map((r) => ({ ...toMessageDTO(r, sources.filter((s) => s.message_id === r.id)), conversation_title: r.conversation_title })), total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size });
});

/** Privacy / data controls. */
router.delete("/history", async (c) => {
  const ctx = c.get("ctx");
  await ctx.repos.conversations.deleteAllForUser(ctx.user!.id);
  await audit(ctx, { action: "user.history_cleared", resource_type: "user", resource_id: ctx.user!.id });
  return ok(c, { cleared: true });
});
router.delete("/", async (c) => {
  const ctx = c.get("ctx");
  if (ctx.user!.role === "super_admin") throw Errors.forbidden("Super administrators cannot delete their own account here.");
  await ctx.repos.conversations.deleteAllForUser(ctx.user!.id);
  await ctx.repos.sessions.deleteAllForUser(ctx.user!.id);
  await ctx.repos.users.softDelete(ctx.user!.id);
  await audit(ctx, { action: "user.account_deleted", resource_type: "user", resource_id: ctx.user!.id });
  return ok(c, { deleted: true });
});

// ── API keys (Enterprise / API access) ──
router.get("/api-keys", async (c) => {
  const ctx = c.get("ctx");
  return ok(c, (await ctx.repos.apiKeys.listForUser(ctx.user!.id)).map((k) => ({ id: k.id, name: k.name, key_prefix: k.key_prefix, last_used_at: k.last_used_at, created_at: k.created_at })));
});
router.post("/api-keys", async (c) => {
  const ctx = c.get("ctx");
  const ent = await entitlements(ctx).entitlements(ctx.user!);
  if (!ent.can_use_api) throw Errors.upgradeRequired("API access is available on the Enterprise plan.", "enterprise", "api");
  const body = z.object({ name: z.string().min(1).max(80) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Key name is required.");
  return ok(c, await createApiKey(ctx, ctx.user!, body.data.name), ["Copy this key now. It will not be shown again."], 201);
});
router.delete("/api-keys/:id", async (c) => {
  const ctx = c.get("ctx");
  await ctx.repos.apiKeys.revoke(c.req.param("id"), ctx.user!.id);
  await audit(ctx, { action: "user.api_key_revoked", resource_type: "api_key", resource_id: c.req.param("id") });
  return ok(c, { revoked: true });
});

// ── Organizations (Enterprise) ──
router.get("/organizations", async (c) => { const ctx = c.get("ctx"); return ok(c, (await ctx.repos.organizations.listForUser(ctx.user!.id)).map(toOrganizationDTO)); });
router.post("/organizations", async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ name: z.string().min(2).max(100) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Organization name is required.");
  let slug = slugify(body.data.name); if (await ctx.repos.db.one(`SELECT 1 FROM organizations WHERE slug = $1`, [slug])) slug = `${slug}-${Date.now().toString(36)}`;
  const org = (await ctx.repos.organizations.create({ name: body.data.name, slug, owner_user_id: ctx.user!.id, plan_id: null }))!;
  await ctx.repos.organizations.addMember(org.id, ctx.user!.id, "owner");
  await audit(ctx, { action: "organization.created", resource_type: "organization", resource_id: org.id });
  return ok(c, toOrganizationDTO({ ...org, role: "owner", member_count: 1 }), undefined, 201);
});
router.get("/organizations/:id/members", async (c) => {
  const ctx = c.get("ctx");
  if (!ctx.user!.org_ids.includes(c.req.param("id"))) throw Errors.forbidden();
  return ok(c, await ctx.repos.organizations.members(c.req.param("id")));
});
router.post("/organizations/:id/members", async (c) => {
  const ctx = c.get("ctx"); const orgId = c.req.param("id");
  const me = await ctx.repos.organizations.membership(orgId, ctx.user!.id);
  if (!me || !["owner", "admin"].includes(me.role)) throw Errors.forbidden("Only organization owners and admins can add members.");
  const body = z.object({ email: z.string().email(), role: z.enum(["admin", "member"]).default("member") }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Email is required.");
  const u = await ctx.repos.users.findByEmail(body.data.email);
  if (!u) throw Errors.notFound("User with that email");
  await ctx.repos.organizations.addMember(orgId, u.id, body.data.role);
  await entitlements(ctx).invalidate(u.id);
  await audit(ctx, { action: "organization.member_added", resource_type: "organization", resource_id: orgId, details: { user_id: u.id, role: body.data.role } });
  return ok(c, { added: true });
});
router.delete("/organizations/:id/members/:userId", async (c) => {
  const ctx = c.get("ctx"); const orgId = c.req.param("id");
  const me = await ctx.repos.organizations.membership(orgId, ctx.user!.id);
  if (!me || !["owner", "admin"].includes(me.role)) throw Errors.forbidden();
  const org = await ctx.repos.organizations.findById(orgId);
  if (org?.owner_user_id === c.req.param("userId")) throw Errors.validation("The owner cannot be removed.");
  await ctx.repos.organizations.removeMember(orgId, c.req.param("userId"));
  await entitlements(ctx).invalidate(c.req.param("userId"));
  return ok(c, { removed: true });
});

router.get("/search", async (c) => ok(c, await globalSearch(c.get("ctx"), c.get("ctx").user!, c.req.query("q") ?? "")));

export default router;
