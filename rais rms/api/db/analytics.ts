import type { AppDatabase } from "../lib/db";
export interface CoversByDay {
  day: string;
  covers: number;
  reservations: number;
}

export async function coversByDay(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  fromMs: number,
  toMs: number,
): Promise<CoversByDay[]> {
  const { results } = await db
    .prepare(
      `SELECT to_char(to_timestamp(starts_at / 1000), 'YYYY-MM-DD') as day,
              SUM(party_size) as covers,
              COUNT(*) as reservations
       FROM reservations
       WHERE tenant_id = ? AND outlet_id = ? AND starts_at BETWEEN ? AND ?
         AND status != 'cancelled'
       GROUP BY day ORDER BY day ASC`,
    )
    .bind(tenantId, outletId, fromMs, toMs)
    .all<CoversByDay>();
  return results ?? [];
}

export async function noShowRate(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  fromMs: number,
  toMs: number,
): Promise<{ total: number; noShows: number; rate: number }> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as noShows
       FROM reservations
       WHERE tenant_id = ? AND outlet_id = ? AND starts_at BETWEEN ? AND ?`,
    )
    .bind(tenantId, outletId, fromMs, toMs)
    .first<{ total: number; noShows: number }>();
  const total = row?.total ?? 0;
  const noShows = row?.noShows ?? 0;
  return { total, noShows, rate: total > 0 ? noShows / total : 0 };
}

export async function newVsRepeatGuests(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  fromMs: number,
  toMs: number,
): Promise<{ newGuests: number; repeatGuests: number }> {
  const { results } = await db
    .prepare(
      `SELECT guest_id, COUNT(*) as visits
       FROM reservations
       WHERE tenant_id = ? AND outlet_id = ? AND starts_at BETWEEN ? AND ?
         AND guest_id IS NOT NULL AND status IN ('completed','seated')
       GROUP BY guest_id`,
    )
    .bind(tenantId, outletId, fromMs, toMs)
    .all<{ guest_id: string; visits: number }>();

  let newGuests = 0;
  let repeatGuests = 0;
  for (const r of results ?? []) {
    if (r.visits > 1) repeatGuests++;
    else newGuests++;
  }
  return { newGuests, repeatGuests };
}
