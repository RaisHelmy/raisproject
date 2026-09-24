import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export interface InventoryItem {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  par_level: number;
}

export async function createInventoryItem(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: { name: string; unit: string; qtyOnHand: number; parLevel: number },
): Promise<InventoryItem> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO inventory_items (id, tenant_id, outlet_id, name, unit, qty_on_hand, par_level) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, tenantId, outletId, input.name, input.unit, input.qtyOnHand, input.parLevel)
    .run();
  return { id, tenant_id: tenantId, outlet_id: outletId, name: input.name, unit: input.unit, qty_on_hand: input.qtyOnHand, par_level: input.parLevel };
}

export async function listInventoryItems(db: AppDatabase, tenantId: string, outletId: string): Promise<InventoryItem[]> {
  const { results } = await db
    .prepare(`SELECT * FROM inventory_items WHERE tenant_id = ? AND outlet_id = ? ORDER BY name ASC`)
    .bind(tenantId, outletId)
    .all<InventoryItem>();
  return results ?? [];
}

export async function getInventoryItem(db: AppDatabase, tenantId: string, itemId: string): Promise<InventoryItem | null> {
  const row = await db.prepare(`SELECT * FROM inventory_items WHERE tenant_id = ? AND id = ?`).bind(tenantId, itemId).first<InventoryItem>();
  return row ?? null;
}

export async function adjustInventory(
  db: AppDatabase,
  tenantId: string,
  itemId: string,
  input: { delta: number; reason: string },
): Promise<InventoryItem | null> {
  const item = await getInventoryItem(db, tenantId, itemId);
  if (!item) return null;

  const nextQty = item.qty_on_hand + input.delta;
  await db.batch([
    db.prepare(`UPDATE inventory_items SET qty_on_hand = ? WHERE tenant_id = ? AND id = ?`).bind(nextQty, tenantId, itemId),
    db
      .prepare(`INSERT INTO inventory_movements (id, tenant_id, item_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(newId(), tenantId, itemId, input.delta, input.reason, now()),
  ]);

  return { ...item, qty_on_hand: nextQty };
}

export async function listLowStock(db: AppDatabase, tenantId: string, outletId: string): Promise<InventoryItem[]> {
  const { results } = await db
    .prepare(`SELECT * FROM inventory_items WHERE tenant_id = ? AND outlet_id = ? AND qty_on_hand <= par_level`)
    .bind(tenantId, outletId)
    .all<InventoryItem>();
  return results ?? [];
}
