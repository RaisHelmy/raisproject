import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { createStaffShiftSchema } from "../../shared/schemas";
import { createStaffShift, deleteStaffShift, listStaffShifts } from "../db/staffShifts";
import { getUserById } from "../db/users";
import { badRequest, notFound } from "../lib/errors";

export const staffShiftRoutes = new Hono<AppEnv>();
staffShiftRoutes.use("/:outletId/*", requireOutlet);

const listQuerySchema = z.object({
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
});

staffShiftRoutes.get("/:outletId/shifts", zValidator("query", listQuerySchema), async (c) => {
  const q = getValidated<z.infer<typeof listQuerySchema>>(c, "query");
  const shifts = await listStaffShifts(c.env.DB, c.get("tenantId"), c.req.param("outletId"), q);
  return c.json({ ok: true, data: shifts });
});

staffShiftRoutes.post(
  "/:outletId/shifts",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createStaffShiftSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const input = getValidated<z.infer<typeof createStaffShiftSchema>>(c, "json");
    if (input.endsAt <= input.startsAt) throw badRequest("endsAt must be after startsAt");

    const user = await getUserById(c.env.DB, tenantId, input.userId);
    if (!user) throw notFound("Staff member not found");

    const shift = await createStaffShift(c.env.DB, tenantId, c.req.param("outletId"), input);
    return c.json({ ok: true, data: shift }, 201);
  },
);

staffShiftRoutes.delete("/:outletId/shifts/:shiftId", requireRole(ROLE_GROUPS.MANAGE_OUTLET), async (c) => {
  const removed = await deleteStaffShift(c.env.DB, c.get("tenantId"), c.req.param("outletId"), c.req.param("shiftId"));
  if (!removed) throw notFound();
  return c.json({ ok: true, data: { removed: true } });
});
