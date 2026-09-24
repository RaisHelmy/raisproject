import { queryOne, type Db } from "./db";

/** Maps a workflow/attachment `module` string to the table that owns
 * records of that type. Add an entry here whenever a new module starts
 * submitting requests through the workflow engine or accepting uploads. */
const OWNER_TABLE_BY_MODULE: Record<string, string> = {
  leave_application: "leave_applications",
  claim: "claims",
  employee_request: "employee_requests",
  training_enrollment: "training_enrollments",
  payslip: "payslips",
  uniform_order: "uniform_orders",
  overtime: "overtime_requests",
  leave_quota: "leave_quota_grants",
  leave_encashment: "leave_encashments",
};

/** Looks up the employee_id that owns a given (module, recordId) pair, used
 * to authorize access to that record's routing trail and attachments. */
export async function resolveRecordEmployeeId(
  db: Db,
  module: string,
  recordId: string,
): Promise<string | null> {
  const table = OWNER_TABLE_BY_MODULE[module];
  if (!table) return null;
  const row = await queryOne<{ employee_id: string }>(
    db,
    `SELECT employee_id FROM ${table} WHERE id = ?`,
    [recordId],
  );
  return row?.employee_id ?? null;
}
