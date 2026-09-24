import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { adjustInventorySchema, createInventoryItemSchema } from "../../shared/schemas";
import { adjustInventory, createInventoryItem, listInventoryItems, listLowStock } from "../db/inventory";
import { notFound } from "../lib/errors";

export const inventoryRoutes = new Hono<AppEnv>();
inventoryRoutes.use("/:outletId/*", requireOutlet);

inventoryRoutes.get("/:outletId/inventory", async (c) => {
  const items = await listInventoryItems(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: items });
});

inventoryRoutes.get("/:outletId/inventory/low-stock", async (c) => {
  const items = await listLowStock(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: items });
});

inventoryRoutes.post(
  "/:outletId/inventory",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createInventoryItemSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof createInventoryItemSchema>>(c, "json");
    const item = await createInventoryItem(c.env.DB, c.get("tenantId"), c.req.param("outletId"), input);
    return c.json({ ok: true, data: item }, 201);
  },
);

inventoryRoutes.post(
  "/:outletId/inventory/:itemId/adjust",
  requireRole(ROLE_GROUPS.FOH_OPERATE),
  zValidator("json", adjustInventorySchema),
  async (c) => {
    const input = getValidated<z.infer<typeof adjustInventorySchema>>(c, "json");
    const item = await adjustInventory(c.env.DB, c.get("tenantId"), c.req.param("itemId"), input);
    if (!item) throw notFound();
    return c.json({ ok: true, data: item });
  },
);
