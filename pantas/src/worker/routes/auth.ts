import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { createUser, getUserByPhone, getUserByEmail, listRolesForUser, addUserRole, setAnonymousMode, setAutoRejectAnonymousCod } from "../../db/repositories/users";
import { appendAuditLog } from "../../db/repositories/auditLog";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, expiredCookieHeader } from "../auth/session";
import { verifySsoToken, SSO_APP_ID } from "../auth/sso";
import { generateHandle } from "../auth/handle";
import { CONSENT_TEXTS, isKnownConsentVersion } from "../consentText";
import { getRequestContext } from "../requestContext";

const auth = new Hono<AppEnv>();
const SSO_ADMIN_PHONE = "+60100000099";

const registerSchema = z.object({
  realName: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  password: z.string().min(8),
  role: z.enum(["purchaser", "runner", "vendor"]),
  anonymousMode: z.boolean().optional(),
  consentVersion: z.string().optional(),
});

auth.post("/register", async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const db = await createDb(c.env);

  if (await getUserByPhone(db, body.phone)) {
    return c.json({ error: "phone already registered" }, 409);
  }

  if (body.anonymousMode) {
    if (!body.consentVersion || !isKnownConsentVersion(body.consentVersion)) {
      return c.json({ error: "consentVersion required to enable anonymous mode" }, 400);
    }
    await appendAuditLog(db, {
      actorUserId: null,
      actorRole: null,
      groupId: null,
      action: "consent.anonymity_ack",
      entityType: "user",
      entityId: null,
      afterJson: { consentVersion: body.consentVersion, text: CONSENT_TEXTS[body.consentVersion] },
      ip: getRequestContext()?.ip ?? null,
      userAgent: getRequestContext()?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "success",
    });
  }

  const passwordHash = await hashPassword(body.password);
  const user = await createUser(db, {
    realName: body.realName,
    phone: body.phone,
    email: body.email,
    passwordHash,
    handle: generateHandle(body.role),
    anonymousMode: body.anonymousMode ?? false,
  });
  await addUserRole(db, user.id, body.role);

  const { session, setCookieHeader } = await createSession(c.env, {
    userId: user.id,
    activeRole: body.role,
    groupId: null,
  });
  c.header("Set-Cookie", setCookieHeader);
  // sessionId is only meaningful to native clients (see CLAUDE.md "Mobile
  // auth") — the web client relies on the cookie and ignores this field.
  return c.json(
    { userId: user.id, handle: user.handle, role: body.role, sessionId: session.sessionId },
    201,
  );
});

const loginSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(1),
  role: z.enum(["purchaser", "runner", "vendor", "admin"]).optional(),
});

auth.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const ctx = getRequestContext();

  const user = await getUserByPhone(db, body.phone);
  const ok = user ? await verifyPassword(body.password, user.passwordHash) : false;

  if (!user || !ok) {
    // Failed logins are explicitly required logging (CLAUDE.md) — logged
    // directly since there's no successful repository write to hang it off.
    await appendAuditLog(db, {
      actorUserId: user?.id ?? null,
      actorRole: null,
      groupId: null,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user?.id ?? null,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "failure",
      resultReason: "invalid credentials",
    });
    return c.json({ error: "invalid credentials" }, 401);
  }

  const roles = await listRolesForUser(db, user.id);
  const requestedRole = body.role ?? roles[0]?.role;
  if (!requestedRole || !roles.some((r) => r.role === requestedRole)) {
    return c.json({ error: "user does not hold the requested role" }, 403);
  }

  const { session, setCookieHeader } = await createSession(c.env, {
    userId: user.id,
    activeRole: requestedRole,
    groupId: null,
  });
  c.header("Set-Cookie", setCookieHeader);
  return c.json({
    userId: user.id,
    handle: user.handle,
    role: requestedRole,
    sessionId: session.sessionId,
  });
});

/**
 * Super-admin SSO from the suite landing page (https://saas.raishelmy.uk/admin).
 * Verifies the short-lived HMAC token, looks up the existing super-admin by
 * email, and mints a normal KV session exactly like POST /login does — but
 * always with the `admin` role — then 302s into the admin dashboard.
 * See src/worker/auth/sso.ts for the token format.
 */
