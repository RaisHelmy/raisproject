import type { Env, User } from "./types";

/* ---------- crypto helpers (WebCrypto; Workers-safe) ---------- */

const encoder = new TextEncoder();

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  // constant-time comparison
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

/* ---------- sessions ---------- */

export const SESSION_COOKIE = "rais_session";
const SESSION_DAYS = 30;

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomHex(32);
  const id = await sha256Hex(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, userId, expires)
    .run();
  return token;
}

export async function destroySession(env: Env, token: string): Promise<void> {
  const id = await sha256Hex(token);
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
}

export async function userFromSession(env: Env, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const id = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.email_verified, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at::timestamptz > now()`
  )
    .bind(id)
    .first<User>();
  return row ?? null;
}

/* ---------- suite SSO (saas.raishelmy.uk/admin → this app) ---------- */

/** This app's id in the suite-wide SSO token (`app` claim). */
export const SSO_APP_ID = "fintech";

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Verifies a landing-page SSO token: `b64url(payload) + "." + b64url(HMAC-SHA256(secret, b64url(payload)))`.
 * Returns the (lower-cased) email on success, or null on ANY failure —
 * bad shape, bad signature (checked via crypto.subtle.verify, constant-time),
 * wrong issuer/app, expired, or issued too far in the future.
 */
export async function verifySsoToken(
  token: string,
  secret: string,
  expectedApp: string
): Promise<{ email: string } | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), encoder.encode(body));
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
  if (p?.iss !== "saas-landing" || p?.app !== expectedApp) return null;
  if (typeof p.exp !== "number" || typeof p.iat !== "number") return null;
  if (now > p.exp || p.iat > now + 60) return null;
  if (typeof p.email !== "string" || !p.email) return null;
  return { email: p.email.toLowerCase() };
}

/* ---------- API tokens (programmatic access: REST + MCP) ---------- */

export interface TokenAuth {
  user: User;
  scopes: string[];
}

export function generateApiToken(): { token: string; prefix: string } {
  const token = `rfk_${randomHex(24)}`;
  return { token, prefix: token.slice(0, 12) };
}

/** Resolve `Authorization: Bearer rfk_…` to a user + scopes, or null. */
export async function userFromApiToken(env: Env, authHeader: string | undefined): Promise<TokenAuth | null> {
  if (!authHeader?.startsWith("Bearer rfk_")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT t.id AS token_id, t.scopes, u.id, u.email, u.name, u.role, u.email_verified, u.created_at
     FROM api_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.revoked = 0`
  )
    .bind(hash)
    .first<User & { token_id: string; scopes: string }>();
  if (!row) return null;
  // best-effort usage stamp; never blocks the request
  await env.DB.prepare("UPDATE api_tokens SET last_used_at = now() WHERE id = ?")
    .bind(row.token_id)
    .run()
    .catch(() => {});
  const { token_id, scopes, ...user } = row;
  return { user, scopes: scopes.split(",").map((s) => s.trim()).filter(Boolean) };
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 86400}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0", secure ? "Secure" : ""]
    .filter(Boolean)
    .join("; ");
}
