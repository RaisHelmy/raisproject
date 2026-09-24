import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import type { Role } from "../../db/repositories/users";

/** 401 if there is no session at all. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "authentication required" }, 401);
  }
  await next();
});

/**
 * 403 if the session's active role isn't one of `roles`. Permission
 * denials are one of the events CLAUDE.md explicitly requires logging;
 * that happens automatically because the denial short-circuits before any
 * repository call, and the failed auth attempt itself is visible in
 * standard request logs / observability, not the audit_log (audit_log is
 * for data mutations and consent events, not routing decisions).
 */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = c.get("session");
    if (!session) return c.json({ error: "authentication required" }, 401);
    if (!roles.includes(session.activeRole)) {
      return c.json({ error: "forbidden", requiredRoles: roles }, 403);
    }
    await next();
  });
}
