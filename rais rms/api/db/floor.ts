import type { Area, RTable, ServiceShift } from "../../shared/types";
import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export async function createArea(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  name: string,
): Promise<Area> {
  const id = newId();
  await db
    .prepare(`INSERT INTO areas (id, tenant_id, outlet_id, name) VALUES (?, ?, ?, ?)`)
    .bind(id, tenantId, outletId, name)
    .run();
  return { id, tenant_id: tenantId, outlet_id: outletId, name };
}

export async function listAreas(db: AppDatabase, tenantId: string, outletId: string): Promise<Area[]> {
  const { results } = await db
    .prepare(`SELECT * FROM areas WHERE tenant_id = ? AND outlet_id = ?`)
    .bind(tenantId, outletId)
    .all<Area>();
  return results ?? [];
}

export async function createTable(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: {
    areaId: string;
    label: string;
    seatsMin: number;
    seatsMax: number;
    x: number;
    y: number;
    combinable: boolean;
  },
): Promise<RTable> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO tables (id, tenant_id, outlet_id, area_id, label, seats_min, seats_max, x, y, combinable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      outletId,
      input.areaId,
      input.label,
      input.seatsMin,
      input.seatsMax,
      input.x,
      input.y,
      input.combinable ? 1 : 0,
    )
    .run();
  return {
    id,
    tenant_id: tenantId,
    outlet_id: outletId,
    area_id: input.areaId,
    label: input.label,
    seats_min: input.seatsMin,
    seats_max: input.seatsMax,
    x: input.x,
    y: input.y,
    combinable: input.combinable,
  };
}

export async function listTables(db: AppDatabase, tenantId: string, outletId: string): Promise<RTable[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tables WHERE tenant_id = ? AND outlet_id = ?`)
    .bind(tenantId, outletId)
    .all();
  return (results ?? []).map((r: any) => ({ ...r, combinable: !!r.combinable }));
}

export async function getTable(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  tableId: string,
): Promise<RTable | null> {
  const row = await db
    .prepare(`SELECT * FROM tables WHERE tenant_id = ? AND outlet_id = ? AND id = ?`)
    .bind(tenantId, outletId, tableId)
    .first<any>();
  return row ? { ...row, combinable: !!row.combinable } : null;
}

export async function updateTable(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  tableId: string,
  patch: Partial<{
    x: number;
    y: number;
    label: string;
    seatsMin: number;
    seatsMax: number;
    areaId: string;
    combinable: boolean;
  }>,
): Promise<RTable | null> {
  const existing = await getTable(db, tenantId, outletId, tableId);
  if (!existing) return null;

  const next = {
    x: patch.x ?? existing.x,
    y: patch.y ?? existing.y,
    label: patch.label ?? existing.label,
    seats_min: patch.seatsMin ?? existing.seats_min,
    seats_max: patch.seatsMax ?? existing.seats_max,
    area_id: patch.areaId ?? existing.area_id,
    combinable: patch.combinable !== undefined ? (patch.combinable ? 1 : 0) : existing.combinable ? 1 : 0,
  };

  await db
    .prepare(
      `UPDATE tables SET x = ?, y = ?, label = ?, seats_min = ?, seats_max = ?, area_id = ?, combinable = ?
       WHERE tenant_id = ? AND outlet_id = ? AND id = ?`,
    )
    .bind(
      next.x,
      next.y,
      next.label,
      next.seats_min,
      next.seats_max,
      next.area_id,
      next.combinable,
      tenantId,
      outletId,
      tableId,
    )
    .run();

  return getTable(db, tenantId, outletId, tableId);
}

export async function createService(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: {
    name: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    turnTimeByPartySize?: Record<string, number>;
  },
): Promise<ServiceShift> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO services (id, tenant_id, outlet_id, name, days_of_week, start_time, end_time, turn_time_by_party_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      outletId,
      input.name,
      JSON.stringify(input.daysOfWeek),
      input.startTime,
      input.endTime,
      input.turnTimeByPartySize ? JSON.stringify(input.turnTimeByPartySize) : null,
    )
    .run();
  return {
    id,
    tenant_id: tenantId,
    outlet_id: outletId,
    name: input.name,
    days_of_week: input.daysOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    turn_time_by_party_size: input.turnTimeByPartySize ?? null,
  };
}

export async function listServices(db: AppDatabase, tenantId: string, outletId: string): Promise<ServiceShift[]> {
  const { results } = await db
    .prepare(`SELECT * FROM services WHERE tenant_id = ? AND outlet_id = ?`)
    .bind(tenantId, outletId)
    .all();
  return (results ?? []).map((r: any) => ({
    ...r,
    days_of_week: JSON.parse(r.days_of_week),
    turn_time_by_party_size: r.turn_time_by_party_size ? JSON.parse(r.turn_time_by_party_size) : null,
  }));
}
