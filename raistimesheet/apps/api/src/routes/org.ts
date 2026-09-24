import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { requireAuth, requireRole } from "../middleware";
import { ok, parsePage } from "../lib/http";
import { Errors } from "../lib/errors";
import { isApprover } from "../services/context";
import { toAuditDTO, toProjectDTO, toUserDTO } from "../services/mappers";
import { uuid } from "../lib/ids";
import { nowIso } from "../lib/time";
import { audit } from "../services/audit";
import { hashPassword } from "../lib/crypto";
import { getRetentionPolicy } from "../services/retention";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

// ---- projects & clients (read for all users) ----
router.get("/projects", async (c) => {
  const ctx = c.get("ctx");
  const all = c.req.query("all") === "1" && isApprover(ctx.user);
  const list = await ctx.repos.projects.list(all ? {} : { active_only: true, ...(isApprover(ctx.user) ? {} : { user_id: ctx.user!.id }) });
  return ok(c, list.map(toProjectDTO));
});

router.get("/clients", async (c) => {
  const ctx = c.get("ctx");
  const list = await ctx.repos.clients.list();
  return ok(c, list.map((x) => ({ id: x.id, name: x.name, code: x.code, is_active: !!x.is_active })));
});

// ---- administration ----
const admin = new Hono<HonoEnv>();
admin.use("*", requireRole("ADMIN"));

admin.get("/users", async (c) => {
  const ctx = c.get("ctx");
  const users = await ctx.repos.users.list();
  const roles = await ctx.repos.users.rolesForMany(users.map((u) => u.id));
  return ok(c, users.map((u) => toUserDTO(u, roles.get(u.id) ?? [])));
});

const UserSchema = z.object({ email: z.string().email().max(200), name: z.string().min(2).max(100), password: z.string().min(10).max(200).optional(), roles: z.array(z.enum(["ADMIN", "APPROVER", "USER"])).min(1), timezone: z.string().max(60).optional(), whatsapp_aliases: z.array(z.string().max(60)).max(10).optional(), jira_account_id: z.string().max(120).nullable().optional(), is_active: z.boolean().optional() });

admin.post("/users", async (c) => {
  const ctx = c.get("ctx");
  const body = UserSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid user data.", body.error.issues);
  if (!body.data.password) throw Errors.validation("A password (min 10 characters) is required for new users.");
  if (await ctx.repos.users.findByEmail(body.data.email)) throw Errors.conflict("A user with that email already exists.");
  const id = uuid();
  const now = nowIso();
  await ctx.repos.users.create({ id, email: body.data.email.toLowerCase(), name: body.data.name, password_hash: await hashPassword(body.data.password), timezone: body.data.timezone ?? "Asia/Kuala_Lumpur", whatsapp_aliases: JSON.stringify(body.data.whatsapp_aliases ?? [body.data.name]), jira_account_id: body.data.jira_account_id ?? null, is_active: body.data.is_active === false ? 0 : 1, onboarding_completed: 0, created_at: now, updated_at: now });
  await ctx.repos.users.setRoles(id, body.data.roles);
  await audit(ctx, { entity_type: "user", entity_id: id, action: "created", after: { email: body.data.email, roles: body.data.roles } });
  return ok(c, toUserDTO((await ctx.repos.users.findById(id))!, body.data.roles), undefined, 201);
});

admin.patch("/users/:id", async (c) => {
  const ctx = c.get("ctx");
  const id = c.req.param("id");
  const body = UserSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid user data.", body.error.issues);
  const before = await ctx.repos.users.findById(id);
  if (!before) throw Errors.notFound("User");
  if (id === ctx.user!.id && body.data.roles && !body.data.roles.includes("ADMIN")) throw Errors.validation("You cannot remove your own admin role.");
  await ctx.repos.users.update(id, { email: body.data.email?.toLowerCase(), name: body.data.name, password_hash: body.data.password ? await hashPassword(body.data.password) : undefined, timezone: body.data.timezone, whatsapp_aliases: body.data.whatsapp_aliases ? JSON.stringify(body.data.whatsapp_aliases) : undefined, jira_account_id: body.data.jira_account_id === undefined ? undefined : body.data.jira_account_id, is_active: body.data.is_active === undefined ? undefined : body.data.is_active ? 1 : 0, updated_at: nowIso(), updated_by: ctx.user!.id });
  if (body.data.roles) await ctx.repos.users.setRoles(id, body.data.roles);
  const roles = await ctx.repos.users.rolesFor(id);
  await audit(ctx, { entity_type: "user", entity_id: id, action: "updated", before: { name: before.name, email: before.email, is_active: before.is_active }, after: { ...body.data, password: undefined, roles } });
  return ok(c, toUserDTO((await ctx.repos.users.findById(id))!, roles));
});

const ClientSchema = z.object({ name: z.string().min(2).max(100), code: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/), is_active: z.boolean().optional() });
admin.post("/clients", async (c) => {
  const ctx = c.get("ctx");
  const body = ClientSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Client needs a name and an uppercase code.", body.error.issues);
  const id = uuid();
  await ctx.repos.clients.create({ id, name: body.data.name, code: body.data.code, is_active: body.data.is_active === false ? 0 : 1, created_at: nowIso(), updated_at: nowIso() });
  await audit(ctx, { entity_type: "client", entity_id: id, action: "created", after: body.data });
  return ok(c, { id }, undefined, 201);
});
admin.patch("/clients/:id", async (c) => {
  const ctx = c.get("ctx");
  const body = ClientSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid client data.");
  await ctx.repos.clients.update(c.req.param("id"), { name: body.data.name, code: body.data.code, is_active: body.data.is_active === undefined ? undefined : body.data.is_active ? 1 : 0, updated_at: nowIso() });
  await audit(ctx, { entity_type: "client", entity_id: c.req.param("id"), action: "updated", after: body.data });
  return ok(c, { updated: true });
});

