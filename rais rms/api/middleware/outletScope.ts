import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { getOutlet } from "../db/outlets";
import { notFound } from "../lib/errors";

export const requireOutlet: MiddlewareHandler<AppEnv> = async (c, next) => {
  const tenantId = c.get("tenantId");
  const outletId = c.req.param("outletId") ?? "";
  const outlet = await getOutlet(c.env.DB, tenantId, outletId);
  if (!outlet) throw notFound("Outlet not found");
  await next();
};
