import type { DataStore, Session } from "../domain/repository/store";
import { newId } from "../domain/ids";

const enc = new TextEncoder();
export async function sha256(input: string): Promise<string> { const buf = await crypto.subtle.digest("SHA-256", enc.encode(input)); return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }

export async function hashPassword(password: string, salt: string = crypto.randomUUID()): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100_000 }, key, 256);
  return { hash: [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join(""), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const h = await hashPassword(password, salt);
  return timingSafeEqual(h.hash, hash);
}

function timingSafeEqual(a: string, b: string): boolean { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export async function createSession(store: DataStore, userId: string, kind: Session["kind"], organizationId?: string, ttlHours = kind === "MCP" ? 24 * 90 : 24 * 7): Promise<{ token: string; session: Session }> {
  const token = `smcp_${kind.toLowerCase()}_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const session: Session = { id: newId("ses"), userId, token: await sha256(token), organizationId, kind, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlHours * 3600_000).toISOString() };
  await store.sessions.put(session);
  return { token, session };
}

export async function findSession(store: DataStore, token: string | undefined): Promise<Session | undefined> {
  if (!token) return undefined;
  const hash = await sha256(token);
  const s = (await store.sessions.list({ token: hash } as Partial<Session>))[0];
  if (!s || s.expiresAt < new Date().toISOString()) return undefined;
  return s;
}

// ---- suite super-admin SSO (token minted by https://saas.raishelmy.uk/admin) ----
// token = b64url(payloadJson) + "." + b64url(HMAC_SHA256(SAAS_SSO_SECRET, b64url(payloadJson)))
// The HMAC key is the raw UTF-8 bytes of the secret string. Verification uses
// crypto.subtle.verify (constant-time); every claim check below is required.
function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifySsoToken(token: string, secret: string, expectedApp: string): Promise<{ email: string } | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  let p: { iss?: unknown; app?: unknown; email?: unknown; iat?: unknown; exp?: unknown };
  try { p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))); } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (p?.iss !== "saas-landing" || p?.app !== expectedApp) return null;
  if (typeof p.exp !== "number" || typeof p.iat !== "number") return null;
  if (now > p.exp || p.iat > now + 60) return null;
  if (typeof p.email !== "string" || !p.email) return null;
  return { email: p.email.toLowerCase() };
}
