import { newId, now } from "../lib/ids";
import { getItem } from "./menu";
import type { AppDatabase } from "../lib/db";

export type OrderType = "dine_in" | "qr" | "takeaway" | "delivery";
export type OrderStatus = "open" | "placed" | "preparing" | "ready" | "completed" | "cancelled";

export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  menu_item_id: string;
  qty: number;
  modifiers: string[];
  price_minor: number;
}

export interface Order {
  id: string;
  tenant_id: string;
  outlet_id: string;
  type: OrderType;
  table_id: string | null;
  status: OrderStatus;
  total_minor: number;
  currency: string;
  created_at: number;
  updated_at: number;
  items?: OrderItem[];
}

export async function createOrder(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: {
    type: OrderType;
    tableId?: string;
    items: { menuItemId: string; qty: number; modifiers?: string[] }[];
    initialStatus: OrderStatus;
  },
): Promise<Order> {
  let totalMinor = 0;
  let currency = "USD";
  const resolvedItems: { menuItemId: string; qty: number; modifiers: string[]; priceMinor: number }[] = [];

  for (const line of input.items) {
    const menuItem = await getItem(db, tenantId, line.menuItemId);
    if (!menuItem || !menuItem.available) {
      throw new Error(`Menu item ${line.menuItemId} is not available`);
    }
    currency = menuItem.currency;
    totalMinor += menuItem.price_minor * line.qty;
    resolvedItems.push({
      menuItemId: line.menuItemId,
      qty: line.qty,
      modifiers: line.modifiers ?? [],
      priceMinor: menuItem.price_minor,
    });
  }

  const orderId = newId();
  const created_at = now();

  await db
    .prepare(
      `INSERT INTO orders (id, tenant_id, outlet_id, type, table_id, status, total_minor, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(orderId, tenantId, outletId, input.type, input.tableId ?? null, input.initialStatus, totalMinor, currency, created_at, created_at)
    .run();

  const itemStatements = resolvedItems.map((line) =>
    db
      .prepare(
        `INSERT INTO order_items (id, tenant_id, order_id, menu_item_id, qty, modifiers, price_minor) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(newId(), tenantId, orderId, line.menuItemId, line.qty, JSON.stringify(line.modifiers), line.priceMinor),
  );
  await db.batch(itemStatements);

  return {
    id: orderId,
    tenant_id: tenantId,
    outlet_id: outletId,
    type: input.type,
    table_id: input.tableId ?? null,
    status: input.initialStatus,
    total_minor: totalMinor,
    currency,
    created_at,
    updated_at: created_at,
  };
}

export async function listOrders(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<Order[]> {
  const clause = opts.activeOnly ? `AND status NOT IN ('completed','cancelled')` : "";
  const { results } = await db
    .prepare(`SELECT * FROM orders WHERE tenant_id = ? AND outlet_id = ? ${clause} ORDER BY created_at DESC`)
    .bind(tenantId, outletId)
    .all<Order>();
  return results ?? [];
}

export async function getOrder(db: AppDatabase, tenantId: string, outletId: string, orderId: string): Promise<Order | null> {
  const row = await db
    .prepare(`SELECT * FROM orders WHERE tenant_id = ? AND outlet_id = ? AND id = ?`)
    .bind(tenantId, outletId, orderId)
    .first<Order>();
  if (!row) return null;
  const { results: items } = await db
    .prepare(`SELECT * FROM order_items WHERE tenant_id = ? AND order_id = ?`)
    .bind(tenantId, orderId)
    .all();
  return { ...row, items: (items ?? []).map((i: any) => ({ ...i, modifiers: i.modifiers ? JSON.parse(i.modifiers) : [] })) };
}

export async function setOrderStatus(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  orderId: string,
  status: OrderStatus,
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE tenant_id = ? AND outlet_id = ? AND id = ?`)
    .bind(status, now(), tenantId, outletId, orderId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
