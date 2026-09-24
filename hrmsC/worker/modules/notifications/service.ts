import { exec, newId, queryAll, queryOne, type Db } from "../../core/db";
import { resolveRecordEmployeeId } from "../../core/records";
import type { Role } from "../../core/types";

export async function notifyUser(
  db: Db,
  entry: { tenantId: string; userId: string; message: string; link?: string | null },
): Promise<void> {
  await exec(
    db,
    `INSERT INTO notifications (id, tenant_id, user_id, message, link) VALUES (?, ?, ?, ?, ?)`,
    [newId(), entry.tenantId, entry.userId, entry.message, entry.link ?? null],
  );
}

async function notifyRole(
  db: Db,
  entry: { tenantId: string; role: Role; message: string; link?: string | null },
): Promise<void> {
  const users = await queryAll<{ id: string }>(
    db,
    `SELECT id FROM users WHERE tenant_id = ? AND role = ? AND is_active = 1`,
    [entry.tenantId, entry.role],
  );
  for (const u of users) {
    await notifyUser(db, { tenantId: entry.tenantId, userId: u.id, message: entry.message, link: entry.link });
  }
}

/** Notifies whoever a workflow step resolved to — a specific employee's
 * user account, or every active user holding a role. Silently no-ops for
 * an employee_manager/specific_user step that resolved to no linked login
 * (e.g. the employee has no manager) — there's simply no one to notify. */
export async function notifyStepApprovers(
  db: Db,
  entry: {
    tenantId: string;
    resolvedApproverEmployeeId: string | null;
    resolvedApproverRole: Role | null;
    message: string;
    link?: string | null;
  },
): Promise<void> {
  if (entry.resolvedApproverEmployeeId) {
    const emp = await queryOne<{ user_id: string | null }>(
      db,
      `SELECT user_id FROM employees WHERE id = ?`,
      [entry.resolvedApproverEmployeeId],
    );
    if (emp?.user_id) {
      await notifyUser(db, { tenantId: entry.tenantId, userId: emp.user_id, message: entry.message, link: entry.link });
    }
    return;
  }
  if (entry.resolvedApproverRole) {
    await notifyRole(db, { tenantId: entry.tenantId, role: entry.resolvedApproverRole, message: entry.message, link: entry.link });
  }
}

/** Notifies the employee who owns a (module, recordId) record — e.g. "your
 * leave application was approved" — if their account is linked to a login. */
export async function notifySubmitter(
  db: Db,
  entry: { tenantId: string; module: string; recordId: string; message: string; link?: string | null },
): Promise<void> {
  const employeeId = await resolveRecordEmployeeId(db, entry.module, entry.recordId);
  if (!employeeId) return;
  const emp = await queryOne<{ user_id: string | null }>(db, `SELECT user_id FROM employees WHERE id = ?`, [employeeId]);
  if (!emp?.user_id) return;
  await notifyUser(db, { tenantId: entry.tenantId, userId: emp.user_id, message: entry.message, link: entry.link });
}
