import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { hasPermission } from "../../core/permissions";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import { ensureBalance } from "./balanceService";
import type { LeaveEncashment, LeaveType } from "./types";

const app = new Hono<AppEnv>();

const applySchema = z.object({
  leaveTypeId: z.string().min(1),
  days: z.number().positive().max(365),
  dailyRate: z.number().positive(),
  reason: z.string().max(1000).optional().nullable(),
});

app.post("/", async (c) => {
  const body = applySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;
  const d = body.data;

  const leaveType = await queryOne<LeaveType>(
    db,
    `SELECT * FROM leave_types WHERE id = ? AND tenant_id = ? AND is_active = 1`,
    [d.leaveTypeId, auth.tenantId],
  );
  if (!leaveType) return c.json({ error: "Unknown leave type" }, 400);

  const year = new Date().getFullYear();
  const balance = await ensureBalance(db, auth.tenantId, auth.employeeId, leaveType, year);
  const remaining = balance.entitled_days - balance.used_days;
  if (d.days > remaining) {
    return c.json({ error: `Insufficient leave balance. Remaining: ${remaining} day(s)` }, 400);
  }

  const amount = Math.round(d.days * d.dailyRate * 100) / 100;
  const id = newId();
  await exec(
    db,
    `INSERT INTO leave_encashments (id, tenant_id, employee_id, leave_type_id, days, daily_rate, amount, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, auth.employeeId, d.leaveTypeId, d.days, d.dailyRate, amount, d.reason ?? null],
  );

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "leave_encashment",
      recordId: id,
      employeeId: auth.employeeId,
      category: d.leaveTypeId,
      amount,
    });
    await exec(db, `UPDATE leave_encashments SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM leave_encashments WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_encashment",
    recordId: id,
    action: "submitted",
    actorUserId: auth.userId,
    remarks: `${leaveType.name}: ${d.days} day(s) at ${d.dailyRate}/day`,
  });

  const encashment = await queryOne<LeaveEncashment>(db, `SELECT * FROM leave_encashments WHERE id = ?`, [id]);
  return c.json({ encashment }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ encashments: [] });
  const encashments = await queryAll(
    c.env.DB,
    `SELECT le.*, lt.name as leave_type_name
     FROM leave_encashments le JOIN leave_types lt ON lt.id = le.leave_type_id
     WHERE le.tenant_id = ? AND le.employee_id = ?
     ORDER BY le.applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ encashments });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const canApproveAny = await hasPermission(db, auth, "leave.encashment.approve");

  let sql = `SELECT le.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_no,
                    wsa.step_name, wi.current_step_order
             FROM leave_encashments le
             JOIN leave_types lt ON lt.id = le.leave_type_id
             JOIN employees e ON e.id = le.employee_id
             JOIN workflow_instances wi ON wi.id = le.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE le.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ encashments: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY le.applied_at ASC LIMIT 200`;

  const encashments = await queryAll(db, sql, params);
  return c.json({ encashments });
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

  const encashment = await queryOne<LeaveEncashment>(
    db,
    `SELECT * FROM leave_encashments WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!encashment) return c.json({ error: "Not found" }, 404);
  if (encashment.status !== "pending") return c.json({ error: "Already decided" }, 400);
  if (!encashment.workflow_instance_id) return c.json({ error: "No workflow attached to this request" }, 500);

  let instance;
  try {
    instance = await decideCurrentStep(db, {
      tenantId: auth.tenantId,
      instanceId: encashment.workflow_instance_id,
      auth,
      action: body.data.action,
      remarks: body.data.remarks,
      approvePermissionKey: "leave.encashment.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    if (instance.status === "approved") {
      const leaveType = await queryOne<LeaveType>(db, `SELECT * FROM leave_types WHERE id = ?`, [
        encashment.leave_type_id,
      ]);
      if (leaveType) {
        const year = new Date().getFullYear();
        const balance = await ensureBalance(db, auth.tenantId, encashment.employee_id, leaveType, year);
        await exec(db, `UPDATE leave_balances SET used_days = used_days + ? WHERE id = ?`, [
          encashment.days,
          balance.id,
        ]);
      }
    }
    await exec(db, `UPDATE leave_encashments SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_encashment",
    recordId: id,
    action: instance.status === "in_progress" ? "step_approved" : instance.status,
    actorUserId: auth.userId,
    remarks: body.data.remarks ?? null,
  });

  const updated = await queryOne<LeaveEncashment>(db, `SELECT * FROM leave_encashments WHERE id = ?`, [id]);
  return c.json({ encashment: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const encashment = await queryOne<LeaveEncashment>(
    db,
    `SELECT * FROM leave_encashments WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!encashment) return c.json({ error: "Not found" }, 404);
  if (encashment.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (encashment.status !== "pending") return c.json({ error: "Only pending requests can be cancelled" }, 400);

  if (encashment.workflow_instance_id) {
    await cancelWorkflow(db, auth.tenantId, encashment.workflow_instance_id);
  }
  await exec(db, `UPDATE leave_encashments SET status='cancelled', decided_at=? WHERE id=?`, [nowIso(), id]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_encashment",
    recordId: id,
    action: "cancelled",
    actorUserId: auth.userId,
  });

  const updated = await queryOne<LeaveEncashment>(db, `SELECT * FROM leave_encashments WHERE id = ?`, [id]);
  return c.json({ encashment: updated });
});

export default app;
