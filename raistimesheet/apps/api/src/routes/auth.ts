import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { SESSION_COOKIE, rateLimit, requireAuth } from "../middleware";
import { ok } from "../lib/http";
import { AppError, Errors } from "../lib/errors";
import { changePassword, createApiToken, login, logout, revokeApiToken, ssoLogin } from "../services/auth";
import { toUserDTO } from "../services/mappers";
import { nowIso } from "../lib/time";
import { audit } from "../services/audit";
import { verifySsoToken } from "../lib/sso";
import { aiIsDemo } from "../services/ai";

const router = new Hono<HonoEnv>();

const LoginSchema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

/**
 * Set the session cookie. The web app (timesheet.raishelmy.uk / *.pages.dev)
 * and this API (*.workers.dev) are different sites from the browser's
 * perspective, so the session cookie is cross-site from every fetch() the
 * frontend makes. `SameSite=Lax` blocks the cookie on cross-site fetch/XHR
 * entirely (it only allows top-level navigation), so login would set the
 * cookie but every subsequent request (e.g. /auth/me) would silently not
 * send it, bouncing the user straight back to the login page.
 * `SameSite=None` requires `Secure`, which is only valid over https — fall
 * back to `Lax` over plain http (local dev), where the cookie is same-origin
 * anyway. Used by password login AND SSO so both set exactly the same cookie.
 */
function setSessionCookie(c: Context<HonoEnv>, token: string, expiresAt: string) {
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: secure ? "None" : "Lax", path: "/", expires: new Date(expiresAt) });
}

router.post("/login", rateLimit(10, 60, "login"), async (c) => {
  const body = LoginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please enter your email and password.");
  const ctx = c.get("ctx");
  const r = await login(ctx, body.data.email, body.data.password, c.req.header("user-agent") ?? null);
  setSessionCookie(c, r.token, r.expires_at);
  return ok(c, { user: r.user });
});

/**
 * Suite-wide super-admin SSO: the landing page (saas.raishelmy.uk/admin)
 * mints a short-lived HMAC-signed token and sends the browser here. We
 * verify it with SAAS_SSO_SECRET, look up the existing account by email,
 * mint a normal cookie session (same code path as /login) and 302 to the
 * web app's admin area. Lives on the API host because that is where the
 * session cookie is scoped. Errors are short plain text, never stack traces.
 */
const SSO_APP_ID = "timesheet";
router.get("/sso", rateLimit(20, 60, "sso"), async (c) => {
  const ctx = c.get("ctx");
  const secret = ctx.env.SAAS_SSO_SECRET;
  if (!secret) return c.text("SSO is not configured.", 503);
  const token = c.req.query("token");
  if (!token) return c.text("Missing token.", 400);
  const verified = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!verified) return c.text("Invalid or expired SSO token.", 401);
  let r: Awaited<ReturnType<typeof ssoLogin>>;
  try {
    r = await ssoLogin(ctx, verified.email, c.req.header("user-agent") ?? null);
  } catch (e) {
    if (e instanceof AppError && e.status === 403) return c.text("No active account for this SSO identity.", 403);
    throw e;
  }
  setSessionCookie(c, r.token, r.expires_at);
  const web = ctx.env.WEB_ORIGIN || new URL(c.req.url).origin;
  return c.redirect(`${web}/settings/admin`, 302);
});

router.post("/logout", async (c) => {
  const ctx = c.get("ctx");
  await logout(ctx, getCookie(c, SESSION_COOKIE));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return ok(c, { logged_out: true });
});

router.get("/me", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const u = await ctx.repos.users.findById(ctx.user!.id);
  const roles = await ctx.repos.users.rolesFor(ctx.user!.id);
  return ok(c, { user: toUserDTO(u!, roles), auth_method: ctx.user!.auth_method, demo: { ai: aiIsDemo(ctx.env), jira: (ctx.env.JIRA_MODE ?? "cloud") === "demo" || !(await ctx.repos.jira.activeConnection()) } });
});

