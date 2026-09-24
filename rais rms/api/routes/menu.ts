import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireOutlet } from "../middleware/outletScope";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { createMenuItemSchema, createMenuSchema, createMenuSectionSchema } from "../../shared/schemas";
import {
  createItem,
  createMenu,
  createSection,
  getItem,
  getMenu,
  getSection,
  listItemsForMenu,
  listMenus,
  listSections,
  updateItem,
} from "../db/menu";
import { putTenantImage } from "../lib/r2";
import { badRequest, notFound } from "../lib/errors";

export const menuRoutes = new Hono<AppEnv>();
menuRoutes.use("/:outletId/*", requireOutlet);

menuRoutes.get("/:outletId/menus", async (c) => {
  const menus = await listMenus(c.env.DB, c.get("tenantId"), c.req.param("outletId"));
  return c.json({ ok: true, data: menus });
});

menuRoutes.post(
  "/:outletId/menus",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createMenuSchema),
  async (c) => {
    const input = getValidated<z.infer<typeof createMenuSchema>>(c, "json");
    const menu = await createMenu(c.env.DB, c.get("tenantId"), c.req.param("outletId"), input.name);
    return c.json({ ok: true, data: menu }, 201);
  },
);

menuRoutes.get("/:outletId/menus/:menuId/full", async (c) => {
  const tenantId = c.get("tenantId");
  const menu = await getMenu(c.env.DB, tenantId, c.req.param("menuId"));
  if (!menu || menu.outlet_id !== c.req.param("outletId")) throw notFound();
  const sections = await listSections(c.env.DB, tenantId, menu.id);
  const items = await listItemsForMenu(c.env.DB, tenantId, menu.id);
  return c.json({
    ok: true,
    data: { ...menu, sections: sections.map((s) => ({ ...s, items: items.filter((i) => i.section_id === s.id) })) },
  });
});

menuRoutes.post(
  "/:outletId/menus/:menuId/sections",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createMenuSectionSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const menu = await getMenu(c.env.DB, tenantId, c.req.param("menuId"));
    if (!menu || menu.outlet_id !== c.req.param("outletId")) throw notFound();
    const input = getValidated<z.infer<typeof createMenuSectionSchema>>(c, "json");
    const section = await createSection(c.env.DB, tenantId, menu.id, input);
    return c.json({ ok: true, data: section }, 201);
  },
);

menuRoutes.post(
  "/:outletId/sections/:sectionId/items",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", createMenuItemSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const section = await getSection(c.env.DB, tenantId, c.req.param("sectionId"));
    if (!section) throw notFound();
    const menu = await getMenu(c.env.DB, tenantId, section.menu_id);
    if (!menu || menu.outlet_id !== c.req.param("outletId")) throw notFound();

    const input = getValidated<z.infer<typeof createMenuItemSchema>>(c, "json");
    const item = await createItem(c.env.DB, tenantId, section.id, input);
    return c.json({ ok: true, data: item }, 201);
  },
);

const updateItemSchema = createMenuItemSchema.partial();

menuRoutes.patch(
  "/:outletId/items/:itemId",
  requireRole(ROLE_GROUPS.MANAGE_OUTLET),
  zValidator("json", updateItemSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const input = getValidated<z.infer<typeof updateItemSchema>>(c, "json");
    const updated = await updateItem(c.env.DB, tenantId, c.req.param("itemId"), input);
    if (!updated) throw notFound();
    return c.json({ ok: true, data: updated });
  },
);

/** Raw-binary image upload — send the file bytes directly with a Content-Type header. */
menuRoutes.put("/:outletId/items/:itemId/image", requireRole(ROLE_GROUPS.MANAGE_OUTLET), async (c) => {
  const tenantId = c.get("tenantId");
  const outletId = c.req.param("outletId");
  const item = await getItem(c.env.DB, tenantId, c.req.param("itemId"));
  if (!item) throw notFound();

  const contentType = c.req.header("Content-Type") ?? "";
  const contentLength = Number(c.req.header("Content-Length") ?? "0");
  if (!contentLength || contentLength <= 0) throw badRequest("Content-Length header is required");

  const body = await c.req.arrayBuffer();
  let key: string;
  try {
    key = await putTenantImage(c.env.BUCKET, tenantId, outletId, "menu", body, contentType, body.byteLength);
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : "Upload failed");
  }

  const updated = await updateItem(c.env.DB, tenantId, item.id, { imageR2Key: key });
  return c.json({ ok: true, data: updated });
});
