import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { verifySessionToken } from "../lib/jwt";
import { getRolesForUser } from "../db/users";
import { unauthorized } from "../lib/errors";

export const SESSION_COOKIE = "rais_session";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw unauthorized("Missing session");

  let payload;
  try {
    payload = await verifySessionToken(c.env.JWT_SECRET, token);
  } catch {
    throw unauthorized("Invalid or expired session");
  }

  const roles = await getRolesForUser(c.env.DB, payload.tenantId, payload.sub);

  c.set("auth", {
    userId: payload.sub,
    tenantId: payload.tenantId,
    email: payload.email,
    roles,
    isSuperadmin: payload.isSuperadmin ?? false,
  });

  await next();
};
