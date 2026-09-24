import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { JobPosting } from "./types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const isAdminOrHr = auth.role === "admin" || auth.role === "hr";
  const sql = isAdminOrHr
    ? `SELECT * FROM job_postings WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 300`
    : `SELECT * FROM job_postings WHERE tenant_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 300`;
  const postings = await queryAll<JobPosting>(c.env.DB, sql, [auth.tenantId]);
  return c.json({ postings });
});

app.get("/:id", async (c) => {
  const auth = c.get("auth");
  const posting = await queryOne<JobPosting>(c.env.DB, `SELECT * FROM job_postings WHERE id = ? AND tenant_id = ?`, [
    c.req.param("id"),
    auth.tenantId,
  ]);
  if (!posting) return c.json({ error: "Not found" }, 404);
  return c.json({ posting });
});

const postingSchema = z.object({
  title: z.string().min(1).max(200),
  department: z.string().max(120).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  closingDate: z.string().optional().nullable(),
});

app.post("/", requirePermission("recruitment.manage"), async (c) => {
  const body = postingSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const d = body.data;
  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO job_postings (id, tenant_id, title, department, description, closing_date) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.title, d.department ?? null, d.description ?? null, d.closingDate ?? null],
  );
  const posting = await queryOne<JobPosting>(c.env.DB, `SELECT * FROM job_postings WHERE id = ?`, [id]);
  return c.json({ posting }, 201);
});

app.put("/:id", requirePermission("recruitment.manage"), async (c) => {
  const body = postingSchema.partial().extend({ status: z.enum(["open", "closed"]).optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = c.req.param("id");
  const existing = await queryOne<JobPosting>(c.env.DB, `SELECT * FROM job_postings WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;
  await exec(
    c.env.DB,
    `UPDATE job_postings SET title=?, department=?, description=?, closing_date=?, status=? WHERE id=? AND tenant_id=?`,
    [
      d.title ?? existing.title,
      d.department !== undefined ? d.department : existing.department,
      d.description !== undefined ? d.description : existing.description,
      d.closingDate !== undefined ? d.closingDate : existing.closing_date,
      d.status ?? existing.status,
      id,
      auth.tenantId,
    ],
  );
  const posting = await queryOne<JobPosting>(c.env.DB, `SELECT * FROM job_postings WHERE id = ?`, [id]);
  return c.json({ posting });
});

export default app;
