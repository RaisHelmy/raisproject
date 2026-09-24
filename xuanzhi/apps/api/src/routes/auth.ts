import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { SESSION_COOKIE, rateLimit, requireAuth } from "../middleware";
import { ok } from "../lib/http";
import { Errors } from "../lib/errors";
import { changePassword, createSession, login, logout, register, requestPasswordReset, resetPassword, sendVerification, verifyEmail } from "../services/auth";
import { audit } from "../services/audit";
import { SSO_APP_ID, verifySsoToken } from "../lib/sso";
import { completeOAuth, enabledProviders, startOAuth, type OAuthProviderCode } from "../services/oauth";
import { toUserDTO } from "../services/mappers";
import { entitlements } from "../services/entitlements";
import { stripeConfigured } from "../services/billing";
import { emailSender } from "../services/email";
import type { Context } from "hono";

const router = new Hono<HonoEnv>();

function setSession(c: Context<HonoEnv>, token: string, expires_at: string) {
  const secure = new URL(c.req.url).protocol === "https:";
  // Web (*.pages.dev) and API (*.workers.dev) are cross-site: SameSite=None + Secure in production, Lax over plain http (local dev via Vite proxy).
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: secure ? "None" : "Lax", path: "/", expires: new Date(expires_at) });
}

const RegisterSchema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200), name: z.string().min(1).max(100), locale: z.enum(["en", "zh-CN", "zh-TW"]).optional() });
router.post("/register", rateLimit(10, 3600, "register"), async (c) => {
  const body = RegisterSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please provide your name, email and a password.", body.error.issues);
  const r = await register(c.get("ctx"), body.data, c.req.header("user-agent") ?? null);
  setSession(c, r.token, r.expires_at);
  return ok(c, { user: r.user, verification_sent: r.verification_sent }, undefined, 201);
});

router.post("/login", rateLimit(10, 60, "login"), async (c) => {
  const body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please enter your email and password.");
  const r = await login(c.get("ctx"), body.data.email, body.data.password, c.req.header("user-agent") ?? null);
  setSession(c, r.token, r.expires_at);
  return ok(c, { user: r.user });
});

/**
 * Super-admin SSO from the suite landing page: GET /api/auth/sso?token=<signed token>.
 * Verifies the HMAC token (SAAS_SSO_SECRET), looks up the existing super_admin by email, creates a normal
 * cookie session (same as password login) and redirects to the admin dashboard. Plain-text errors, no fallback.
 */
router.get("/sso", rateLimit(20, 60, "sso"), async (c) => {
  const ctx = c.get("ctx");
  const secret = ctx.env.SAAS_SSO_SECRET;
  if (!secret) return c.text("SSO is not configured.", 503);
  const token = c.req.query("token")?.trim();
  if (!token) return c.text("Missing token.", 400);
  const claims = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!claims) return c.text("Invalid or expired SSO token.", 401);
  const user = await ctx.repos.users.findByEmail(claims.email);
  if (!user || !user.is_active || user.role !== "super_admin") {
    await audit(ctx, { action: "user.login_failed", resource_type: "user", resource_id: user?.id ?? null, actor_id: null, result: "error", details: { method: "sso", email_domain: claims.email.split("@")[1] ?? "" } });
    return c.text("No active super-admin account for this token.", 403);
  }
  await audit(ctx, { action: "user.login", resource_type: "user", resource_id: user.id, actor_id: user.id, details: { method: "sso", issuer: "saas-landing" } });
  const r = await createSession(ctx, user, c.req.header("user-agent") ?? null);
  setSession(c, r.token, r.expires_at);
  return c.redirect(ctx.env.SSO_REDIRECT_TO || `${ctx.env.WEB_ORIGIN}/admin`, 302);
});

router.post("/logout", async (c) => {
  await logout(c.get("ctx"), getCookie(c, SESSION_COOKIE));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return ok(c, { logged_out: true });
});

