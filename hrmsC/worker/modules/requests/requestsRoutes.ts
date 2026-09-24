import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { hasPermission } from "../../core/permissions";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import type { EmployeeRequest, RequestType } from "./types";

const app = new Hono<AppEnv>();

const applySchema = z.object({
  requestTypeId: z.string().min(1),
  title: z.string().min(1).max(200),
  amount: z.number().optional().nullable(),
  details: z.string().max(2000).optional().nullable(),
});

app.post("/", async (c) => {
  const body = applySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;
  const d = body.data;

  const requestType = await queryOne<RequestType>(
    db,
    `SELECT * FROM request_types WHERE id = ? AND tenant_id = ? AND is_active = 1`,
    [d.requestTypeId, auth.tenantId],
  );
  if (!requestType) return c.json({ error: "Unknown request type" }, 400);
  if (requestType.requires_amount && d.amount == null) {
    return c.json({ error: `${requestType.name} requires an amount` }, 400);
  }

  const id = newId();
  await exec(
    db,
    `INSERT INTO employee_requests (id, tenant_id, employee_id, request_type_id, title, amount, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, auth.employeeId, d.requestTypeId, d.title, d.amount ?? null, d.details ?? null],
  );

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "employee_request",
      recordId: id,
      employeeId: auth.employeeId,
      category: d.requestTypeId,
      amount: d.amount ?? null,
    });
    await exec(db, `UPDATE employee_requests SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM employee_requests WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "employee_request",
    recordId: id,
    action: "submitted",
    actorUserId: auth.userId,
    remarks: `${requestType.name}: ${d.title}`,
  });

  const request = await queryOne<EmployeeRequest>(db, `SELECT * FROM employee_requests WHERE id = ?`, [id]);
  return c.json({ request }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ requests: [] });
  const requests = await queryAll(
    c.env.DB,
    `SELECT er.*, rt.name as request_type_name
     FROM employee_requests er JOIN request_types rt ON rt.id = er.request_type_id
     WHERE er.tenant_id = ? AND er.employee_id = ?
     ORDER BY er.applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ requests });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const canApproveAny = await hasPermission(db, auth, "requests.approve");

  let sql = `SELECT er.*, rt.name as request_type_name, e.full_name as employee_name, e.employee_no,
                    wsa.step_name, wi.current_step_order
             FROM employee_requests er
             JOIN request_types rt ON rt.id = er.request_type_id
             JOIN employees e ON e.id = er.employee_id
             JOIN workflow_instances wi ON wi.id = er.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE er.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ requests: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY er.applied_at ASC LIMIT 200`;

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

  const request = await queryOne<EmployeeRequest>(
    db,
    `SELECT * FROM employee_requests WHERE id = ? AND tenant_id = ?`,
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
      approvePermissionKey: "requests.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    await exec(db, `UPDATE employee_requests SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "employee_request",
    recordId: id,
    action: instance.status === "in_progress" ? "step_approved" : instance.status,
    actorUserId: auth.userId,
    remarks: body.data.remarks ?? null,
  });

  const updated = await queryOne<EmployeeRequest>(db, `SELECT * FROM employee_requests WHERE id = ?`, [id]);
  return c.json({ request: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const request = await queryOne<EmployeeRequest>(
    db,
    `SELECT * FROM employee_requests WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!request) return c.json({ error: "Not found" }, 404);
  if (request.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (request.status !== "pending") return c.json({ error: "Only pending requests can be cancelled" }, 400);

  if (request.workflow_instance_id) {
    await cancelWorkflow(db, auth.tenantId, request.workflow_instance_id);
  }
  await exec(db, `UPDATE employee_requests SET status='cancelled', decided_at=? WHERE id=?`, [nowIso(), id]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "employee_request",
    recordId: id,
    action: "cancelled",
    actorUserId: auth.userId,
  });

  const updated = await queryOne<EmployeeRequest>(db, `SELECT * FROM employee_requests WHERE id = ?`, [id]);
  return c.json({ request: updated });
});

export default app;
