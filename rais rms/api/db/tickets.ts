import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export interface TicketEvent {
  id: string;
  tenant_id: string;
  outlet_id: string;
  name: string;
  starts_at: number;
  price_minor: number;
  currency: string;
  capacity: number;
  created_at: number;
}

export interface TicketOrder {
  id: string;
  tenant_id: string;
  event_id: string;
  guest_id: string | null;
  quantity: number;
  total_minor: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  created_at: number;
}

export async function createEvent(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: { name: string; startsAt: number; priceMinor: number; currency: string; capacity: number },
): Promise<TicketEvent> {
  const id = newId();
  const created_at = now();
  await db
    .prepare(
      `INSERT INTO tickets_events (id, tenant_id, outlet_id, name, starts_at, price_minor, currency, capacity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, tenantId, outletId, input.name, input.startsAt, input.priceMinor, input.currency, input.capacity, created_at)
    .run();
  return { id, tenant_id: tenantId, outlet_id: outletId, created_at, ...input, price_minor: input.priceMinor, starts_at: input.startsAt };
}

export async function listEvents(db: AppDatabase, tenantId: string, outletId: string): Promise<TicketEvent[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tickets_events WHERE tenant_id = ? AND outlet_id = ? ORDER BY starts_at ASC`)
    .bind(tenantId, outletId)
    .all<TicketEvent>();
  return results ?? [];
}

export async function getEvent(db: AppDatabase, tenantId: string, eventId: string): Promise<TicketEvent | null> {
  const row = await db.prepare(`SELECT * FROM tickets_events WHERE tenant_id = ? AND id = ?`).bind(tenantId, eventId).first<TicketEvent>();
  return row ?? null;
}

export async function ticketsSoldForEvent(db: AppDatabase, tenantId: string, eventId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(quantity), 0) as sold FROM ticket_orders
       WHERE tenant_id = ? AND event_id = ? AND status IN ('pending','paid')`,
    )
    .bind(tenantId, eventId)
    .first<{ sold: number }>();
  return row?.sold ?? 0;
}

export async function createTicketOrder(
  db: AppDatabase,
  tenantId: string,
  input: { eventId: string; guestId: string | null; quantity: number; totalMinor: number },
): Promise<TicketOrder> {
  const id = newId();
  const created_at = now();
  await db
    .prepare(
      `INSERT INTO ticket_orders (id, tenant_id, event_id, guest_id, quantity, total_minor, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(id, tenantId, input.eventId, input.guestId, input.quantity, input.totalMinor, created_at)
    .run();
  return {
    id,
    tenant_id: tenantId,
    event_id: input.eventId,
    guest_id: input.guestId,
    quantity: input.quantity,
    total_minor: input.totalMinor,
    status: "pending",
    created_at,
  };
}

export async function listTicketOrders(db: AppDatabase, tenantId: string, eventId: string): Promise<TicketOrder[]> {
  const { results } = await db
    .prepare(`SELECT * FROM ticket_orders WHERE tenant_id = ? AND event_id = ? ORDER BY created_at DESC`)
    .bind(tenantId, eventId)
    .all<TicketOrder>();
  return results ?? [];
}

export async function setTicketOrderStatus(
  db: AppDatabase,
  tenantId: string,
  orderId: string,
  status: TicketOrder["status"],
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE ticket_orders SET status = ? WHERE tenant_id = ? AND id = ?`)
    .bind(status, tenantId, orderId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
