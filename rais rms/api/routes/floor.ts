import { Hono } from "hono";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { createAreaSchema, createServiceSchema, createTableSchema, updateTableSchema } from "../../shared/schemas";
import {
  createArea,
  createService,
  createTable,
  listAreas,
  listServices,
  listTables,
  updateTable,
} from "../db/floor";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { notFound } from "../lib/errors";
import type { z } from "zod";

export const floorRoutes = new Hono<AppEnv>();
floorRoutes.use("/:outletId/*", requireOutlet);

floorRoutes.get("/:outletId/areas", async (c) => {
  const areas = await listAreas(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: areas });
});

floorRoutes.post(
  "/:outletId/areas",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createAreaSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof createAreaSchema>>(c, "json");
    const area = await createArea(c.env.DB, c.get("tenantId"), c.req.param("outletId"), input.name);
    return c.json({ ok: true, data: area }, 201);
  },
);

floorRoutes.get("/:outletId/tables", async (c) => {
  const tables = await listTables(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: tables });
});

floorRoutes.post(
  "/:outletId/tables",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createTableSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof createTableSchema>>(c, "json");
    const table = await createTable(c.env.DB, c.get("tenantId"), c.req.param("outletId"), input);
    return c.json({ ok: true, data: table }, 201);
  },
);

// Position updates (drag-and-drop) are allowed for FOH staff too — repositioning a
// table on the floor plan during service is a day-to-day operation, not a floor
// plan *design* change, which stays MANAGE_OUTLET-gated via the fuller edit fields.
floorRoutes.patch(
  "/:outletId/tables/:tableId",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", updateTableSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof updateTableSchema>>(c, "json");
    const table = await updateTable(c.env.DB, c.get("tenantId"), c.req.param("outletId"), c.req.param("tableId"), input);
    if (!table) throw notFound();
    return c.json({ ok: true, data: table });
  },
);

floorRoutes.get("/:outletId/services", async (c) => {
  const services = await listServices(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: services });
});

floorRoutes.post(
  "/:outletId/services",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createServiceSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof createServiceSchema>>(c, "json");
    const service = await createService(c.env.DB, c.get("tenantId"), c.req.param("outletId"), input);
    return c.json({ ok: true, data: service }, 201);
  },
);
