import type { MiddlewareHandler } from "hono";
import type { AppEnv, Role } from "./types";
import { readAuthFromRequest } from "./session";
import { hasPermission, type PermissionKey } from "./permissions";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = await readAuthFromRequest(c);
  if (!auth) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  c.set("auth", auth);
  await next();
};

/** Fixed role gate — reserved for hard-to-reverse, single-actor operations
 * (deletes, user management, the audit log) that stay admin-only no matter
 * what a tenant configures. For anything a tenant should be able to
 * customize per role, use requirePermission instead. */
export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!roles.includes(auth.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}

/** Tenant-configurable gate — admin/hr/manager/employee via
 * worker/core/permissions.ts, editable from Admin > Role Permissions.
 * admin always passes; everyone else is checked against that tenant's
 * role_permissions overrides, falling back to the key's default. */
export function requirePermission(key: PermissionKey): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!(await hasPermission(c.env.DB, auth, key))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}