/** Session + entitlements + feature flags in one call (the web app boots from this). */
router.get("/me", requireAuth, async (c) => {
  const ctx = c.get("ctx");
  const u = (await ctx.repos.users.findById(ctx.user!.id))!;
  const ent = await entitlements(ctx).entitlements(ctx.user!);
  const orgs = await ctx.repos.organizations.listForUser(u.id);
  return ok(c, { user: toUserDTO(u), entitlements: ent, organizations: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, role: o.role, plan_code: o.plan_code })), features: { oauth: enabledProviders(ctx), stripe: stripeConfigured(ctx), email: emailSender(ctx).configured, auth_method: ctx.user!.auth_method } });
});

router.get("/providers", (c) => ok(c, { oauth: enabledProviders(c.get("ctx")), email: emailSender(c.get("ctx")).configured }));

router.post("/verify", rateLimit(20, 3600, "verify"), async (c) => {
  const body = z.object({ token: z.string().min(10) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid token.");
  return ok(c, { user: await verifyEmail(c.get("ctx"), body.data.token) });
});
router.post("/resend-verification", requireAuth, rateLimit(3, 600, "resend"), async (c) => {
  const ctx = c.get("ctx"); const u = (await ctx.repos.users.findById(ctx.user!.id))!;
  if (u.email_verified_at) return ok(c, { sent: false, already_verified: true });
  if (!emailSender(ctx).configured) throw Errors.notConfigured("Email delivery is not configured.");
  await sendVerification(ctx, u);
  return ok(c, { sent: true });
});
router.post("/forgot-password", rateLimit(5, 900, "forgot"), async (c) => {
  const body = z.object({ email: z.string().email() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please enter your email.");
  const r = await requestPasswordReset(c.get("ctx"), body.data.email);
  return ok(c, { sent: r.email_configured, email_configured: r.email_configured });
});
router.post("/reset-password", rateLimit(10, 900, "reset"), async (c) => {
  const body = z.object({ token: z.string().min(10), password: z.string().min(1).max(200) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid request.");
  await resetPassword(c.get("ctx"), body.data.token, body.data.password);
  return ok(c, { reset: true });
});
router.post("/change-password", requireAuth, rateLimit(5, 300, "pw"), async (c) => {
  const body = z.object({ current_password: z.string().default(""), new_password: z.string() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Both passwords are required.");
  await changePassword(c.get("ctx"), c.get("ctx").user!, body.data.current_password, body.data.new_password);
  return ok(c, { changed: true });
});

// ── OAuth (Google / Microsoft / Apple) ──
const providerParam = z.enum(["google", "microsoft", "apple"]);
router.get("/oauth/:provider/start", rateLimit(20, 600, "oauth"), async (c) => {
  const p = providerParam.safeParse(c.req.param("provider"));
  if (!p.success) throw Errors.notFound("Provider");
  const redirectTo = c.req.query("redirect_to") ?? null;
  return c.redirect(await startOAuth(c.get("ctx"), p.data as OAuthProviderCode, redirectTo && redirectTo.startsWith("/") ? redirectTo : null));
});
async function oauthCallback(c: Context<HonoEnv>) {
  const ctx = c.get("ctx");
  const p = providerParam.safeParse(c.req.param("provider"));
  if (!p.success) throw Errors.notFound("Provider");
  let code: string | undefined, state: string | undefined, appleUser: { name?: { firstName?: string; lastName?: string } } | null = null;
  if (c.req.method === "POST") { const f = await c.req.parseBody(); code = String(f.code ?? ""); state = String(f.state ?? ""); try { appleUser = f.user ? JSON.parse(String(f.user)) : null; } catch { appleUser = null; } }
  else { code = c.req.query("code"); state = c.req.query("state"); }
  const fail = (msg: string) => c.redirect(`${ctx.env.WEB_ORIGIN}/login?error=${encodeURIComponent(msg)}`);
  if (!code || !state) return fail(c.req.query("error_description") ?? "Sign-in was cancelled.");
  try {
    const r = await completeOAuth(ctx, p.data as OAuthProviderCode, code, state, c.req.header("user-agent") ?? null, appleUser);
    setSession(c, r.token, r.expires_at);
    return c.redirect(`${ctx.env.WEB_ORIGIN}${r.redirect_to ?? "/app"}`);
  } catch (e) { return fail((e as Error).message); }
}
router.get("/oauth/:provider/callback", oauthCallback);
router.post("/oauth/:provider/callback", oauthCallback);

export default router;
