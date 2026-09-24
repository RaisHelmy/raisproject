import type { MiddlewareHandler } from "hono";
import type { Role } from "../../shared/types";
import type { AppEnv } from "../types";
import { forbidden } from "../lib/errors";
import { hasOutletAccess } from "../lib/rbac";

/**
 * Enforces that the caller holds one of `allowed` roles. If the route has an
 * :outletId param, access is checked for that specific outlet (owner/group_admin
 * always pass via hasOutletAccess). Otherwise (tenant-wide resources like
 * guests) the check passes if the user holds an allowed role on ANY outlet.
 */
export function requireRole(allowed: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const auth = c.get("auth");
    const outletId = c.req.param("outletId");

    if (outletId) {
      if (!hasOutletAccess(auth, outletId, allowed)) throw forbidden("Insufficient role for this outlet");
    } else {
      const anyAllowed = Object.values(auth.roles).some((r) => allowed.includes(r));
      if (!anyAllowed) throw forbidden("Insufficient role");
    }

    await next();
  };
}
