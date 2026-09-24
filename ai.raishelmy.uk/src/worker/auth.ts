import type { Context, Next } from "hono";
import type { Env } from "./env";
import { ADMIN_EMAIL, SSO_APP_ID } from "./env";
import { now, sign, verify } from "./util";

export const SESSION_COOKIE = "ai_admin";
const SESSION_TTL_S = 12 * 60 * 60;

function sessionSecret(env: Env): string | undefined {
  return env.SESSION_SECRET || env.SAAS_SSO_SECRET;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function issueSessionCookie(env: Env, via: string): Promise<string> {
  const secret = sessionSecret(env);
  if (!secret) throw new Error("no session secret");
  const token = await sign(secret, { kind: "ai-admin-session", via, email: ADMIN_EMAIL, iat: now(), exp: now() + SESSION_TTL_S });
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_S}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function currentSession(request: Request, env: Env): Promise<{ email: string; via: string; exp: number } | null> {
  const secret = sessionSecret(env);
  const raw = readCookie(request, SESSION_COOKIE);
  if (!secret || !raw) return null;
  const p = await verify<{ kind: string; via: string; email: string; exp: number }>(secret, raw);
  if (!p || p.kind !== "ai-admin-session" || typeof p.exp !== "number" || p.exp < now()) return null;
  return { email: p.email, via: p.via, exp: p.exp };
}

/** Verifies a token minted by saas.raishelmy.uk/admin (same format as every other suite app). */
export async function verifySsoToken(env: Env, token: string): Promise<{ email: string } | null> {
  if (!env.SAAS_SSO_SECRET) return null;
  const p = await verify<{ iss?: unknown; app?: unknown; email?: unknown; iat?: unknown; exp?: unknown; nonce?: unknown }>(env.SAAS_SSO_SECRET, token);
  if (!p) return null;
  if (p.iss !== "saas-landing" || p.app !== SSO_APP_ID) return null;
  if (typeof p.email !== "string" || p.email.toLowerCase() !== ADMIN_EMAIL) return null;
  const t = now();
  if (typeof p.exp !== "number" || p.exp < t) return null;
  if (typeof p.iat !== "number" || p.iat > t + 60) return null;
  return { email: p.email };
}

export async function requireAdmin(c: Context<{ Bindings: Env }>, next: Next) {
  const s = await currentSession(c.req.raw, c.env);
  if (!s) return c.json({ error: "unauthorized" }, 401);
  await next();
}
