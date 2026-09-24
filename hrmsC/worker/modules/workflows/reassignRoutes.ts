import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import { notifyUser } from "../notifications/service";
import type { WorkflowStepAction } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requirePermission("workflows.reassign_tasks"));

/** Pending tasks currently sitting with a specific approver, across every
 * module — old_project's ReAssignTask search. Only steps resolved to a
 * specific employee are reassignable (a role-type step isn't "held" by one
 * person, so there's nothing to hand off). */
app.get("/tasks", async (c) => {
  const auth = c.get("auth");
  const approverEmployeeId = c.req.query("approverEmployeeId");
  if (!approverEmployeeId) return c.json({ error: "approverEmployeeId is required" }, 400);
  const module = c.req.query("module");
  const applicantEmployeeId = c.req.query("applicantEmployeeId");

  let sql = `
    SELECT wsa.*, wi.module, wi.record_id, wi.id as workflow_instance_id,
      COALESCE(la_e.id, cl_e.id, req_e.id, tr_e.id, un_e.id, ot_e.id, lq_e.id, le_e.id) as applicant_employee_id,
      COALESCE(la_e.full_name, cl_e.full_name, req_e.full_name, tr_e.full_name, un_e.full_name, ot_e.full_name, lq_e.full_name, le_e.full_name) as applicant_name,
      COALESCE(la_e.employee_no, cl_e.employee_no, req_e.employee_no, tr_e.employee_no, un_e.employee_no, ot_e.employee_no, lq_e.employee_no, le_e.employee_no) as applicant_no,
      COALESCE(lt.name, cl.claim_type, req.title, tp.title, CASE WHEN un.id IS NOT NULL THEN 'Uniform Order' END,
        CASE WHEN ot.id IS NOT NULL THEN 'Overtime: ' || ot.hours || 'h on ' || ot.work_date END,
        CASE WHEN lq.id IS NOT NULL THEN 'Leave Quota: ' || lq_t.name || ' ' || lq.granted_days || 'd' END,
        CASE WHEN le.id IS NOT NULL THEN 'Leave Encashment: ' || le_t.name || ' ' || le.days || 'd' END) as record_label
    FROM workflow_step_actions wsa
    JOIN workflow_instances wi ON wi.id = wsa.workflow_instance_id
      AND wsa.step_order = wi.current_step_order AND wi.status = 'in_progress'
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
    LEFT JOIN overtime_requests ot ON wi.module = 'overtime' AND ot.id = wi.record_id
    LEFT JOIN employees ot_e ON ot_e.id = ot.employee_id
    LEFT JOIN leave_quota_grants lq ON wi.module = 'leave_quota' AND lq.id = wi.record_id
    LEFT JOIN employees lq_e ON lq_e.id = lq.employee_id
    LEFT JOIN leave_types lq_t ON lq_t.id = lq.leave_type_id
    LEFT JOIN leave_encashments le ON wi.module = 'leave_encashment' AND le.id = wi.record_id
    LEFT JOIN employees le_e ON le_e.id = le.employee_id
    LEFT JOIN leave_types le_t ON le_t.id = le.leave_type_id
    WHERE wsa.tenant_id = ? AND wsa.action = 'pending' AND wsa.resolved_approver_employee_id = ?`;
  const params: unknown[] = [auth.tenantId, approverEmployeeId];
  if (module) {
    sql += ` AND wi.module = ?`;
    params.push(module);
  }
  if (applicantEmployeeId) {
    sql += ` AND COALESCE(la_e.id, cl_e.id, req_e.id, tr_e.id, un_e.id, ot_e.id, lq_e.id, le_e.id) = ?`;
    params.push(applicantEmployeeId);
  }
  sql += ` ORDER BY wsa.created_at ASC LIMIT 300`;

  const tasks = await queryAll(c.env.DB, sql, params);
  return c.json({ tasks });
});

const reassignSchema = z.object({
  stepActionIds: z.array(z.string()).min(1),
  reassignTo: z.string().min(1),
  comment: z.string().min(1).max(1000),
});

app.post("/", async (c) => {
  const body = reassignSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const { stepActionIds, reassignTo, comment } = body.data;

  const target = await queryOne<{ id: string; user_id: string | null; full_name: string }>(
    db,
    `SELECT id, user_id, full_name FROM employees WHERE id = ? AND tenant_id = ?`,
    [reassignTo, auth.tenantId],
  );
  if (!target) return c.json({ error: "Unknown employee to reassign to" }, 400);

  const now = nowIso();
  let reassignedCount = 0;

  for (const id of stepActionIds) {
    const step = await queryOne<WorkflowStepAction>(
      db,
      `SELECT * FROM workflow_step_actions WHERE id = ? AND tenant_id = ? AND action = 'pending'`,
      [id, auth.tenantId],
    );
    if (!step) continue;

    const previousApproverId = step.resolved_approver_employee_id;
    await exec(
      db,
      `UPDATE workflow_step_actions
       SET resolved_approver_employee_id = ?, resolved_approver_role = NULL,
           reassigned_from_employee_id = ?, reassignment_comment = ?, reassigned_at = ?
       WHERE id = ?`,
      [target.id, previousApproverId, comment, now, id],
    );

    await recordAudit(db, {
      tenantId: auth.tenantId,
      module: "workflow_reassignment",
      recordId: id,
      action: "reassigned",
      actorUserId: auth.userId,
      remarks: `${step.step_name}: reassigned to ${target.full_name} — ${comment}`,
    });

    if (target.user_id) {
      await notifyUser(db, {
        tenantId: auth.tenantId,
        userId: target.user_id,
        message: `A task was reassigned to you: ${step.step_name}`,
        link: `/workflows/${step.workflow_instance_id}`,
      });
    }
    reassignedCount += 1;
  }

  return c.json({ reassignedCount });
});

export default app;
