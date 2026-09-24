import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { listFeedback } from "../db/feedback";

export const feedbackRoutes = new Hono<AppEnv>();
feedbackRoutes.use("/:outletId/*", requireOutlet, requireRole(ROLE_GROUPS.MANAGE_OUTLET));

feedbackRoutes.get("/:outletId/feedback", async (c) => {
  const items = await listFeedback(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: items });
});