const ProjectSchema = z.object({ client_id: z.string(), name: z.string().min(2).max(120), code: z.string().min(2).max(12).regex(/^[A-Z0-9]+$/), jira_project_key: z.string().max(20).regex(/^[A-Z][A-Z0-9]*$/).nullable().optional(), jira_url: z.string().url().nullable().optional(), default_issue_type: z.string().max(40).optional(), default_assignee_account_id: z.string().max(120).nullable().optional(), timezone: z.string().max(60).optional(), working_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(), working_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(), is_active: z.boolean().optional(), member_ids: z.array(z.string()).optional() });

admin.post("/projects", async (c) => {
  const ctx = c.get("ctx");
  const body = ProjectSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid project data.", body.error.issues);
  if (!(await ctx.repos.clients.findById(body.data.client_id))) throw Errors.validation("Unknown client.");
  const id = uuid();
  const now = nowIso();
  await ctx.repos.projects.create({ id, client_id: body.data.client_id, name: body.data.name, code: body.data.code, jira_project_key: body.data.jira_project_key ?? null, jira_url: body.data.jira_url ?? null, default_issue_type: body.data.default_issue_type ?? "Task", default_assignee_account_id: body.data.default_assignee_account_id ?? null, timezone: body.data.timezone ?? "Asia/Kuala_Lumpur", working_hours_start: body.data.working_hours_start ?? "09:00", working_hours_end: body.data.working_hours_end ?? "18:00", is_active: body.data.is_active === false ? 0 : 1, created_at: now, updated_at: now });
  if (body.data.member_ids) await ctx.repos.projects.setMembers(id, body.data.member_ids);
  await audit(ctx, { entity_type: "project", entity_id: id, action: "created", after: body.data });
  return ok(c, toProjectDTO((await ctx.repos.projects.findById(id))!), undefined, 201);
});

admin.patch("/projects/:id", async (c) => {
  const ctx = c.get("ctx");
  const id = c.req.param("id");
  const body = ProjectSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid project data.", body.error.issues);
  const before = await ctx.repos.projects.findById(id);
  if (!before) throw Errors.notFound("Project");
  const { member_ids, is_active, ...rest } = body.data;
  await ctx.repos.projects.update(id, { ...rest, is_active: is_active === undefined ? undefined : is_active ? 1 : 0, updated_at: nowIso(), updated_by: ctx.user!.id } as never);
  if (member_ids) await ctx.repos.projects.setMembers(id, member_ids);
  await audit(ctx, { entity_type: "project", entity_id: id, action: "updated", before: { name: before.name, jira_project_key: before.jira_project_key, is_active: before.is_active }, after: body.data });
  return ok(c, toProjectDTO((await ctx.repos.projects.findById(id))!));
});

admin.get("/projects/:id/members", async (c) => ok(c, await c.get("ctx").repos.projects.members(c.req.param("id"))));

admin.get("/audit", async (c) => {
  const ctx = c.get("ctx");
  const q = c.req.query();
  const page = parsePage(q, 50);
  const r = await ctx.repos.audit.list({ entity_type: q.entity_type, actor_id: q.actor_id, action: q.action, from: q.from, to: q.to }, { offset: page.offset, limit: page.page_size });
  return ok(c, { items: r.items.map(toAuditDTO), total: r.total, page: page.page, page_size: page.page_size });
});

admin.get("/settings", async (c) => {
  const ctx = c.get("ctx");
  const all = await ctx.repos.settings.all();
  return ok(c, { settings: all, retention: await getRetentionPolicy(ctx), ai: { provider: ctx.env.AI_PROVIDER, model: ctx.env.AI_MODEL, api_key_configured: !!ctx.env.ANTHROPIC_API_KEY, external: (ctx.env.AI_PROVIDER ?? "").toLowerCase() === "external" }, jira_mode: ctx.env.JIRA_MODE, job_mode: ctx.env.JOB_MODE, max_upload_bytes: Number(ctx.env.MAX_UPLOAD_BYTES) });
});

admin.put("/settings/:key", async (c) => {
  const ctx = c.get("ctx");
  const key = c.req.param("key");
  const allowed = ["retention", "demo.jira_failure_mode", "ai.notes", "approval.require_reason_on_edit"];
  if (!allowed.includes(key)) throw Errors.validation("Unknown setting.");
  const body = await c.req.json().catch(() => null);
  if (body === null) throw Errors.validation("Invalid value.");
  const value = (body as { value: unknown }).value;
  if (key === "retention") {
    const r = z.object({ raw_import_days: z.number().int().min(0).max(3650), report_days: z.number().int().min(0).max(3650), audit_days: z.number().int().min(0).max(36500) }).safeParse(value);
    if (!r.success) throw Errors.validation("Retention days must be whole numbers (0 = keep forever).");
  }
  if (key === "demo.jira_failure_mode" && !["none", "next_create", "always"].includes(String(value))) throw Errors.validation("Invalid failure mode.");
  const before = await ctx.repos.settings.get(key);
  await ctx.repos.settings.set(key, value, ctx.user!.id);
  await audit(ctx, { entity_type: "settings", entity_id: key, action: "updated", before, after: value });
  return ok(c, { key, value });
});

router.route("/admin", admin);
export default router;
