import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requireAuth } from "../../core/middleware";
import { hasPermission } from "../../core/permissions";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import type { Claim, ClaimType } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

const applySchema = z.object({
  claimTypeId: z.string().min(1),
  amount: z.number().positive().max(1_000_000).optional(),
  distance: z.number().positive().max(100_000).optional(),
  currency: z.string().min(1).max(10).default("USD"),
  claimDate: z.string().min(1),
  description: z.string().max(1000).optional().nullable(),
});

app.post("/", async (c) => {
  const body = applySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;
  const d = body.data;

  const claimType = await queryOne<ClaimType>(
    db,
    `SELECT * FROM claim_types WHERE id = ? AND tenant_id = ? AND is_active = 1`,
    [d.claimTypeId, auth.tenantId],
  );
  if (!claimType) return c.json({ error: "Unknown claim type" }, 400);

  let amount: number;
  if (claimType.is_mileage) {
    if (!d.distance) return c.json({ error: `${claimType.name} requires a distance` }, 400);
    amount = Math.round(d.distance * (claimType.mileage_rate ?? 0) * 100) / 100;
  } else {
    if (!d.amount) return c.json({ error: "Amount is required" }, 400);
    amount = d.amount;
  }

  const id = newId();
  await exec(
    db,
    `INSERT INTO claims (id, tenant_id, employee_id, claim_type, claim_type_id, amount, currency, claim_date, description, distance, is_advance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      auth.tenantId,
      auth.employeeId,
      claimType.name,
      claimType.id,
      amount,
      d.currency,
      d.claimDate,
      d.description ?? null,
      claimType.is_mileage ? d.distance : null,
      claimType.is_advance ? 1 : 0,
    ],
  );

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "claim",
      recordId: id,
      employeeId: auth.employeeId,
      category: claimType.name,
      amount,
    });
    await exec(db, `UPDATE claims SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM claims WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "claim",
    recordId: id,
    action: "submitted",
    actorUserId: auth.userId,
    remarks: `${claimType.name}: ${d.currency} ${amount}`,
  });

  const claim = await queryOne<Claim>(db, `SELECT * FROM claims WHERE id = ?`, [id]);
  return c.json({ claim }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ claims: [] });
  const claims = await queryAll<Claim>(
    c.env.DB,
    `SELECT * FROM claims WHERE tenant_id = ? AND employee_id = ? ORDER BY applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ claims });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const canApproveAny = await hasPermission(db, auth, "claims.approve");

  let sql = `SELECT cl.*, e.full_name as employee_name, e.employee_no, wsa.step_name, wi.current_step_order
             FROM claims cl
             JOIN employees e ON e.id = cl.employee_id
             JOIN workflow_instances wi ON wi.id = cl.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE cl.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ claims: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY cl.applied_at ASC LIMIT 200`;

  const claims = await queryAll(db, sql, params);
  return c.json({ claims });
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

  const claim = await queryOne<Claim>(db, `SELECT * FROM claims WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!claim) return c.json({ error: "Not found" }, 404);
  if (claim.status !== "pending") return c.json({ error: "Already decided" }, 400);
  if (!claim.workflow_instance_id) return c.json({ error: "No workflow attached to this claim" }, 500);

  let instance;
  try {
    instance = await decideCurrentStep(db, {
      tenantId: auth.tenantId,
      instanceId: claim.workflow_instance_id,
      auth,
      action: body.data.action,
      remarks: body.data.remarks,
      approvePermissionKey: "claims.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    await exec(db, `UPDATE claims SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "claim",
    recordId: id,
    action: instance.status === "in_progress" ? "step_approved" : instance.status,
    actorUserId: auth.userId,
    remarks: body.data.remarks ?? null,
  });

  const updated = await queryOne<Claim>(db, `SELECT * FROM claims WHERE id = ?`, [id]);
  return c.json({ claim: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const claim = await queryOne<Claim>(db, `SELECT * FROM claims WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!claim) return c.json({ error: "Not found" }, 404);
  if (claim.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (claim.status !== "pending") return c.json({ error: "Only pending claims can be cancelled" }, 400);

  if (claim.workflow_instance_id) {
    await cancelWorkflow(db, auth.tenantId, claim.workflow_instance_id);
  }
  await exec(db, `UPDATE claims SET status='cancelled', decided_at=? WHERE id=?`, [nowIso(), id]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "claim",
    recordId: id,
    action: "cancelled",
    actorUserId: auth.userId,
  });

  const updated = await queryOne<Claim>(db, `SELECT * FROM claims WHERE id = ?`, [id]);
  return c.json({ claim: updated });
});

export default app;
