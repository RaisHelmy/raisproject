import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit, type Db } from "../../core/db";
import { hasPermission } from "../../core/permissions";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import type { UniformItem, UniformOrder, UniformOrderLine } from "./types";

const app = new Hono<AppEnv>();

const lineSchema = z.object({ uniformItemId: z.string().min(1), size: z.string().min(1), quantity: z.number().int().min(1).max(20) });
const applySchema = z.object({ lines: z.array(lineSchema).min(1) });

app.post("/", async (c) => {
  const body = applySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;

  for (const line of body.data.lines) {
    const item = await queryOne<UniformItem>(
      db,
      `SELECT * FROM uniform_items WHERE id = ? AND tenant_id = ? AND is_active = 1`,
      [line.uniformItemId, auth.tenantId],
    );
    if (!item) return c.json({ error: "Unknown uniform item" }, 400);
    if (!item.available_sizes.split(",").includes(line.size)) {
      return c.json({ error: `${item.name} is not available in size ${line.size}` }, 400);
    }
  }

  const id = newId();
  await exec(db, `INSERT INTO uniform_orders (id, tenant_id, employee_id) VALUES (?, ?, ?)`, [
    id,
    auth.tenantId,
    auth.employeeId,
  ]);
  for (const line of body.data.lines) {
    await exec(
      db,
      `INSERT INTO uniform_order_lines (id, tenant_id, order_id, uniform_item_id, size, quantity) VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), auth.tenantId, id, line.uniformItemId, line.size, line.quantity],
    );
  }

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "uniform_order",
      recordId: id,
      employeeId: auth.employeeId,
      category: null,
    });
    await exec(db, `UPDATE uniform_orders SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM uniform_order_lines WHERE order_id = ?`, [id]);
    await exec(db, `DELETE FROM uniform_orders WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, { tenantId: auth.tenantId, module: "uniform_order", recordId: id, action: "submitted", actorUserId: auth.userId, remarks: `${body.data.lines.length} item(s)` });

  const order = await queryOne<UniformOrder>(db, `SELECT * FROM uniform_orders WHERE id = ?`, [id]);
  return c.json({ order }, 201);
});

async function withLines(db: Db, orders: UniformOrder[]) {
  const result = [];
  for (const order of orders) {
    const lines = await queryAll<UniformOrderLine & { item_name: string }>(
      db,
      `SELECT uol.*, ui.name as item_name FROM uniform_order_lines uol
       JOIN uniform_items ui ON ui.id = uol.uniform_item_id WHERE uol.order_id = ?`,
      [order.id],
    );
    result.push({ ...order, lines });
  }
  return result;
}

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ orders: [] });
  const orders = await queryAll<UniformOrder>(
    c.env.DB,
    `SELECT * FROM uniform_orders WHERE tenant_id = ? AND employee_id = ? ORDER BY applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ orders: await withLines(c.env.DB, orders) });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const canApproveAny = await hasPermission(db, auth, "uniform.approve");

  let sql = `SELECT uo.*, e.full_name as employee_name, e.employee_no, wsa.step_name, wi.current_step_order
             FROM uniform_orders uo
             JOIN employees e ON e.id = uo.employee_id
             JOIN workflow_instances wi ON wi.id = uo.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE uo.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ orders: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY uo.applied_at ASC LIMIT 200`;

  const orders = await queryAll<UniformOrder>(db, sql, params);
  return c.json({ orders: await withLines(db, orders) });
});

const decideSchema = z.object({ action: z.enum(["approve", "reject"]), remarks: z.string().max(1000).optional().nullable() });

app.post("/:id/decide", async (c) => {
  const body = decideSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const order = await queryOne<UniformOrder>(db, `SELECT * FROM uniform_orders WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!order) return c.json({ error: "Not found" }, 404);
  if (order.status !== "pending") return c.json({ error: "Already decided" }, 400);
  if (!order.workflow_instance_id) return c.json({ error: "No workflow attached" }, 500);

  let instance;
  try {
    instance = await decideCurrentStep(db, {
      tenantId: auth.tenantId,
      instanceId: order.workflow_instance_id,
      auth,
      action: body.data.action,
      remarks: body.data.remarks,
      approvePermissionKey: "uniform.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    await exec(db, `UPDATE uniform_orders SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }
  await recordAudit(db, { tenantId: auth.tenantId, module: "uniform_order", recordId: id, action: instance.status === "in_progress" ? "step_approved" : instance.status, actorUserId: auth.userId, remarks: body.data.remarks ?? null });

  const updated = await queryOne<UniformOrder>(db, `SELECT * FROM uniform_orders WHERE id = ?`, [id]);
  return c.json({ order: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const order = await queryOne<UniformOrder>(db, `SELECT * FROM uniform_orders WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!order) return c.json({ error: "Not found" }, 404);
  if (order.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (order.status !== "pending") return c.json({ error: "Only pending orders can be cancelled" }, 400);

  if (order.workflow_instance_id) await cancelWorkflow(db, auth.tenantId, order.workflow_instance_id);
  await exec(db, `UPDATE uniform_orders SET status='cancelled', decided_at=? WHERE id=?`, [nowIso(), id]);
  await recordAudit(db, { tenantId: auth.tenantId, module: "uniform_order", recordId: id, action: "cancelled", actorUserId: auth.userId });

  const updated = await queryOne<UniformOrder>(db, `SELECT * FROM uniform_orders WHERE id = ?`, [id]);
  return c.json({ order: updated });
});

export default app;
