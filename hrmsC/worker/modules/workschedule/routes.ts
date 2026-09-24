import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne, recordAudit } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { WorkSchedule, WorkScheduleAssignment } from "./types";

const app = new Hono<AppEnv>();

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

app.get("/", async (c) => {
  const auth = c.get("auth");
  const schedules = await queryAll<WorkSchedule>(
    c.env.DB,
    `SELECT * FROM work_schedules WHERE tenant_id = ? ORDER BY name`,
    [auth.tenantId],
  );
  return c.json({ schedules });
});

const scheduleSchema = z.object({
  name: z.string().min(1).max(200),
  startTime: z.string().min(1).max(20),
  endTime: z.string().min(1).max(20),
  workDays: z.string().min(1).max(40),
});

app.post("/", requirePermission("workschedule.manage"), async (c) => {
  const body = scheduleSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;

  const id = newId();
  await exec(
    db,
    `INSERT INTO work_schedules (id, tenant_id, name, start_time, end_time, work_days) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.name, d.startTime, d.endTime, d.workDays],
  );
  await recordAudit(db, { tenantId: auth.tenantId, module: "work_schedule", recordId: id, action: "created", actorUserId: auth.userId });

  const schedule = await queryOne<WorkSchedule>(db, `SELECT * FROM work_schedules WHERE id = ?`, [id]);
  return c.json({ schedule }, 201);
});

app.put("/:id", requirePermission("workschedule.manage"), async (c) => {
  const body = scheduleSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const existing = await queryOne<WorkSchedule>(db, `SELECT * FROM work_schedules WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;

  await exec(
    db,
    `UPDATE work_schedules SET name=?, start_time=?, end_time=?, work_days=?, is_active=? WHERE id = ?`,
    [
      d.name ?? existing.name,
      d.startTime ?? existing.start_time,
      d.endTime ?? existing.end_time,
      d.workDays ?? existing.work_days,
      (d.isActive ?? Boolean(existing.is_active)) ? 1 : 0,
      id,
    ],
  );
  await recordAudit(db, { tenantId: auth.tenantId, module: "work_schedule", recordId: id, action: "updated", actorUserId: auth.userId });

  const schedule = await queryOne<WorkSchedule>(db, `SELECT * FROM work_schedules WHERE id = ?`, [id]);
  return c.json({ schedule });
});

app.get("/mine", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ assignment: null });
  const today = todayDate();
  const assignment = await queryOne(
    c.env.DB,
    `SELECT wsa.*, ws.name, ws.start_time, ws.end_time, ws.work_days
     FROM work_schedule_assignments wsa JOIN work_schedules ws ON ws.id = wsa.work_schedule_id
     WHERE wsa.tenant_id = ? AND wsa.employee_id = ? AND wsa.effective_from <= ?
       AND (wsa.effective_to IS NULL OR wsa.effective_to >= ?)
     ORDER BY wsa.effective_from DESC LIMIT 1`,
    [auth.tenantId, auth.employeeId, today, today],
  );
  return c.json({ assignment });
});

app.get("/assignments", requirePermission("workschedule.manage"), async (c) => {
  const auth = c.get("auth");
  const employeeId = c.req.query("employeeId");
  let sql = `SELECT wsa.*, e.full_name as employee_name, e.employee_no, ws.name as schedule_name
             FROM work_schedule_assignments wsa
             JOIN employees e ON e.id = wsa.employee_id
             JOIN work_schedules ws ON ws.id = wsa.work_schedule_id
             WHERE wsa.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (employeeId) {
    sql += ` AND wsa.employee_id = ?`;
    params.push(employeeId);
  }
  sql += ` ORDER BY wsa.effective_from DESC LIMIT 500`;
  const assignments = await queryAll(c.env.DB, sql, params);
  return c.json({ assignments });
});

const assignSchema = z.object({
  employeeId: z.string().min(1),
  workScheduleId: z.string().min(1),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
});

app.post("/assignments", requirePermission("workschedule.manage"), async (c) => {
  const body = assignSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;

  const employee = await queryOne(db, `SELECT id FROM employees WHERE id = ? AND tenant_id = ?`, [
    d.employeeId,
    auth.tenantId,
  ]);
  if (!employee) return c.json({ error: "Unknown employee" }, 400);
  const schedule = await queryOne(db, `SELECT id FROM work_schedules WHERE id = ? AND tenant_id = ?`, [
    d.workScheduleId,
    auth.tenantId,
  ]);
  if (!schedule) return c.json({ error: "Unknown work schedule" }, 400);

  const id = newId();
  await exec(
    db,
    `INSERT INTO work_schedule_assignments (id, tenant_id, employee_id, work_schedule_id, effective_from, effective_to)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.employeeId, d.workScheduleId, d.effectiveFrom, d.effectiveTo ?? null],
  );
  await recordAudit(db, { tenantId: auth.tenantId, module: "work_schedule_assignment", recordId: id, action: "created", actorUserId: auth.userId });

  const assignment = await queryOne<WorkScheduleAssignment>(
    db,
    `SELECT * FROM work_schedule_assignments WHERE id = ?`,
    [id],
  );
  return c.json({ assignment }, 201);
});

export default app;
