export interface Env {
  SAAS_SSO_SECRET?: string;
  ADMIN_PASSWORD?: string;
}

export const SESSION_COOKIE = "saas_admin";
const SESSION_TTL_S = 12 * 60 * 60;
const SSO_TTL_S = 90;
export const ADMIN_EMAIL = "raishelmy97@gmail.com";

export interface AdminApp {
  id: string;
  name: string;
  icon: string;
  host: string;
  sso?: string;
  note?: string;
}

export const APPS: AdminApp[] = [
  { id: "hrms", name: "HRMS", icon: "🧑‍💼", host: "hrms.raishelmy.uk", sso: "https://hrms.raishelmy.uk/api/auth/sso" },
  { id: "helpdesk", name: "Helpdesk", icon: "🎫", host: "helpdesk.raishelmy.uk", sso: "https://helpdesk.raishelmy.uk/api/auth/sso" },
  { id: "rms", name: "RMS", icon: "🍽️", host: "rms.raishelmy.uk", sso: "https://rms.raishelmy.uk/api/auth/sso" },
  { id: "pantas", name: "Pantas", icon: "⚡", host: "pantas.raishelmy.uk", sso: "https://pantas.raishelmy.uk/api/auth/sso" },
  { id: "fintech", name: "Rais Fintech", icon: "💰", host: "fintech.raishelmy.uk", sso: "https://fintech.raishelmy.uk/api/auth/sso" },
  { id: "timesheet", name: "Rais Timesheet", icon: "🕒", host: "timesheet.raishelmy.uk", sso: "https://rais-timesheet-api.raishelmy97.workers.dev/api/auth/sso" },
  { id: "create", name: "RaisAI Create", icon: "🎬", host: "create.raishelmy.uk", sso: "https://create.raishelmy.uk/api/v1/auth/sso" },
  { id: "runforge", name: "RunForge", icon: "🛠️", host: "app.runforge.raishelmy.uk", sso: "https://runforge.raishelmy.uk/api/auth/sso" },
  { id: "supermcp", name: "Super MCP", icon: "🤖", host: "mcp.raishelmy.uk", sso: "https://mcp.raishelmy.uk/api/auth/sso" },
  { id: "ai", name: "AI Gateway", icon: "🔑", host: "ai.raishelmy.uk", sso: "https://ai.raishelmy.uk/api/auth/sso" },
  { id: "xuanzhi", name: "XuanZhi AI", icon: "📚", host: "xuanzhi.raishelmy.uk", sso: "https://xuanzhi-api.raishelmy97.workers.dev/api/auth/sso" },
  { id: "eat", name: "RaisEat", icon: "🍚", host: "eat.raishelmy.uk", note: "No backend — no admin login" },
  { id: "travel", name: "RaisTravel", icon: "🧳", host: "travel.raishelmy.uk", note: "No backend — no admin login" },
];

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const u8 = typeof bytes === "string" ? enc.encode(bytes) : bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function sign(secret: string, payload: object): Promise<string> {
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verify<T = any>(secret: string, token: string): Promise<T | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), b64urlToBytes(token.slice(dot + 1)), enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as T;
  } catch {
    return null;
  }
}

export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const ua = new Uint8Array(ha), ub = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0 && a.length === b.length;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function issueSessionCookie(secret: string): Promise<string> {
  const token = await sign(secret, { kind: "saas-admin-session", iat: now(), exp: now() + SESSION_TTL_S });
  return `${SESSION_COOKIE}=${token}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_S}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function hasValidSession(request: Request, env: Env): Promise<boolean> {
  if (!env.SAAS_SSO_SECRET) return false;
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return false;
  const p = await verify<{ kind: string; exp: number }>(env.SAAS_SSO_SECRET, raw);
  return !!p && p.kind === "saas-admin-session" && typeof p.exp === "number" && p.exp >= now();
}

export async function mintSsoToken(secret: string, appId: string): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  return sign(secret, { iss: "saas-landing", app: appId, email: ADMIN_EMAIL, iat: now(), exp: now() + SSO_TTL_S, nonce });
}

export function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers },
  });
}
