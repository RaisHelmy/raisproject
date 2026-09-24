import { SignJWT, jwtVerify } from "jose";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv, AuthContext, Role } from "./types";

const COOKIE_NAME = "hrms_session";
/** Holds the original admin's session token while a simulation is active,
 * so "Return to admin" doesn't require logging in again. */
const BACKUP_COOKIE_NAME = "hrms_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** Simulated sessions expire much sooner than a normal login — impersonation
 * is meant for a quick support/troubleshooting look, not a standing session. */
const SIMULATION_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const PBKDF2_ITERATIONS = 100_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const [, iterStr, saltHex, hashHex] = parts;
  const iterations = Number(iterStr);
  const salt = fromHex(saltHex);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return timingSafeEqual(toHex(new Uint8Array(bits)), hashHex);
}

type SessionPayload = {
  sub: string;
  tenantId: string;
  role: Role;
  employeeId: string | null;
  email: string;
  name: string;
  simulatedByUserId?: string;
  simulatedByName?: string;
};

function isHttps(c: Context<AppEnv>): boolean {
  return c.req.url.startsWith("https://");
}

async function signSession(c: Context<AppEnv>, payload: SessionPayload, ttlSeconds: number): Promise<string> {
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function issueSession(
  c: Context<AppEnv>,
  payload: SessionPayload,
  opts?: { ttlSeconds?: number },
): Promise<void> {
  const ttlSeconds = opts?.ttlSeconds ?? SESSION_TTL_SECONDS;
  const token = await signSession(c, payload, ttlSeconds);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttps(c),
    path: "/",
    maxAge: ttlSeconds,
  });
}

export function clearSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

async function verifySessionToken(c: Context<AppEnv>, token: string): Promise<AuthContext | null> {
  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify<SessionPayload>(token, secret);
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      employeeId: payload.employeeId,
      email: payload.email,
      name: payload.name,
      simulatedByUserId: payload.simulatedByUserId ?? null,
      simulatedByName: payload.simulatedByName ?? null,
    };
  } catch {
    return null;
  }
}

export async function readAuthFromRequest(c: Context<AppEnv>): Promise<AuthContext | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;
  return verifySessionToken(c, token);
}

/** Starts a simulation: stashes the current (admin) session token in a
 * backup cookie, then issues a short-lived session for the target user
 * carrying simulatedBy so the UI can show who's really behind the wheel. */
export async function startSimulation(
  c: Context<AppEnv>,
  target: { userId: string; tenantId: string; role: Role; employeeId: string | null; email: string; name: string },
  simulatedBy: { userId: string; name: string },
): Promise<void> {
  const currentToken = getCookie(c, COOKIE_NAME);
  if (currentToken) {
    setCookie(c, BACKUP_COOKIE_NAME, currentToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isHttps(c),
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }
  await issueSession(
    c,
    {
      sub: target.userId,
      tenantId: target.tenantId,
      role: target.role,
      employeeId: target.employeeId,
      email: target.email,
      name: target.name,
      simulatedByUserId: simulatedBy.userId,
      simulatedByName: simulatedBy.name,
    },
    { ttlSeconds: SIMULATION_TTL_SECONDS },
  );
}

/** Ends a simulation by restoring the backed-up admin session. Returns
 * false if there was nothing to restore (not currently simulating). */
export async function stopSimulation(c: Context<AppEnv>): Promise<boolean> {
  const backupToken = getCookie(c, BACKUP_COOKIE_NAME);
  if (!backupToken) return false;
  const restored = await verifySessionToken(c, backupToken);
  if (!restored) {
    deleteCookie(c, BACKUP_COOKIE_NAME, { path: "/" });
    return false;
  }
  setCookie(c, COOKIE_NAME, backupToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttps(c),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  deleteCookie(c, BACKUP_COOKIE_NAME, { path: "/" });
  return true;
}