const ProfileSchema = z.object({ name: z.string().min(2).max(100).optional(), timezone: z.string().min(2).max(60).optional(), whatsapp_aliases: z.array(z.string().min(1).max(60)).max(10).optional(), jira_account_id: z.string().max(120).nullable().optional(), onboarding_completed: z.boolean().optional() });

router.patch("/profile", requireAuth, async (c) => {
  const body = ProfileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid profile data.", body.error.issues);
  const ctx = c.get("ctx");
  const before = await ctx.repos.users.findById(ctx.user!.id);
  await ctx.repos.users.update(ctx.user!.id, {
    name: body.data.name, timezone: body.data.timezone, whatsapp_aliases: body.data.whatsapp_aliases ? JSON.stringify(body.data.whatsapp_aliases) : undefined,
    jira_account_id: body.data.jira_account_id === undefined ? undefined : body.data.jira_account_id, onboarding_completed: body.data.onboarding_completed === undefined ? undefined : body.data.onboarding_completed ? 1 : 0,
    updated_at: nowIso(), updated_by: ctx.user!.id,
  });
  const after = await ctx.repos.users.findById(ctx.user!.id);
  await audit(ctx, { entity_type: "user", entity_id: ctx.user!.id, action: "profile_updated", before: { name: before?.name, timezone: before?.timezone, whatsapp_aliases: before?.whatsapp_aliases, jira_account_id: before?.jira_account_id }, after: { name: after?.name, timezone: after?.timezone, whatsapp_aliases: after?.whatsapp_aliases, jira_account_id: after?.jira_account_id } });
  return ok(c, { user: toUserDTO(after!, await ctx.repos.users.rolesFor(ctx.user!.id)) });
});

router.post("/change-password", requireAuth, rateLimit(5, 300, "pw"), async (c) => {
  const body = z.object({ current_password: z.string(), new_password: z.string() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Both passwords are required.");
  await changePassword(c.get("ctx"), body.data.current_password, body.data.new_password);
  return ok(c, { changed: true });
});

router.get("/api-tokens", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const tokens = await ctx.repos.sessions.listApiTokens(ctx.user!.id);
  return ok(c, tokens.map((t) => ({ id: t.id, name: t.name, created_at: t.created_at, last_used_at: t.last_used_at })));
});

router.post("/api-tokens", requireAuth, async (c) => {
  const body = z.object({ name: z.string().min(1).max(80) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Token name is required.");
  const r = await createApiToken(c.get("ctx"), body.data.name);
  return ok(c, r, ["Copy this token now. It will not be shown again."], 201);
});

router.delete("/api-tokens/:id", requireAuth, async (c) => {
  await revokeApiToken(c.get("ctx"), c.req.param("id"));
  return ok(c, { revoked: true });
});

/** MCP bootstrap: exchange the MCP_BOOTSTRAP_TOKEN + user email for a personal API token (server-to-server). */
router.post("/mcp/bootstrap", rateLimit(5, 300, "mcp-bootstrap"), async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ bootstrap_token: z.string(), email: z.string().email(), name: z.string().max(80).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success || !ctx.env.MCP_BOOTSTRAP_TOKEN) throw Errors.unauthorized("MCP bootstrap is not enabled.");
  const { timingSafeEqualString } = await import("../lib/crypto");
  if (!(await timingSafeEqualString(body.data.bootstrap_token, ctx.env.MCP_BOOTSTRAP_TOKEN))) throw Errors.unauthorized("Invalid bootstrap token.");
  const user = await ctx.repos.users.findByEmail(body.data.email);
  if (!user || !user.is_active) throw Errors.unauthorized("Unknown user.");
  ctx.user = { id: user.id, email: user.email, name: user.name, roles: [], timezone: user.timezone, whatsapp_aliases: [], jira_account_id: user.jira_account_id, onboarding_completed: true, auth_method: "api_token" };
  const r = await createApiToken(ctx, body.data.name ?? "MCP");
  return ok(c, r, undefined, 201);
});

export default router;
