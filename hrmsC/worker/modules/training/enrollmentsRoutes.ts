import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import { hasPermission } from "../../core/permissions";
import { WorkflowError, cancelWorkflow, decideCurrentStep, startWorkflow } from "../workflows/engine";
import type { TrainingEnrollment, TrainingEvaluation, TrainingProgram } from "./types";

const app = new Hono<AppEnv>();

app.post("/", async (c) => {
  const body = z.object({ programId: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;

  const program = await queryOne<TrainingProgram>(
    db,
    `SELECT * FROM training_programs WHERE id = ? AND tenant_id = ?`,
    [body.data.programId, auth.tenantId],
  );
  if (!program) return c.json({ error: "Unknown training program" }, 400);
  if (program.status !== "open") return c.json({ error: "This program is not open for enrollment" }, 400);

  if (program.capacity != null) {
    const taken = await queryOne<{ n: number }>(
      db,
      `SELECT COUNT(*)::int as n FROM training_enrollments WHERE program_id = ? AND status IN ('pending','approved','completed')`,
      [program.id],
    );
    if ((taken?.n ?? 0) >= program.capacity) return c.json({ error: "This program is full" }, 400);
  }

  const already = await queryOne(
    db,
    `SELECT id FROM training_enrollments WHERE program_id = ? AND employee_id = ? AND status IN ('pending','approved','completed')`,
    [program.id, auth.employeeId],
  );
  if (already) return c.json({ error: "You are already enrolled in this program" }, 409);

  const id = newId();
  await exec(db, `INSERT INTO training_enrollments (id, tenant_id, program_id, employee_id) VALUES (?, ?, ?, ?)`, [
    id,
    auth.tenantId,
    program.id,
    auth.employeeId,
  ]);

  try {
    const instance = await startWorkflow(db, {
      tenantId: auth.tenantId,
      module: "training_enrollment",
      recordId: id,
      employeeId: auth.employeeId,
      category: program.category,
    });
    await exec(db, `UPDATE training_enrollments SET workflow_instance_id = ? WHERE id = ?`, [instance.id, id]);
  } catch (err) {
    await exec(db, `DELETE FROM training_enrollments WHERE id = ?`, [id]);
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 404 | 500);
    throw err;
  }

  await recordAudit(db, { tenantId: auth.tenantId, module: "training_enrollment", recordId: id, action: "submitted", actorUserId: auth.userId, remarks: program.title });

  const enrollment = await queryOne<TrainingEnrollment>(db, `SELECT * FROM training_enrollments WHERE id = ?`, [id]);
  return c.json({ enrollment }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ enrollments: [] });
  const enrollments = await queryAll(
    c.env.DB,
    `SELECT te.*, tp.title as program_title, tp.start_date, tp.end_date
     FROM training_enrollments te JOIN training_programs tp ON tp.id = te.program_id
     WHERE te.tenant_id = ? AND te.employee_id = ? ORDER BY te.applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ enrollments });
});

app.get("/", requirePermission("training.manage"), async (c) => {
  const auth = c.get("auth");
  const programId = c.req.query("programId");
  let sql = `SELECT te.*, tp.title as program_title, e.full_name as employee_name, e.employee_no
             FROM training_enrollments te
             JOIN training_programs tp ON tp.id = te.program_id
             JOIN employees e ON e.id = te.employee_id
             WHERE te.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (programId) {
    sql += ` AND te.program_id = ?`;
    params.push(programId);
  }
  sql += ` ORDER BY te.applied_at DESC LIMIT 300`;
  const enrollments = await queryAll(c.env.DB, sql, params);
  return c.json({ enrollments });
});

app.get("/approvals", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const canApproveAny = await hasPermission(db, auth, "training.approve");

  let sql = `SELECT te.*, tp.title as program_title, e.full_name as employee_name, e.employee_no,
                    wsa.step_name, wi.current_step_order
             FROM training_enrollments te
             JOIN training_programs tp ON tp.id = te.program_id
             JOIN employees e ON e.id = te.employee_id
             JOIN workflow_instances wi ON wi.id = te.workflow_instance_id AND wi.status = 'in_progress'
             JOIN workflow_step_actions wsa
               ON wsa.workflow_instance_id = wi.id AND wsa.step_order = wi.current_step_order AND wsa.action = 'pending'
             WHERE te.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (!canApproveAny) {
    if (!auth.employeeId) return c.json({ enrollments: [] });
    sql += ` AND wsa.resolved_approver_employee_id = ?`;
    params.push(auth.employeeId);
  }
  sql += ` ORDER BY te.applied_at ASC LIMIT 200`;

  const enrollments = await queryAll(db, sql, params);
  return c.json({ enrollments });
});

const decideSchema = z.object({ action: z.enum(["approve", "reject"]), remarks: z.string().max(1000).optional().nullable() });

app.post("/:id/decide", async (c) => {
  const body = decideSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const enrollment = await queryOne<TrainingEnrollment>(
    db,
    `SELECT * FROM training_enrollments WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!enrollment) return c.json({ error: "Not found" }, 404);
  if (enrollment.status !== "pending") return c.json({ error: "Already decided" }, 400);
  if (!enrollment.workflow_instance_id) return c.json({ error: "No workflow attached" }, 500);

  let instance;
  try {
    instance = await decideCurrentStep(db, {
      tenantId: auth.tenantId,
      instanceId: enrollment.workflow_instance_id,
      auth,
      action: body.data.action,
      remarks: body.data.remarks,
      approvePermissionKey: "training.approve",
    });
  } catch (err) {
    if (err instanceof WorkflowError) return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 500);
    throw err;
  }

  if (instance.status === "approved" || instance.status === "rejected") {
    await exec(db, `UPDATE training_enrollments SET status=?, decided_at=?, decision_remarks=? WHERE id=?`, [
      instance.status,
      nowIso(),
      body.data.remarks ?? null,
      id,
    ]);
  }
  await recordAudit(db, { tenantId: auth.tenantId, module: "training_enrollment", recordId: id, action: instance.status === "in_progress" ? "step_approved" : instance.status, actorUserId: auth.userId, remarks: body.data.remarks ?? null });

  const updated = await queryOne<TrainingEnrollment>(db, `SELECT * FROM training_enrollments WHERE id = ?`, [id]);
  return c.json({ enrollment: updated });
});

