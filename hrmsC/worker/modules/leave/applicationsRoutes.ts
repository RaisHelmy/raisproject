import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { hasPermission } from "../../core/permissions";
import { businessDaysBetween } from "../../core/dateUtils";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import { ensureBalance } from "./balanceService";
import type { LeaveApplication, LeaveType } from "./types";

const app = new Hono<AppEnv>();

const applySchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
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

  const days = businessDaysBetween(d.startDate, d.endDate);
  if (days <= 0) return c.json({ error: "End date must be on or after start date" }, 400);

  const year = new Date(d.startDate).getFullYear();
  const balance = await ensureBalance(db, auth.tenantId, auth.employeeId, leaveType, year);
  const remaining = balance.entitled_days - balance.used_days;
  if (days > remaining) {
    return c.json({ error: `Insufficient leave balance. Remaining: ${remaining} day(s)` }, 400);
  }

  const id = newId();
  await exec(
    db,
    `INSERT INTO leave_applications
       (id, tenant_id, employee_id, leave_type_id, start_date, end_date, days, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, auth.employeeId, d.leaveTypeId, d.startDate, d.endDate, days, d.reason ?? null],
  );

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "leave_application",
      recordId: id,
      employeeId: auth.employeeId,
      category: d.leaveTypeId,
    });
    await exec(db, `UPDATE leave_applications SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM leave_applications WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_application",
    recordId: id,
    action: "submitted",
    actorUserId: auth.userId,
    remarks: `${leaveType.name}, ${d.startDate} to ${d.endDate} (${days} day(s))`,
  });

  const application = await queryOne<LeaveApplication>(
    db,
    `SELECT * FROM leave_applications WHERE id = ?`,
    [id],
  );
  return c.json({ application }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ applications: [] });
  const applications = await queryAll(
    c.env.DB,
    `SELECT la.*, lt.name as leave_type_name
     FROM leave_applications la JOIN leave_types lt ON lt.id = la.leave_type_id
     WHERE la.tenant_id = ? AND la.employee_id = ?
     ORDER BY la.applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ applications });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  // A blanket "leave.approve" grant sees every pending item for the module
  // (the tenant-configurable override); everyone else only sees items
  // personally resolved to them — including anything reassigned to them.
  const canApproveAny = await hasPermission(db, auth, "leave.approve");

  let sql = `SELECT la.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_no,
                    wsa.step_name, wi.current_step_order
             FROM leave_applications la
             JOIN leave_types lt ON lt.id = la.leave_type_id
             JOIN employees e ON e.id = la.employee_id
             JOIN workflow_instances wi ON wi.id = la.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE la.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ applications: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY la.applied_at ASC LIMIT 200`;

  const applications = await queryAll(db, sql, params);
  return c.json({ applications });
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

  const application = await queryOne<LeaveApplication>(
    db,
    `SELECT * FROM leave_applications WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!application) return c.json({ error: "Not found" }, 404);
  if (application.status !== "pending") return c.json({ error: "Already decided" }, 400);
  if (!application.workflow_instance_id) return c.json({ error: "No workflow attached to this application" }, 500);

  let instance;
  try {
    instance = await decideCurrentStep(db, {
      tenantId: auth.tenantId,
      instanceId: application.workflow_instance_id,
      auth,
      action: body.data.action,
      remarks: body.data.remarks,
      approvePermissionKey: "leave.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    if (instance.status === "approved") {
      const year = new Date(application.start_date).getFullYear();
      const leaveType = await queryOne<LeaveType>(db, `SELECT * FROM leave_types WHERE id = ?`, [
        application.leave_type_id,
      ]);
      if (leaveType) {
        const balance = await ensureBalance(db, auth.tenantId, application.employee_id, leaveType, year);
        await exec(db, `UPDATE leave_balances SET used_days = used_days + ? WHERE id = ?`, [
          application.days,
          balance.id,
        ]);
      }
    }
    await exec(db, `UPDATE leave_applications SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_application",
    recordId: id,
    action: instance.status === "in_progress" ? "step_approved" : instance.status,
    actorUserId: auth.userId,
    remarks: body.data.remarks ?? null,
  });

  const updated = await queryOne<LeaveApplication>(
    db,
    `SELECT * FROM leave_applications WHERE id = ?`,
    [id],
  );
  return c.json({ application: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const application = await queryOne<LeaveApplication>(
    db,
    `SELECT * FROM leave_applications WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!application) return c.json({ error: "Not found" }, 404);
  if (application.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (application.status !== "pending") return c.json({ error: "Only pending applications can be cancelled" }, 400);

  if (application.workflow_instance_id) {
    await cancelWorkflow(db, auth.tenantId, application.workflow_instance_id);
  }
  await exec(db, `UPDATE leave_applications SET status='cancelled', decided_at=? WHERE id=?`, [
    nowIso(),
    id,
  ]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_application",
    recordId: id,
    action: "cancelled",
    actorUserId: auth.userId,
  });

  const updated = await queryOne<LeaveApplication>(
    db,
    `SELECT * FROM leave_applications WHERE id = ?`,
    [id],
  );
  return c.json({ application: updated });
});

export default app;
