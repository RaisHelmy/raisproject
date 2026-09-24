import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export interface Menu {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
  created_at: number;
}

export interface MenuSection {
  id: string;
  tenant_id: string;
  menu_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  section_id: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  tags: string[];
  image_r2_key: string | null;
  available: boolean;
}

function rowToItem(row: any): MenuItem {
  return { ...row, tags: row.tags ? JSON.parse(row.tags) : [], available: !!row.available };
}

export async function createMenu(db: AppDatabase, tenantId: string, outletId: string, name: string): Promise<Menu> {
  const id = newId();
  const created_at = now();
  await db
    .prepare(`INSERT INTO menus (id, tenant_id, outlet_id, name, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, tenantId, outletId, name, created_at)
    .run();
  return { id, tenant_id: tenantId, outlet_id: outletId, name, created_at };
}

export async function listMenus(db: AppDatabase, tenantId: string, outletId: string): Promise<Menu[]> {
  const { results } = await db
    .prepare(`SELECT * FROM menus WHERE tenant_id = ? AND outlet_id = ? ORDER BY created_at ASC`)
    .bind(tenantId, outletId)
    .all<Menu>();
  return results ?? [];
}

export async function getMenu(db: AppDatabase, tenantId: string, menuId: string): Promise<Menu | null> {
  const row = await db.prepare(`SELECT * FROM menus WHERE tenant_id = ? AND id = ?`).bind(tenantId, menuId).first<Menu>();
  return row ?? null;
}

export async function createSection(
  db: AppDatabase,
  tenantId: string,
  menuId: string,
  input: { name: string; sortOrder: number },
): Promise<MenuSection> {
  const id = newId();
  await db
    .prepare(`INSERT INTO menu_sections (id, tenant_id, menu_id, name, sort_order) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, tenantId, menuId, input.name, input.sortOrder)
    .run();
  return { id, tenant_id: tenantId, menu_id: menuId, name: input.name, sort_order: input.sortOrder };
}

export async function listSections(db: AppDatabase, tenantId: string, menuId: string): Promise<MenuSection[]> {
  const { results } = await db
    .prepare(`SELECT * FROM menu_sections WHERE tenant_id = ? AND menu_id = ? ORDER BY sort_order ASC`)
    .bind(tenantId, menuId)
    .all<MenuSection>();
  return results ?? [];
}

export async function getSection(db: AppDatabase, tenantId: string, sectionId: string): Promise<MenuSection | null> {
  const row = await db
    .prepare(`SELECT * FROM menu_sections WHERE tenant_id = ? AND id = ?`)
    .bind(tenantId, sectionId)
    .first<MenuSection>();
  return row ?? null;
}

export async function createItem(
  db: AppDatabase,
  tenantId: string,
  sectionId: string,
  input: {
    name: string;
    description?: string;
    priceMinor: number;
    currency: string;
    tags?: string[];
    available: boolean;
  },
): Promise<MenuItem> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO menu_items (id, tenant_id, section_id, name, description, price_minor, currency, tags, image_r2_key, available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .bind(
      id,
      tenantId,
      sectionId,
      input.name,
      input.description ?? null,
      input.priceMinor,
      input.currency,
      input.tags ? JSON.stringify(input.tags) : null,
      input.available ? 1 : 0,
    )
    .run();
  return {
    id,
    tenant_id: tenantId,
    section_id: sectionId,
    name: input.name,
    description: input.description ?? null,
    price_minor: input.priceMinor,
    currency: input.currency,
    tags: input.tags ?? [],
    image_r2_key: null,
    available: input.available,
  };
}

export async function listItemsForMenu(db: AppDatabase, tenantId: string, menuId: string): Promise<MenuItem[]> {
  const { results } = await db
    .prepare(
      `SELECT mi.* FROM menu_items mi JOIN menu_sections ms ON ms.id = mi.section_id
       WHERE mi.tenant_id = ? AND ms.menu_id = ?`,
    )
    .bind(tenantId, menuId)
    .all();
  return (results ?? []).map(rowToItem);
}

export async function getItem(db: AppDatabase, tenantId: string, itemId: string): Promise<MenuItem | null> {
  const row = await db.prepare(`SELECT * FROM menu_items WHERE tenant_id = ? AND id = ?`).bind(tenantId, itemId).first();
  return row ? rowToItem(row) : null;
}

export async function updateItem(
  db: AppDatabase,
  tenantId: string,
  itemId: string,
  patch: Partial<{ name: string; description: string; priceMinor: number; tags: string[]; available: boolean; imageR2Key: string }>,
): Promise<MenuItem | null> {
  const existing = await getItem(db, tenantId, itemId);
  if (!existing) return null;

  const next = {
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    price_minor: patch.priceMinor ?? existing.price_minor,
    tags: patch.tags ? JSON.stringify(patch.tags) : JSON.stringify(existing.tags),
    available: patch.available !== undefined ? (patch.available ? 1 : 0) : existing.available ? 1 : 0,
    image_r2_key: patch.imageR2Key ?? existing.image_r2_key,
  };

  await db
    .prepare(
      `UPDATE menu_items SET name = ?, description = ?, price_minor = ?, tags = ?, available = ?, image_r2_key = ?
       WHERE tenant_id = ? AND id = ?`,
    )
    .bind(next.name, next.description, next.price_minor, next.tags, next.available, next.image_r2_key, tenantId, itemId)
    .run();

  return getItem(db, tenantId, itemId);
}