app.post("/:id/cancel", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const enrollment = await queryOne<TrainingEnrollment>(
    db,
    `SELECT * FROM training_enrollments WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!enrollment) return c.json({ error: "Not found" }, 404);
  if (enrollment.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (enrollment.status !== "pending") return c.json({ error: "Only pending enrollments can be cancelled" }, 400);

  if (enrollment.workflow_instance_id) await cancelWorkflow(db, auth.tenantId, enrollment.workflow_instance_id);
  await exec(db, `UPDATE training_enrollments SET status='cancelled', decided_at=? WHERE id=?`, [nowIso(), id]);
  await recordAudit(db, { tenantId: auth.tenantId, module: "training_enrollment", recordId: id, action: "cancelled", actorUserId: auth.userId });

  const updated = await queryOne<TrainingEnrollment>(db, `SELECT * FROM training_enrollments WHERE id = ?`, [id]);
  return c.json({ enrollment: updated });
});

app.patch("/:id/complete", requirePermission("training.manage"), async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const enrollment = await queryOne<TrainingEnrollment>(
    db,
    `SELECT * FROM training_enrollments WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!enrollment) return c.json({ error: "Not found" }, 404);
  if (enrollment.status !== "approved") return c.json({ error: "Only approved enrollments can be marked complete" }, 400);

  await exec(db, `UPDATE training_enrollments SET status='completed' WHERE id=?`, [id]);
  await recordAudit(db, { tenantId: auth.tenantId, module: "training_enrollment", recordId: id, action: "completed", actorUserId: auth.userId });
  const updated = await queryOne<TrainingEnrollment>(db, `SELECT * FROM training_enrollments WHERE id = ?`, [id]);
  return c.json({ enrollment: updated });
});

const evalSchema = z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().max(2000).optional().nullable() });

app.post("/:id/evaluation", async (c) => {
  const body = evalSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const enrollment = await queryOne<TrainingEnrollment>(
    db,
    `SELECT * FROM training_enrollments WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!enrollment) return c.json({ error: "Not found" }, 404);
  if (enrollment.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (enrollment.status !== "completed") return c.json({ error: "You can only evaluate a completed training" }, 400);

  const existing = await queryOne(db, `SELECT id FROM training_evaluations WHERE enrollment_id = ?`, [id]);
  if (existing) return c.json({ error: "You already submitted an evaluation for this training" }, 409);

  const evalId = newId();
  await exec(
    db,
    `INSERT INTO training_evaluations (id, tenant_id, enrollment_id, employee_id, rating, feedback) VALUES (?, ?, ?, ?, ?, ?)`,
    [evalId, auth.tenantId, id, auth.employeeId, body.data.rating, body.data.feedback ?? null],
  );
  const evaluation = await queryOne<TrainingEvaluation>(db, `SELECT * FROM training_evaluations WHERE id = ?`, [evalId]);
  return c.json({ evaluation }, 201);
});

export default app;
