import { sign, verify } from "hono/jwt";

export interface SessionPayload {
  sub: string; // userId
  tenantId: string;
  email: string;
  isSuperadmin?: boolean;
  iat: number;
  exp: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export async function createSessionToken(
  secret: string,
  payload: Omit<SessionPayload, "iat" | "exp">,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { ...payload, iat, exp: iat + SESSION_TTL_SECONDS };
  return sign(full as unknown as Record<string, unknown>, secret, "HS256");
}

export async function verifySessionToken(
  secret: string,
  token: string,
): Promise<SessionPayload> {
  const payload = await verify(token, secret, "HS256");
  return payload as unknown as SessionPayload;
}
