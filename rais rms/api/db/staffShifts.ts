import { newId } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export interface StaffShift {
  id: string;
  tenant_id: string;
  outlet_id: string;
  user_id: string;
  starts_at: number;
  ends_at: number;
  role: string;
}

export async function createStaffShift(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: { userId: string; startsAt: number; endsAt: number; role: string },
): Promise<StaffShift> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO staff_shifts (id, tenant_id, outlet_id, user_id, starts_at, ends_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, tenantId, outletId, input.userId, input.startsAt, input.endsAt, input.role)
    .run();
  return { id, tenant_id: tenantId, outlet_id: outletId, user_id: input.userId, starts_at: input.startsAt, ends_at: input.endsAt, role: input.role };
}

export async function listStaffShifts(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  opts: { from?: number; to?: number } = {},
): Promise<StaffShift[]> {
  const clauses = ["tenant_id = ?", "outlet_id = ?"];
  const params: unknown[] = [tenantId, outletId];
  if (opts.from !== undefined) {
    clauses.push("ends_at >= ?");
    params.push(opts.from);
  }
  if (opts.to !== undefined) {
    clauses.push("starts_at <= ?");
    params.push(opts.to);
  }
  const { results } = await db
    .prepare(`SELECT * FROM staff_shifts WHERE ${clauses.join(" AND ")} ORDER BY starts_at ASC`)
    .bind(...params)
    .all<StaffShift>();
  return results ?? [];
}

export async function deleteStaffShift(db: AppDatabase, tenantId: string, outletId: string, shiftId: string): Promise<boolean> {
  const res = await db
    .prepare(`DELETE FROM staff_shifts WHERE tenant_id = ? AND outlet_id = ? AND id = ?`)
    .bind(tenantId, outletId, shiftId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
