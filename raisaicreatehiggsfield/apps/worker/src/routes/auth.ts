import { Hono } from "hono";
import { z } from "zod";
import { AppError, newId } from "@raisai/shared";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { AuthService } from "../services/auth-service";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  expireCookie,
  serializeCookie,
  signValue,
} from "../auth/cookies";
import { SSO_APP_ID, verifySsoToken } from "../auth/sso";

/** Where a successful super-admin SSO lands (apps/web/src/app/nav.ts admin entry). */
const SSO_ADMIN_PATH = "/admin/models";

export const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const signupSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
});
const loginSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });

function isSecureRequest(c: { req: { url: string } }): boolean {
  return new URL(c.req.url).protocol === "https:";
}

async function setSessionCookies(c: { header: (n: string, v: string, o?: { append?: boolean }) => void; env: Env; req: { url: string } }, sessionId: string) {
  const secret = c.env.SESSION_SECRET ?? "dev-insecure-secret";
  const secure = isSecureRequest(c);
  const signedSession = await signValue(secret, sessionId);
  const csrfToken = newId();
  c.header("set-cookie", serializeCookie(SESSION_COOKIE, signedSession, { maxAgeSeconds: 60 * 60 * 24 * 30, secure }), { append: true });
  // CSRF cookie is intentionally readable by JS (double-submit pattern): not HttpOnly.
  c.header(
    "set-cookie",
    `${CSRF_COOKIE}=${csrfToken}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}; Max-Age=${60 * 60 * 24 * 30}`,
    { append: true },
  );
}

auth.post("/signup", async (c) => {
  const body = signupSchema.parse(await c.req.json());
  const service = new AuthService(c.env);
  const { user, org, session } = await service.signup({
    ...body,
    requestId: c.get("requestId"),
    ip: c.req.header("cf-connecting-ip") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined,
  });
  await setSessionCookies(c, session.id);
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, orgId: org.id }, 201);
});

auth.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const service = new AuthService(c.env);
  const { user, org, session } = await service.login({
    ...body,
    requestId: c.get("requestId"),
    ip: c.req.header("cf-connecting-ip") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined,
  });
  await setSessionCookies(c, session.id);
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, orgId: org.id });
});

/**
 * Super-admin SSO from the suite landing page (saas.raishelmy.uk/admin).
 * Verifies the short-lived HMAC token, then creates a session exactly the
 * way /login does and redirects into the admin area.
 */
auth.get("/sso", async (c) => {
  const secret = c.env.SAAS_SSO_SECRET;
  if (!secret) return c.text("SSO is not configured.", 503);
  const token = c.req.query("token");
  if (!token) return c.text("Missing token.", 400);
  const verified = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!verified) return c.text("Invalid or expired SSO token.", 401);
  const service = new AuthService(c.env);
  let result: Awaited<ReturnType<AuthService["ssoLogin"]>>;
  try {
    result = await service.ssoLogin({
      email: verified.email,
      requestId: c.get("requestId"),
      ip: c.req.header("cf-connecting-ip") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "forbidden") return c.text(error.message, 403);
    throw error;
  }
  await setSessionCookies(c, result.session.id);
  c.header("cache-control", "no-store");
  return c.redirect(SSO_ADMIN_PATH, 302);
});

auth.post("/logout", async (c) => {
  const existing = c.get("auth");
  if (existing?.credentialId) {
    const service = new AuthService(c.env);
    await service.logout(existing.credentialId);
  }
  c.header("set-cookie", expireCookie(SESSION_COOKIE), { append: true });
  c.header("set-cookie", expireCookie(CSRF_COOKIE), { append: true });
  return c.body(null, 204);
});

auth.get("/me", async (c) => {
  const ctx = c.get("auth");
  if (!ctx) throw new AppError("unauthorized", "Not signed in.");
  return c.json({ userId: ctx.userId, orgId: ctx.orgId, isAdmin: ctx.isAdmin });
});
