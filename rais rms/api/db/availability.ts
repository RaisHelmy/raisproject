import { listServices, listTables } from "./floor";
import { turnTimeForPartySize } from "../lib/turnTime";
import type { AppDatabase } from "../lib/db";

export interface AvailabilitySlot {
  startsAt: number;
  serviceId: string;
  serviceName: string;
  remainingCapacity: number;
}

const SLOT_STEP_MINUTES = 30;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Real-time table availability for a given calendar date (outlet-local, treated as UTC
 * for simplicity — swap in outlet.timezone-aware math before relying on this across
 * timezones in production). Capacity is total table seats minus every reservation whose
 * turn-time window overlaps the candidate slot.
 */
export async function computeAvailability(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  dateISO: string,
  partySize: number,
): Promise<AvailabilitySlot[]> {
  const [services, tables] = await Promise.all([
    listServices(db, tenantId, outletId),
    listTables(db, tenantId, outletId),
  ]);
  const totalCapacity = tables.reduce((sum, t) => sum + t.seats_max, 0);
  if (totalCapacity === 0) return [];

  const dayStart = new Date(`${dateISO}T00:00:00.000Z`).getTime();
  const weekday = new Date(dayStart).getUTCDay();
  const applicable = services.filter((s) => s.days_of_week.includes(weekday));
  if (applicable.length === 0) return [];

  const dayEnd = dayStart + 24 * 3600 * 1000;
  // Widen the window by 6h on each side so reservations that started the prior evening
  // (long turn times) or roll past midnight are still counted against capacity.
  const { results: dayReservations } = await db
    .prepare(
      `SELECT starts_at, party_size FROM reservations
       WHERE tenant_id = ? AND outlet_id = ? AND status IN ('booked','seated')
         AND starts_at BETWEEN ? AND ?`,
    )
    .bind(tenantId, outletId, dayStart - 6 * 3600 * 1000, dayEnd + 6 * 3600 * 1000)
    .all<{ starts_at: number; party_size: number }>();

  const reservations = dayReservations ?? [];
  const slots: AvailabilitySlot[] = [];

  for (const service of applicable) {
    const turnMinutes = turnTimeForPartySize(service.turn_time_by_party_size, partySize);
    const [sh, sm] = service.start_time.split(":").map(Number);
    const [eh, em] = service.end_time.split(":").map(Number);
    const serviceStart = dayStart + ((sh ?? 0) * 60 + (sm ?? 0)) * 60_000;
    const serviceEnd = dayStart + ((eh ?? 0) * 60 + (em ?? 0)) * 60_000;

    for (let cursor = serviceStart; cursor <= serviceEnd; cursor += SLOT_STEP_MINUTES * 60_000) {
      const slotEnd = cursor + turnMinutes * 60_000;
      const used = reservations
        .filter((r) => {
          const rTurn = turnTimeForPartySize(service.turn_time_by_party_size, r.party_size);
          return overlaps(r.starts_at, r.starts_at + rTurn * 60_000, cursor, slotEnd);
        })
        .reduce((sum, r) => sum + r.party_size, 0);

      const remaining = totalCapacity - used;
      if (remaining >= partySize) {
        slots.push({ startsAt: cursor, serviceId: service.id, serviceName: service.name, remainingCapacity: remaining });
      }
    }
  }

  return slots.sort((a, b) => a.startsAt - b.startsAt);
}

/** Single-slot capacity check, used when creating/rescheduling a reservation directly. */
export async function hasCapacityForSlot(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  startsAt: number,
  partySize: number,
  excludeReservationId?: string,
): Promise<boolean> {
  const tables = await listTables(db, tenantId, outletId);
  const totalCapacity = tables.reduce((sum, t) => sum + t.seats_max, 0);
  if (totalCapacity === 0) return true; // no floor plan configured yet — don't block bookings

  const turnMinutes = turnTimeForPartySize(null, partySize);
  const slotEnd = startsAt + turnMinutes * 60_000;
  const windowStart = startsAt - 6 * 3600 * 1000;
  const windowEnd = startsAt + 6 * 3600 * 1000;

  const { results } = await db
    .prepare(
      `SELECT id, starts_at, party_size FROM reservations
       WHERE tenant_id = ? AND outlet_id = ? AND status IN ('booked','seated')
         AND starts_at BETWEEN ? AND ?`,
    )
    .bind(tenantId, outletId, windowStart, windowEnd)
    .all<{ id: string; starts_at: number; party_size: number }>();

  const used = (results ?? [])
    .filter((r) => r.id !== excludeReservationId)
    .filter((r) => overlaps(r.starts_at, r.starts_at + turnTimeForPartySize(null, r.party_size) * 60_000, startsAt, slotEnd))
    .reduce((sum, r) => sum + r.party_size, 0);

  return totalCapacity - used >= partySize;
}
