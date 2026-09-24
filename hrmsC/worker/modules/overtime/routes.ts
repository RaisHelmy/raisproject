import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { hasPermission } from "../../core/permissions";
import { requirePermission } from "../../core/middleware";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import type { OvertimeRequest } from "./types";

const app = new Hono<AppEnv>();

const applySchema = z.object({
  workDate: z.string().min(1),
  hours: z.number().positive().max(24),
  reason: z.string().max(1000).optional().nullable(),
});

app.post("/", async (c) => {
  const body = applySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;
  const d = body.data;

  const id = newId();
  await exec(
    db,
    `INSERT INTO overtime_requests (id, tenant_id, employee_id, work_date, hours, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, auth.employeeId, d.workDate, d.hours, d.reason ?? null],
  );

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "overtime",
      recordId: id,
      employeeId: auth.employeeId,
      category: null,
      amount: d.hours,
    });
    await exec(db, `UPDATE overtime_requests SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM overtime_requests WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "overtime",
    recordId: id,
    action: "submitted",
    actorUserId: auth.userId,
    remarks: `${d.hours}h on ${d.workDate}`,
  });

  const request = await queryOne<OvertimeRequest>(db, `SELECT * FROM overtime_requests WHERE id = ?`, [id]);
  return c.json({ request }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ requests: [] });
  const requests = await queryAll<OvertimeRequest>(
    c.env.DB,
    `SELECT * FROM overtime_requests WHERE tenant_id = ? AND employee_id = ? ORDER BY work_date DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ requests });
});

app.get("/", requirePermission("overtime.manage"), async (c) => {
  const auth = c.get("auth");
  const employeeId = c.req.query("employeeId");
  const month = c.req.query("month");
  let sql = `SELECT ot.*, e.full_name as employee_name, e.employee_no
             FROM overtime_requests ot JOIN employees e ON e.id = ot.employee_id
             WHERE ot.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (employeeId) {
    sql += ` AND ot.employee_id = ?`;
    params.push(employeeId);
  }
  if (month) {
    sql += ` AND ot.work_date ILIKE ?`;
    params.push(`${month}%`);
  }
  sql += ` ORDER BY ot.work_date DESC LIMIT 500`;
  const requests = await queryAll(c.env.DB, sql, params);
  return c.json({ requests });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const canApproveAny = await hasPermission(db, auth, "overtime.approve");

  let sql = `SELECT ot.*, e.full_name as employee_name, e.employee_no,
                    wsa.step_name, wi.current_step_order
             FROM overtime_requests ot
             JOIN employees e ON e.id = ot.employee_id
             JOIN workflow_instances wi ON wi.id = ot.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE ot.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ requests: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY ot.applied_at ASC LIMIT 200`;

  const requests = await queryAll(db, sql, params);
  return c.json({ requests });
});

const decideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  remarks: z.string().max(1000).optional().nullable(),
});

app.post("/:id/decide", async (c) => {
  const body = decideSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const request = await queryOne<OvertimeRequest>(
    db,
    `SELECT * FROM overtime_requests WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!request) return c.json({ error: "Not found" }, 404);
  if (request.status !== "pending") return c.json({ error: "Already decided" }, 400);
  if (!request.workflow_instance_id) return c.json({ error: "No workflow attached to this request" }, 500);

  let instance;
  try {
    instance = await decideCurrentStep(db, {
      tenantId: auth.tenantId,
      instanceId: request.workflow_instance_id,
      auth,
      action: body.data.action,
      remarks: body.data.remarks,
      approvePermissionKey: "overtime.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    await exec(db, `UPDATE overtime_requests SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "overtime",
    recordId: id,
    action: instance.status === "in_progress" ? "step_approved" : instance.status,
    actorUserId: auth.userId,
    remarks: body.data.remarks ?? null,
  });

  const updated = await queryOne<OvertimeRequest>(db, `SELECT * FROM overtime_requests WHERE id = ?`, [id]);
  return c.json({ request: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const request = await queryOne<OvertimeRequest>(
    db,
    `SELECT * FROM overtime_requests WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!request) return c.json({ error: "Not found" }, 404);
  if (request.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (request.status !== "pending") return c.json({ error: "Only pending requests can be cancelled" }, 400);

  if (request.workflow_instance_id) {
    await cancelWorkflow(db, auth.tenantId, request.workflow_instance_id);
  }
  await exec(db, `UPDATE overtime_requests SET status='cancelled', decided_at=? WHERE id=?`, [nowIso(), id]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "overtime",
    recordId: id,
    action: "cancelled",
    actorUserId: auth.userId,
  });

  const updated = await queryOne<OvertimeRequest>(db, `SELECT * FROM overtime_requests WHERE id = ?`, [id]);
  return c.json({ request: updated });
});

export default app;
