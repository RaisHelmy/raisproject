import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { queryOne } from "../../core/db";
import { issueSession } from "../../core/session";
import type { UserRow } from "./types";

/** Super-admin single-sign-on from the suite landing page
 * (https://saas.raishelmy.uk/admin). The landing page mints a short-lived
 * HMAC-SHA256 token signed with the shared `SAAS_SSO_SECRET`; we verify it,
 * look up the owner's existing super-admin account and start a completely
 * ordinary session via `issueSession` (same cookie/JWT as `POST /login`).
 * No password ever travels through this path. */

const SSO_ISSUER = "saas-landing";
const SSO_APP_ID = "hrms";
const SSO_EMAIL_TENANT_SLUG = "rais-admin";
const POST_LOGIN_PATH = "/";

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function verifySsoToken(
  token: string,
  secret: string,
  expectedApp: string,
): Promise<{ email: string } | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let ok = false;
  try {
    // crypto.subtle.verify is constant-time.
    ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sig),
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  let p: any;
  try {
    p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (p?.iss !== SSO_ISSUER || p?.app !== expectedApp) return null;
  if (typeof p.exp !== "number" || typeof p.iat !== "number") return null;
  if (now > p.exp || p.iat > now + 60) return null;
  if (typeof p.email !== "string" || !p.email) return null;
  return { email: p.email.toLowerCase() };
}

const app = new Hono<AppEnv>();

app.get("/sso", async (c) => {
  const secret = c.env.SAAS_SSO_SECRET;
  if (!secret) {
    return c.text("SSO is not configured", 503);
  }
  const token = c.req.query("token");
  if (!token) {
    return c.text("Missing token", 400);
  }
  const verified = await verifySsoToken(token, secret, SSO_APP_ID);
  if (!verified) {
    return c.text("Invalid or expired SSO token", 401);
  }

  const db = c.env.DB;
  // Emails are unique across users, but prefer the owner's own admin tenant
  // deterministically should that ever change.
  const user = await queryOne<UserRow>(
    db,
    `SELECT u.* FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ?
      ORDER BY (t.slug = ?) DESC
      LIMIT 1`,
    [verified.email, SSO_EMAIL_TENANT_SLUG],
  );
  if (!user || !user.is_active || user.role !== "admin") {
    return c.text("No active super-admin account for this email", 403);
  }

  const employee = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM employees WHERE user_id = ?`,
    [user.id],
  );

  await issueSession(c, {
    sub: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    employeeId: employee?.id ?? null,
    email: user.email,
    name: user.name,
  });

  return c.redirect(POST_LOGIN_PATH, 302);
});

export default app;
