import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requireAuth, requirePermission } from "../../core/middleware";
import type { Timesheet } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

app.post("/clock-in", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;
  const workDate = todayDate();

  const existing = await queryOne<Timesheet>(
    db,
    `SELECT * FROM timesheets WHERE employee_id = ? AND work_date = ?`,
    [auth.employeeId, workDate],
  );
  if (existing?.clock_in) {
    return c.json({ error: "Already clocked in today" }, 400);
  }

  const now = nowIso();
  if (existing) {
    await exec(db, `UPDATE timesheets SET clock_in = ? WHERE id = ?`, [now, existing.id]);
  } else {
    await exec(
      db,
      `INSERT INTO timesheets (id, tenant_id, employee_id, work_date, clock_in) VALUES (?, ?, ?, ?, ?)`,
      [newId(), auth.tenantId, auth.employeeId, workDate, now],
    );
  }

  const timesheet = await queryOne<Timesheet>(
    db,
    `SELECT * FROM timesheets WHERE employee_id = ? AND work_date = ?`,
    [auth.employeeId, workDate],
  );
  return c.json({ timesheet });
});

app.post("/clock-out", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;
  const workDate = todayDate();

  const existing = await queryOne<Timesheet>(
    db,
    `SELECT * FROM timesheets WHERE employee_id = ? AND work_date = ?`,
    [auth.employeeId, workDate],
  );
  if (!existing?.clock_in) return c.json({ error: "You have not clocked in today" }, 400);
  if (existing.clock_out) return c.json({ error: "Already clocked out today" }, 400);

  const now = nowIso();
  const hours = (new Date(now).getTime() - new Date(existing.clock_in).getTime()) / 3_600_000;

  await exec(db, `UPDATE timesheets SET clock_out = ?, hours = ? WHERE id = ?`, [
    now,
    Math.round(hours * 100) / 100,
    existing.id,
  ]);

  const timesheet = await queryOne<Timesheet>(db, `SELECT * FROM timesheets WHERE id = ?`, [
    existing.id,
  ]);
  return c.json({ timesheet });
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ timesheets: [] });
  const month = c.req.query("month") ?? nowIso().slice(0, 7);
  const timesheets = await queryAll<Timesheet>(
    c.env.DB,
    `SELECT * FROM timesheets WHERE employee_id = ? AND work_date ILIKE ? ORDER BY work_date DESC`,
    [auth.employeeId, `${month}%`],
  );
  return c.json({ timesheets });
});

app.get("/", requirePermission("attendance.team.view"), async (c) => {
  const auth = c.get("auth");
  const employeeId = c.req.query("employeeId");
  if (!employeeId) return c.json({ error: "employeeId is required" }, 400);
  const month = c.req.query("month") ?? nowIso().slice(0, 7);
  const timesheets = await queryAll<Timesheet>(
    c.env.DB,
    `SELECT * FROM timesheets WHERE tenant_id = ? AND employee_id = ? AND work_date ILIKE ? ORDER BY work_date DESC`,
    [auth.tenantId, employeeId, `${month}%`],
  );
  return c.json({ timesheets });
});

app.put("/:id", requirePermission("attendance.manage"), async (c) => {
  const body = (await c.req.json().catch(() => null)) as { remarks?: string } | null;
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const existing = await queryOne<Timesheet>(
    db,
    `SELECT * FROM timesheets WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);

  await exec(db, `UPDATE timesheets SET remarks = ? WHERE id = ?`, [
    body?.remarks ?? existing.remarks,
    id,
  ]);
  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "timesheet",
    recordId: id,
    action: "updated",
    actorUserId: auth.userId,
  });

  const timesheet = await queryOne<Timesheet>(db, `SELECT * FROM timesheets WHERE id = ?`, [id]);
  return c.json({ timesheet });
});

export default app;
