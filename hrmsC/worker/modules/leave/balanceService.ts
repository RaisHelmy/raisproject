import { exec, newId, queryAll, queryOne, type Db } from "../../core/db";
import type { LeaveBalance, LeaveType } from "./types";

export async function ensureBalance(
  db: Db,
  tenantId: string,
  employeeId: string,
  leaveType: LeaveType,
  year: number,
): Promise<LeaveBalance> {
  const existing = await queryOne<LeaveBalance>(
    db,
    `SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
    [employeeId, leaveType.id, year],
  );
  if (existing) return existing;
  const id = newId();
  await exec(
    db,
    `INSERT INTO leave_balances (id, tenant_id, employee_id, leave_type_id, year, entitled_days, used_days)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [id, tenantId, employeeId, leaveType.id, year, leaveType.default_entitlement_days],
  );
  return (await queryOne<LeaveBalance>(db, `SELECT * FROM leave_balances WHERE id = ?`, [id]))!;
}

export type BalanceSummary = {
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  entitledDays: number;
  usedDays: number;
  remainingDays: number;
};

export async function balancesForEmployee(
  db: Db,
  tenantId: string,
  employeeId: string,
  year: number,
): Promise<BalanceSummary[]> {
  const types = await queryAll<LeaveType>(
    db,
    `SELECT * FROM leave_types WHERE tenant_id = ? AND is_active = 1 ORDER BY name`,
    [tenantId],
  );
  const balances: BalanceSummary[] = [];
  for (const type of types) {
    const bal = await ensureBalance(db, tenantId, employeeId, type, year);
    balances.push({
      leaveTypeId: type.id,
      leaveTypeName: type.name,
      year,
      entitledDays: bal.entitled_days,
      usedDays: bal.used_days,
      remainingDays: bal.entitled_days - bal.used_days,
    });
  }
  return balances;
}
