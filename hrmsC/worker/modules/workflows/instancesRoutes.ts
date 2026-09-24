import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import { resolveRecordEmployeeId } from "../../core/records";
import type { WorkflowInstance, WorkflowStepAction } from "./types";

const app = new Hono<AppEnv>();

app.get("/instances/:id", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const instance = await queryOne<WorkflowInstance>(
    db,
    `SELECT * FROM workflow_instances WHERE id = ? AND tenant_id = ?`,
    [c.req.param("id"), auth.tenantId],
  );
  if (!instance) return c.json({ error: "Not found" }, 404);

  const ownerEmployeeId = await resolveRecordEmployeeId(db, instance.module, instance.record_id);

  const steps = await queryAll<WorkflowStepAction & { acted_by_name: string | null; reassigned_from_name: string | null }>(
    db,
    `SELECT wsa.*, u.name as acted_by_name, rf.full_name as reassigned_from_name
     FROM workflow_step_actions wsa
     LEFT JOIN users u ON u.id = wsa.acted_by_user_id
     LEFT JOIN employees rf ON rf.id = wsa.reassigned_from_employee_id
     WHERE wsa.workflow_instance_id = ? ORDER BY wsa.step_order`,
    [instance.id],
  );

  const isOwner = !!ownerEmployeeId && ownerEmployeeId === auth.employeeId;
  const isApprover = steps.some(
    (s) =>
      (s.resolved_approver_employee_id && s.resolved_approver_employee_id === auth.employeeId) ||
      (s.resolved_approver_role && s.resolved_approver_role === auth.role),
  );
  const isAdmin = auth.role === "admin" || auth.role === "hr";
  if (!isOwner && !isApprover && !isAdmin) return c.json({ error: "Forbidden" }, 403);

  return c.json({ instance, steps });
});

app.get("/routing-logs", requirePermission("workflows.routing_logs.view"), async (c) => {
  const auth = c.get("auth");
  const module = c.req.query("module");
  const status = c.req.query("status");

  let sql = `
    SELECT wi.*,
      COALESCE(la_e.full_name, cl_e.full_name, req_e.full_name, tr_e.full_name, un_e.full_name) as employee_name,
      COALESCE(la_e.employee_no, cl_e.employee_no, req_e.employee_no, tr_e.employee_no, un_e.employee_no) as employee_no,
      COALESCE(lt.name, cl.claim_type, req.title, tp.title, CASE WHEN un.id IS NOT NULL THEN 'Uniform Order' END) as record_label
    FROM workflow_instances wi
    LEFT JOIN leave_applications la ON wi.module = 'leave_application' AND la.id = wi.record_id
    LEFT JOIN employees la_e ON la_e.id = la.employee_id
    LEFT JOIN leave_types lt ON lt.id = la.leave_type_id
    LEFT JOIN claims cl ON wi.module = 'claim' AND cl.id = wi.record_id
    LEFT JOIN employees cl_e ON cl_e.id = cl.employee_id
    LEFT JOIN employee_requests req ON wi.module = 'employee_request' AND req.id = wi.record_id
    LEFT JOIN employees req_e ON req_e.id = req.employee_id
    LEFT JOIN training_enrollments tr ON wi.module = 'training_enrollment' AND tr.id = wi.record_id
    LEFT JOIN employees tr_e ON tr_e.id = tr.employee_id
    LEFT JOIN training_programs tp ON tp.id = tr.program_id
    LEFT JOIN uniform_orders un ON wi.module = 'uniform_order' AND un.id = wi.record_id
    LEFT JOIN employees un_e ON un_e.id = un.employee_id
    WHERE wi.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (module) {
    sql += ` AND wi.module = ?`;
    params.push(module);
  }
  if (status) {
    sql += ` AND wi.status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY wi.created_at DESC LIMIT 300`;

  const instances = await queryAll(c.env.DB, sql, params);
  return c.json({ instances });
});

export default app;
