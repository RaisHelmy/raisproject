import type { Role } from "../../db/repositories/users";

export const SESSION_COOKIE_NAME = "pantas_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  sessionId: string;
  userId: string;
  activeRole: Role;
  groupId: string | null;
  impersonatedByUserId: string | null;
  createdAt: string;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export async function createSession(
  env: Env,
  input: { userId: string; activeRole: Role; groupId: string | null },
): Promise<{ session: Session; setCookieHeader: string }> {
  const sessionId = crypto.randomUUID();
  const session: Session = {
    sessionId,
    userId: input.userId,
    activeRole: input.activeRole,
    groupId: input.groupId,
    impersonatedByUserId: null,
    createdAt: new Date().toISOString(),
  };
  await env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  const setCookieHeader = `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
  return { session, setCookieHeader };
}

/**
 * Web sends the session id as a cookie; native mobile apps (no durable
 * cookie jar across app restarts) send it as `Authorization: Bearer
 * <sessionId>` instead — see CLAUDE.md "Mobile auth". Same KV-backed
 * session either way, just a different transport for the id.
 */
function extractSessionId(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  const cookies = parseCookies(request.headers.get("Cookie"));
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

export async function getSession(env: Env, request: Request): Promise<Session | null> {
  const sessionId = extractSessionId(request);
  if (!sessionId) return null;
  const raw = await env.SESSIONS.get(`session:${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw) as Session;
}

export async function destroySession(env: Env, sessionId: string): Promise<void> {
  await env.SESSIONS.delete(`session:${sessionId}`);
}

export function expiredCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
