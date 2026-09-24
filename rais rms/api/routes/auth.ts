import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { loginSchema, registerTenantSchema } from "../../shared/schemas";
import { createTenant, getTenantBySlug } from "../db/tenants";
import { createOutlet } from "../db/outlets";
import { assignRole, createUser, getUserByEmail } from "../db/users";
import { hashPassword, verifyPassword } from "../lib/password";
import { createSessionToken } from "../lib/jwt";
import { SESSION_COOKIE, requireAuth } from "../middleware/auth";
import { badRequest, unauthorized } from "../lib/errors";
import type { LoginInput, RegisterTenantInput } from "../../shared/schemas";
import { SSO_APP_ID, verifySsoToken } from "../lib/sso";

export const authRoutes = new Hono<AppEnv>();

/** Tenant that owns the seeded super-admin account used by the suite SSO. */
const SSO_TENANT_SLUG = "rais-admin";
/** Where a normal owner login lands (src/routes/Login.tsx navigates to "/"). */
const SSO_LANDING_PATH = "/";

const cookieOpts = (env: string) => ({
  httpOnly: true,
  secure: env === "production",
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 60 * 60 * 12,
});

authRoutes.post("/register", zValidator("json", registerTenantSchema), async (c) => {
  const input = getValidated<RegisterTenantInput>(c, "json");

  const existing = await getTenantBySlug(c.env.DB, input.tenantSlug);
  if (existing) throw badRequest("Tenant slug already taken");

  const tenant = await createTenant(c.env.DB, { name: input.tenantName, slug: input.tenantSlug });
  const outlet = await createOutlet(c.env.DB, tenant.id, {
    name: input.outletName,
    timezone: input.timezone,
    currency: input.currency,
  });
  const passwordHash = await hashPassword(input.password);
  const user = await createUser(c.env.DB, tenant.id, {
    email: input.ownerEmail,
    passwordHash,
    name: input.ownerName,
  });
  await assignRole(c.env.DB, tenant.id, { userId: user.id, outletId: outlet.id, role: "owner" });

  const token = await createSessionToken(c.env.JWT_SECRET, {
    sub: user.id,
    tenantId: tenant.id,
    email: user.email,
  });
  setCookie(c, SESSION_COOKIE, token, cookieOpts(c.env.APP_ENV));

  return c.json({ ok: true, data: { tenant, outlet, user } }, 201);
});

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const input = getValidated<LoginInput>(c, "json");

  const tenant = await getTenantBySlug(c.env.DB, input.tenantSlug);
  if (!tenant) throw unauthorized("Invalid credentials");

  const user = await getUserByEmail(c.env.DB, tenant.id, input.email);
  if (!user || user.status !== "active") throw unauthorized("Invalid credentials");

  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) throw unauthorized("Invalid credentials");

  const token = await createSessionToken(c.env.JWT_SECRET, {
    sub: user.id,
    tenantId: tenant.id,
    email: user.email,
  });
  setCookie(c, SESSION_COOKIE, token, cookieOpts(c.env.APP_ENV));

  return c.json({ ok: true, data: { user: { id: user.id, email: user.email, name: user.name } } });
});

/**
 * Suite-wide super-admin SSO: the landing page (saas.raishelmy.uk/admin) mints
 * a short-lived HMAC token and redirects the browser here. We verify it, look
 * up the existing super-admin owner in the `rais-admin` tenant, and issue the
 * exact same session cookie `POST /login` does, then 302 to the dashboard.
 * No password is involved; see api/lib/sso.ts for the token format.
 */
authRoutes.get("/sso", async (c) => {
  const secret = c.env.SAAS_SSO_SECRET;
  if (!secret) return c.text("SSO not configured", 503);

  const token = c.req.query("token");
  if (!token) return c.text("Missing token", 400);

  const verified = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!verified) return c.text("Invalid or expired SSO token", 401);

  const tenant = await getTenantBySlug(c.env.DB, SSO_TENANT_SLUG);
  if (!tenant) return c.text("SSO tenant not found", 403);

  const user = await getUserByEmail(c.env.DB, tenant.id, verified.email);
  if (!user || user.status !== "active") return c.text("SSO user not found", 403);

  const session = await createSessionToken(c.env.JWT_SECRET, {
    sub: user.id,
    tenantId: tenant.id,
    email: user.email,
  });
  setCookie(c, SESSION_COOKIE, session, cookieOpts(c.env.APP_ENV));

  return c.redirect(SSO_LANDING_PATH, 302);
});

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true, data: { loggedOut: true } });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const auth = c.get("auth");
  return c.json({ ok: true, data: auth });
});
