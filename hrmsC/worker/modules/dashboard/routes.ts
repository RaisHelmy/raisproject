import { Hono } from "hono";
import type { AppEnv, AuthContext } from "../../core/types";
import { queryOne, type Db } from "../../core/db";
import { requireAuth } from "../../core/middleware";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

/** Pending items at the current step of any in-progress workflow instance
 * for `module` that this user can act on — admin/hr see every one (they
 * have a universal override in the workflow engine), everyone else only
 * the ones actually resolved to them. */
async function countPendingApprovals(db: Db, auth: AuthContext, module: string): Promise<number> {
  const isAdminOrHr = auth.role === "admin" || auth.role === "hr";
  let sql = `SELECT COUNT(*)::int as n FROM workflow_step_actions wsa
             JOIN workflow_instances wi ON wi.id = wsa.workflow_instance_id AND wsa.step_order = wi.current_step_order
             WHERE wi.tenant_id = ? AND wi.module = ? AND wi.status = 'in_progress' AND wsa.action = 'pending'`;
  const params: unknown[] = [auth.tenantId, module];
  if (!isAdminOrHr) {
    sql += ` AND (wsa.resolved_approver_employee_id = ? OR wsa.resolved_approver_role = ?)`;
    params.push(auth.employeeId, auth.role);
  }
  return (await queryOne<{ n: number }>(db, sql, params))?.n ?? 0;
}

app.get("/", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;

  const own = auth.employeeId
    ? {
        pendingLeaveApplications:
          (
            await queryOne<{ n: number }>(
              db,
              `SELECT COUNT(*)::int as n FROM leave_applications WHERE tenant_id = ? AND employee_id = ? AND status = 'pending'`,
              [auth.tenantId, auth.employeeId],
            )
          )?.n ?? 0,
        pendingClaims:
          (
            await queryOne<{ n: number }>(
              db,
              `SELECT COUNT(*)::int as n FROM claims WHERE tenant_id = ? AND employee_id = ? AND status = 'pending'`,
              [auth.tenantId, auth.employeeId],
            )
          )?.n ?? 0,
      }
    : null;

  let approvals: { pendingLeave: number; pendingClaims: number } | null = null;
  if (auth.role === "admin" || auth.role === "hr" || auth.role === "manager") {
    approvals = {
      pendingLeave: await countPendingApprovals(db, auth, "leave_application"),
      pendingClaims: await countPendingApprovals(db, auth, "claim"),
    };
  }

  let organization: { totalEmployees: number; activeEmployees: number } | null = null;
  if (auth.role === "admin" || auth.role === "hr") {
    organization = {
      totalEmployees:
        (
          await queryOne<{ n: number }>(
            db,
            `SELECT COUNT(*)::int as n FROM employees WHERE tenant_id = ?`,
            [auth.tenantId],
          )
        )?.n ?? 0,
      activeEmployees:
        (
          await queryOne<{ n: number }>(
            db,
            `SELECT COUNT(*)::int as n FROM employees WHERE tenant_id = ? AND status = 'active'`,
            [auth.tenantId],
          )
        )?.n ?? 0,
    };
  }

  return c.json({ own, approvals, organization });
});

export default app;
