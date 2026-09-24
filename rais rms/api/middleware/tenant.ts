import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { unauthorized } from "../lib/errors";

/**
 * Resolves the tenant that scopes this request. The ONLY sources of truth are
 * the authenticated session's tenantId, or (for platform superadmins only) an
 * explicit X-Tenant-Id header. A tenant_id in the request body/query is never
 * honored — see CLAUDE.md §6.
 */
export const resolveTenant: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.get("auth");
  if (!auth) throw unauthorized();

  let tenantId = auth.tenantId;
  if (auth.isSuperadmin) {
    const override = c.req.header("X-Tenant-Id");
    if (override) tenantId = override;
  }

  c.set("tenantId", tenantId);
  await next();
};
