import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { TrainingProgram } from "./types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const programs = await queryAll<TrainingProgram>(
    c.env.DB,
    `SELECT * FROM training_programs WHERE tenant_id = ? ORDER BY start_date DESC, created_at DESC LIMIT 300`,
    [auth.tenantId],
  );
  return c.json({ programs });
});

app.get("/:id", async (c) => {
  const auth = c.get("auth");
  const program = await queryOne<TrainingProgram>(
    c.env.DB,
    `SELECT * FROM training_programs WHERE id = ? AND tenant_id = ?`,
    [c.req.param("id"), auth.tenantId],
  );
  if (!program) return c.json({ error: "Not found" }, 404);
  return c.json({ program });
});

const programSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
});

app.post("/", requirePermission("training.manage"), async (c) => {
  const body = programSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const d = body.data;
  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO training_programs (id, tenant_id, title, description, category, start_date, end_date, location, capacity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.title, d.description ?? null, d.category ?? null, d.startDate ?? null, d.endDate ?? null, d.location ?? null, d.capacity ?? null],
  );
  const program = await queryOne<TrainingProgram>(c.env.DB, `SELECT * FROM training_programs WHERE id = ?`, [id]);
  return c.json({ program }, 201);
});

app.put("/:id", requirePermission("training.manage"), async (c) => {
  const body = programSchema.partial().extend({ status: z.enum(["open", "closed", "cancelled"]).optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = c.req.param("id");
  const existing = await queryOne<TrainingProgram>(
    c.env.DB,
    `SELECT * FROM training_programs WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;
  await exec(
    c.env.DB,
    `UPDATE training_programs SET title=?, description=?, category=?, start_date=?, end_date=?, location=?, capacity=?, status=? WHERE id=? AND tenant_id=?`,
    [
      d.title ?? existing.title,
      d.description !== undefined ? d.description : existing.description,
      d.category !== undefined ? d.category : existing.category,
      d.startDate !== undefined ? d.startDate : existing.start_date,
      d.endDate !== undefined ? d.endDate : existing.end_date,
      d.location !== undefined ? d.location : existing.location,
      d.capacity !== undefined ? d.capacity : existing.capacity,
      d.status ?? existing.status,
      id,
      auth.tenantId,
    ],
  );
  const program = await queryOne<TrainingProgram>(c.env.DB, `SELECT * FROM training_programs WHERE id = ?`, [id]);
  return c.json({ program });
});

export default app;
