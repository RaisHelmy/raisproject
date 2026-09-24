import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { coversByDay, newVsRepeatGuests, noShowRate } from "../db/analytics";
import { requireOutlet } from "../middleware/outletScope";

export const analyticsRoutes = new Hono<AppEnv>();
analyticsRoutes.use("/:outletId/*", requireOutlet);

const rangeSchema = z.object({
  from: z.coerce.number().int(),
  to: z.coerce.number().int(),
});

analyticsRoutes.get("/:outletId/covers", zValidator("query", rangeSchema), async (c) => {
  const { from, to } = getValidated<z.infer<typeof rangeSchema>>(c, "query");
  const data = await coversByDay(c.env.DB, c.get("tenantId"), c.req.param("outletId"), from, to);
  return c.json({ ok: true, data });
});

analyticsRoutes.get("/:outletId/no-shows", zValidator("query", rangeSchema), async (c) => {
  const { from, to } = getValidated<z.infer<typeof rangeSchema>>(c, "query");
  const data = await noShowRate(c.env.DB, c.get("tenantId"), c.req.param("outletId"), from, to);
  return c.json({ ok: true, data });
});

analyticsRoutes.get("/:outletId/guests", zValidator("query", rangeSchema), async (c) => {
  const { from, to } = getValidated<z.infer<typeof rangeSchema>>(c, "query");
  const data = await newVsRepeatGuests(c.env.DB, c.get("tenantId"), c.req.param("outletId"), from, to);
  return c.json({ ok: true, data });
});
