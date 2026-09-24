import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { hasPermission } from "../../core/permissions";
import { requirePermission } from "../../core/middleware";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import { ensureBalance } from "./balanceService";
import type { LeaveQuotaGrant, LeaveType } from "./types";

const app = new Hono<AppEnv>();

const applySchema = z.object({
  leaveTypeId: z.string().min(1),
  days: z.number().positive().max(365),
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
  const id = newId();
  await exec(
    db,
    `INSERT INTO leave_quota_grants (id, tenant_id, employee_id, leave_type_id, year, granted_days, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, auth.employeeId, d.leaveTypeId, year, d.days, d.reason ?? null],
  );

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "leave_quota",
      recordId: id,
      employeeId: auth.employeeId,
      category: d.leaveTypeId,
      amount: d.days,
    });
    await exec(db, `UPDATE leave_quota_grants SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM leave_quota_grants WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_quota",
    recordId: id,
    action: "submitted",
    actorUserId: auth.userId,
    remarks: `${leaveType.name}: ${d.days} day(s) requested`,
  });

  const grant = await queryOne<LeaveQuotaGrant>(db, `SELECT * FROM leave_quota_grants WHERE id = ?`, [id]);
  return c.json({ grant }, 201);
});

const directGrantSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  days: z.number().positive().max(365),
  reason: z.string().max(1000).optional().nullable(),
});

app.post("/grant", requirePermission("leave.quota.manage"), async (c) => {
  const body = directGrantSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;

  const employee = await queryOne(db, `SELECT id FROM employees WHERE id = ? AND tenant_id = ?`, [
    d.employeeId,
    auth.tenantId,
  ]);
  if (!employee) return c.json({ error: "Unknown employee" }, 400);
  const leaveType = await queryOne<LeaveType>(
    db,
    `SELECT * FROM leave_types WHERE id = ? AND tenant_id = ? AND is_active = 1`,
    [d.leaveTypeId, auth.tenantId],
  );
  if (!leaveType) return c.json({ error: "Unknown leave type" }, 400);

  const year = new Date().getFullYear();
  const id = newId();
  const now = nowIso();
  await exec(
    db,
    `INSERT INTO leave_quota_grants
       (id, tenant_id, employee_id, leave_type_id, year, granted_days, reason, status, decided_at, granted_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`,
    [id, auth.tenantId, d.employeeId, d.leaveTypeId, year, d.days, d.reason ?? null, now, auth.userId],
  );

  const balance = await ensureBalance(db, auth.tenantId, d.employeeId, leaveType, year);
  await exec(db, `UPDATE leave_balances SET entitled_days = entitled_days + ? WHERE id = ?`, [d.days, balance.id]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_quota",
    recordId: id,
    action: "granted",
    actorUserId: auth.userId,
    remarks: `${leaveType.name}: ${d.days} day(s) granted directly`,
  });

  const grant = await queryOne<LeaveQuotaGrant>(db, `SELECT * FROM leave_quota_grants WHERE id = ?`, [id]);
  return c.json({ grant }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ grants: [] });
  const grants = await queryAll(
    c.env.DB,
    `SELECT g.*, lt.name as leave_type_name
     FROM leave_quota_grants g JOIN leave_types lt ON lt.id = g.leave_type_id
     WHERE g.tenant_id = ? AND g.employee_id = ?
     ORDER BY g.applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ grants });
});

app.get("/", requirePermission("leave.quota.manage"), async (c) => {
  const auth = c.get("auth");
  const employeeId = c.req.query("employeeId");
  let sql = `SELECT g.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_no
             FROM leave_quota_grants g
             JOIN leave_types lt ON lt.id = g.leave_type_id
             JOIN employees e ON e.id = g.employee_id
             WHERE g.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (employeeId) {
    sql += ` AND g.employee_id = ?`;
    params.push(employeeId);
  }
  sql += ` ORDER BY g.applied_at DESC LIMIT 500`;
  const grants = await queryAll(c.env.DB, sql, params);
  return c.json({ grants });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const canApproveAny = await hasPermission(db, auth, "leave.quota.approve");

  let sql = `SELECT g.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_no,
                    wsa.step_name, wi.current_step_order
             FROM leave_quota_grants g
             JOIN leave_types lt ON lt.id = g.leave_type_id
             JOIN employees e ON e.id = g.employee_id
             JOIN workflow_instances wi ON wi.id = g.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE g.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ grants: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY g.applied_at ASC LIMIT 200`;

  const grants = await queryAll(db, sql, params);
  return c.json({ grants });
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

  const grant = await queryOne<LeaveQuotaGrant>(
    db,
    `SELECT * FROM leave_quota_grants WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!grant) return c.json({ error: "Not found" }, 404);
  if (grant.status !== "pending") return c.json({ error: "Already decided" }, 400);
  if (!grant.workflow_instance_id) return c.json({ error: "No workflow attached to this request" }, 500);

  let instance;
  try {
    instance = await decideCurrentStep(db, {
      tenantId: auth.tenantId,
      instanceId: grant.workflow_instance_id,
      auth,
      action: body.data.action,
      remarks: body.data.remarks,
      approvePermissionKey: "leave.quota.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    if (instance.status === "approved") {
      const leaveType = await queryOne<LeaveType>(db, `SELECT * FROM leave_types WHERE id = ?`, [
        grant.leave_type_id,
      ]);
      if (leaveType) {
        const balance = await ensureBalance(db, auth.tenantId, grant.employee_id, leaveType, grant.year);
        await exec(db, `UPDATE leave_balances SET entitled_days = entitled_days + ? WHERE id = ?`, [
          grant.granted_days,
          balance.id,
        ]);
      }
    }
    await exec(db, `UPDATE leave_quota_grants SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_quota",
    recordId: id,
    action: instance.status === "in_progress" ? "step_approved" : instance.status,
    actorUserId: auth.userId,
    remarks: body.data.remarks ?? null,
  });

  const updated = await queryOne<LeaveQuotaGrant>(db, `SELECT * FROM leave_quota_grants WHERE id = ?`, [id]);
  return c.json({ grant: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const grant = await queryOne<LeaveQuotaGrant>(
    db,
    `SELECT * FROM leave_quota_grants WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!grant) return c.json({ error: "Not found" }, 404);
  if (grant.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (grant.status !== "pending") return c.json({ error: "Only pending requests can be cancelled" }, 400);

  if (grant.workflow_instance_id) {
    await cancelWorkflow(db, auth.tenantId, grant.workflow_instance_id);
  }
  await exec(db, `UPDATE leave_quota_grants SET status='cancelled', decided_at=? WHERE id=?`, [nowIso(), id]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "leave_quota",
    recordId: id,
    action: "cancelled",
    actorUserId: auth.userId,
  });

  const updated = await queryOne<LeaveQuotaGrant>(db, `SELECT * FROM leave_quota_grants WHERE id = ?`, [id]);
  return c.json({ grant: updated });
});

export default app;
