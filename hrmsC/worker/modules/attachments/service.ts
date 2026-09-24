import { queryOne, type Db } from "../../core/db";
import { resolveRecordEmployeeId } from "../../core/records";
import type { AuthContext } from "../../core/types";

/** Owner, admin/hr, or anyone resolved as an approver on the record's
 * workflow instance may view/download its attachments (an approver
 * reviewing a claim needs to see the receipt before deciding). */
export async function canViewRecordAttachments(
  db: Db,
  auth: AuthContext,
  module: string,
  recordId: string,
): Promise<boolean> {
  if (auth.role === "admin" || auth.role === "hr") return true;

  const ownerEmployeeId = await resolveRecordEmployeeId(db, module, recordId);
  if (ownerEmployeeId && ownerEmployeeId === auth.employeeId) return true;

  const instance = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM workflow_instances WHERE module = ? AND record_id = ? AND tenant_id = ?`,
    [module, recordId, auth.tenantId],
  );
  if (!instance) return false;

  const isApprover = await queryOne<{ x: number }>(
    db,
    `SELECT 1 as x FROM workflow_step_actions
     WHERE workflow_instance_id = ? AND (resolved_approver_employee_id = ? OR resolved_approver_role = ?)
     LIMIT 1`,
    [instance.id, auth.employeeId, auth.role],
  );
  return !!isApprover;
}

/** Only the record's owner or an admin/hr may attach files to it. */
export async function canUploadToRecord(
  db: Db,
  auth: AuthContext,
  module: string,
  recordId: string,
): Promise<boolean> {
  if (auth.role === "admin" || auth.role === "hr") return true;
  const ownerEmployeeId = await resolveRecordEmployeeId(db, module, recordId);
  return !!ownerEmployeeId && ownerEmployeeId === auth.employeeId;
}
