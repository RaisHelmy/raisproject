import type { Reservation, ReservationSource, ReservationStatus } from "../../shared/types";
import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

function rowToReservation(row: any): Reservation {
  return { ...row, table_ids: row.table_ids ? JSON.parse(row.table_ids) : [] };
}

export async function createReservation(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: {
    guestId: string | null;
    serviceId?: string;
    startsAt: number;
    partySize: number;
    source: ReservationSource;
    tableIds?: string[];
    notes?: string;
  },
): Promise<Reservation> {
  const id = newId();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO reservations
        (id, tenant_id, outlet_id, guest_id, service_id, starts_at, party_size, status, source, table_ids, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      outletId,
      input.guestId,
      input.serviceId ?? null,
      input.startsAt,
      input.partySize,
      input.source,
      input.tableIds ? JSON.stringify(input.tableIds) : null,
      input.notes ?? null,
      ts,
      ts,
    )
    .run();

  return {
    id,
    tenant_id: tenantId,
    outlet_id: outletId,
    guest_id: input.guestId,
    service_id: input.serviceId ?? null,
    starts_at: input.startsAt,
    party_size: input.partySize,
    status: "booked",
    source: input.source,
    table_ids: input.tableIds ?? [],
    notes: input.notes ?? null,
    created_at: ts,
    updated_at: ts,
  };
}

export async function listReservations(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  opts: { from?: number; to?: number; status?: ReservationStatus; page: number; pageSize: number },
): Promise<{ items: Reservation[]; total: number }> {
  const clauses = ["tenant_id = ?", "outlet_id = ?"];
  const params: unknown[] = [tenantId, outletId];
  if (opts.from !== undefined) {
    clauses.push("starts_at >= ?");
    params.push(opts.from);
  }
  if (opts.to !== undefined) {
    clauses.push("starts_at <= ?");
    params.push(opts.to);
  }
  if (opts.status) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  const where = clauses.join(" AND ");
  const offset = (opts.page - 1) * opts.pageSize;

  const { results } = await db
    .prepare(`SELECT * FROM reservations WHERE ${where} ORDER BY starts_at ASC LIMIT ? OFFSET ?`)
    .bind(...params, opts.pageSize, offset)
    .all();

  const countRow = await db
    .prepare(`SELECT COUNT(*) as c FROM reservations WHERE ${where}`)
    .bind(...params)
    .first<{ c: number }>();

  return { items: (results ?? []).map(rowToReservation), total: countRow?.c ?? 0 };
}

export async function getReservation(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  id: string,
): Promise<Reservation | null> {
  const row = await db
    .prepare(`SELECT * FROM reservations WHERE tenant_id = ? AND outlet_id = ? AND id = ?`)
    .bind(tenantId, outletId, id)
    .first();
  return row ? rowToReservation(row) : null;
}

export async function updateReservation(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  id: string,
  patch: Partial<{
    status: ReservationStatus;
    startsAt: number;
    partySize: number;
    tableIds: string[];
    notes: string;
  }>,
): Promise<Reservation | null> {
  const existing = await getReservation(db, tenantId, outletId, id);
  if (!existing) return null;

  const next = {
    status: patch.status ?? existing.status,
    starts_at: patch.startsAt ?? existing.starts_at,
    party_size: patch.partySize ?? existing.party_size,
    table_ids: patch.tableIds ? JSON.stringify(patch.tableIds) : JSON.stringify(existing.table_ids),
    notes: patch.notes ?? existing.notes,
  };

  await db
    .prepare(
      `UPDATE reservations SET status = ?, starts_at = ?, party_size = ?, table_ids = ?, notes = ?, updated_at = ?
       WHERE tenant_id = ? AND outlet_id = ? AND id = ?`,
    )
    .bind(next.status, next.starts_at, next.party_size, next.table_ids, next.notes, now(), tenantId, outletId, id)
    .run();

  return getReservation(db, tenantId, outletId, id);
}

export async function setReservationDeposit(
  db: AppDatabase,
  tenantId: string,
  reservationId: string,
  paymentId: string,
): Promise<void> {
  await db
    .prepare(`UPDATE reservations SET deposit_id = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
    .bind(paymentId, now(), tenantId, reservationId)
    .run();
}
