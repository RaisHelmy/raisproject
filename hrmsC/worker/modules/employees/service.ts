import { queryAll, type Db } from "../../core/db";

export async function nextEmployeeNo(db: Db, tenantId: string): Promise<string> {
  const rows = await queryAll<{ employee_no: string }>(
    db,
    `SELECT employee_no FROM employees WHERE tenant_id = ?`,
    [tenantId],
  );
  let max = 0;
  for (const row of rows) {
    const match = /EMP-(\d+)/.exec(row.employee_no);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}