auth.get("/sso", async (c) => {
  const secret = c.env.SAAS_SSO_SECRET;
  if (!secret) return c.text("sso not configured", 503);

  const token = c.req.query("token");
  if (!token) return c.text("missing token", 400);

  const verified = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!verified) return c.text("invalid or expired token", 401);

  const db = await createDb(c.env);
  const ctx = getRequestContext();
  let user = await getUserByEmail(db, verified.email);

  // The suite owner's identity is attested by the signed token, so provision
  // the account on first use. The random password means only SSO can sign in.
  if (!user) {
    const created = await createUser(db, {
      realName: "Rais Helmy",
      phone: (await getUserByPhone(db, SSO_ADMIN_PHONE)) ? `sso-${crypto.randomUUID()}` : SSO_ADMIN_PHONE,
      email: verified.email,
      passwordHash: await hashPassword(crypto.randomUUID() + crypto.randomUUID()),
      handle: generateHandle("purchaser"),
    });
    await appendAuditLog(db, {
      actorUserId: created.id,
      actorRole: "admin",
      groupId: null,
      action: "auth.sso_provisioned",
      entityType: "user",
      entityId: created.id,
      afterJson: { email: verified.email },
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "success",
    });
    user = await getUserByEmail(db, verified.email);
    if (!user) return c.text("provisioning failed", 500);
  }

  if (user.status !== "active") {
    console.warn(`sso login refused for ${verified.email}: user not active`);
    await appendAuditLog(db, {
      actorUserId: user.id,
      actorRole: null,
      groupId: null,
      action: "auth.sso_login_failed",
      entityType: "user",
      entityId: user.id,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "failure",
      resultReason: "user not active",
    });
    return c.text("forbidden", 403);
  }

  const roles = await listRolesForUser(db, user.id);
  if (!roles.some((r) => r.role === "admin")) await addUserRole(db, user.id, "admin");

  const { setCookieHeader } = await createSession(c.env, {
    userId: user.id,
    activeRole: "admin",
    groupId: null,
  });
  await appendAuditLog(db, {
    actorUserId: user.id,
    actorRole: "admin",
    groupId: null,
    action: "auth.sso_login",
    entityType: "user",
    entityId: user.id,
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
    requestId: c.get("requestId"),
    result: "success",
  });
  c.header("Set-Cookie", setCookieHeader);
  c.header("Cache-Control", "no-store");
  return c.redirect("/admin", 302);
});

auth.post("/logout", async (c) => {
  const session = c.get("session");
  if (session) await destroySession(c.env, session.sessionId);
  c.header("Set-Cookie", expiredCookieHeader());
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "authentication required" }, 401);
  const db = await createDb(c.env);
  const roles = await listRolesForUser(db, session.userId);
  return c.json({ userId: session.userId, activeRole: session.activeRole, roles: roles.map((r) => r.role) });
});

const anonymitySchema = z.object({
  anonymousMode: z.boolean(),
  consentVersion: z.string().optional(),
});

auth.post("/anonymity", async (c) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "authentication required" }, 401);
  const body = anonymitySchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const ctx = getRequestContext();

  if (body.anonymousMode) {
    if (!body.consentVersion || !isKnownConsentVersion(body.consentVersion)) {
      return c.json({ error: "consentVersion required to enable anonymous mode" }, 400);
    }
    await appendAuditLog(db, {
      actorUserId: session.userId,
      actorRole: session.activeRole,
      groupId: session.groupId,
      action: "consent.anonymity_ack",
      entityType: "user",
      entityId: session.userId,
      afterJson: { consentVersion: body.consentVersion, text: CONSENT_TEXTS[body.consentVersion] },
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "success",
    });
  }

  await setAnonymousMode(db, session.userId, body.anonymousMode);
  return c.json({ ok: true, anonymousMode: body.anonymousMode });
});

const codPrefSchema = z.object({
  autoRejectAnonymousCod: z.boolean(),
  consentVersion: z.string().optional(),
});

/**
 * Runner/vendor toggle for seeing anonymous COD jobs (CLAUDE.md
 * "Cash-on-delivery risk flow") — ON (auto-reject) by default. Turning it
 * OFF requires the same opt-in acknowledgement pattern as everything else.
 */
auth.post("/cod-preference", async (c) => {
  const session = c.get("session")!;
  if (!session) return c.json({ error: "authentication required" }, 401);
  const body = codPrefSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const ctx = getRequestContext();

  if (body.autoRejectAnonymousCod === false) {
    if (!body.consentVersion || !isKnownConsentVersion(body.consentVersion)) {
      return c.json({ error: "consentVersion required to opt in to anonymous COD jobs" }, 400);
    }
    await appendAuditLog(db, {
      actorUserId: session.userId,
      actorRole: session.activeRole,
      groupId: session.groupId,
      action: "consent.anonymous_cod_opt_in_ack",
      entityType: "user",
      entityId: session.userId,
      afterJson: { consentVersion: body.consentVersion, text: CONSENT_TEXTS[body.consentVersion] },
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "success",
    });
  }

  await setAutoRejectAnonymousCod(db, session.userId, body.autoRejectAnonymousCod);
  return c.json({ ok: true, autoRejectAnonymousCod: body.autoRejectAnonymousCod });
});

export default auth;
