import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { JobApplication, JobPosting } from "./types";

const app = new Hono<AppEnv>();

app.post("/", async (c) => {
  const body = z.object({ postingId: z.string().min(1), coverNote: z.string().max(2000).optional().nullable() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 400);
  const db = c.env.DB;

  const posting = await queryOne<JobPosting>(db, `SELECT * FROM job_postings WHERE id = ? AND tenant_id = ?`, [
    body.data.postingId,
    auth.tenantId,
  ]);
  if (!posting) return c.json({ error: "Unknown job posting" }, 400);
  if (posting.status !== "open") return c.json({ error: "This posting is closed" }, 400);

  const already = await queryOne(
    db,
    `SELECT id FROM job_applications WHERE posting_id = ? AND employee_id = ? AND status != 'withdrawn'`,
    [posting.id, auth.employeeId],
  );
  if (already) return c.json({ error: "You already applied to this posting" }, 409);

  const id = newId();
  await exec(db, `INSERT INTO job_applications (id, tenant_id, posting_id, employee_id, cover_note) VALUES (?, ?, ?, ?, ?)`, [
    id,
    auth.tenantId,
    posting.id,
    auth.employeeId,
    body.data.coverNote ?? null,
  ]);
  await recordAudit(db, { tenantId: auth.tenantId, module: "job_application", recordId: id, action: "submitted", actorUserId: auth.userId, remarks: posting.title });

  const application = await queryOne<JobApplication>(db, `SELECT * FROM job_applications WHERE id = ?`, [id]);
  return c.json({ application }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ applications: [] });
  const applications = await queryAll(
    c.env.DB,
    `SELECT ja.*, jp.title as posting_title, jp.department
     FROM job_applications ja JOIN job_postings jp ON jp.id = ja.posting_id
     WHERE ja.tenant_id = ? AND ja.employee_id = ? ORDER BY ja.applied_at DESC LIMIT 200`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ applications });
});

app.get("/", requirePermission("recruitment.manage"), async (c) => {
  const auth = c.get("auth");
  const postingId = c.req.query("postingId");
  let sql = `SELECT ja.*, jp.title as posting_title, e.full_name as employee_name, e.employee_no
             FROM job_applications ja
             JOIN job_postings jp ON jp.id = ja.posting_id
             JOIN employees e ON e.id = ja.employee_id
             WHERE ja.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (postingId) {
    sql += ` AND ja.posting_id = ?`;
    params.push(postingId);
  }
  sql += ` ORDER BY ja.applied_at DESC LIMIT 300`;
  const applications = await queryAll(c.env.DB, sql, params);
  return c.json({ applications });
});

app.patch("/:id/status", requirePermission("recruitment.manage"), async (c) => {
  const body = z.object({ status: z.enum(["submitted", "screening", "interview", "offered", "rejected", "hired"]) }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const application = await queryOne<JobApplication>(db, `SELECT * FROM job_applications WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!application) return c.json({ error: "Not found" }, 404);
  if (application.status === "withdrawn") return c.json({ error: "This application was withdrawn" }, 400);

  await exec(db, `UPDATE job_applications SET status=?, updated_at=? WHERE id=?`, [body.data.status, nowIso(), id]);
  await recordAudit(db, { tenantId: auth.tenantId, module: "job_application", recordId: id, action: `status_${body.data.status}`, actorUserId: auth.userId });

  const updated = await queryOne<JobApplication>(db, `SELECT * FROM job_applications WHERE id = ?`, [id]);
  return c.json({ application: updated });
});

app.post("/:id/withdraw", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const application = await queryOne<JobApplication>(db, `SELECT * FROM job_applications WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!application) return c.json({ error: "Not found" }, 404);
  if (application.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (application.status === "hired" || application.status === "rejected") {
    return c.json({ error: "This application has already been finalized" }, 400);
  }

  await exec(db, `UPDATE job_applications SET status='withdrawn', updated_at=? WHERE id=?`, [nowIso(), id]);
  await recordAudit(db, { tenantId: auth.tenantId, module: "job_application", recordId: id, action: "withdrawn", actorUserId: auth.userId });

  const updated = await queryOne<JobApplication>(db, `SELECT * FROM job_applications WHERE id = ?`, [id]);
  return c.json({ application: updated });
});

export default app;
