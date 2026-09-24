import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { RequestType } from "./types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const types = await queryAll<RequestType>(
    c.env.DB,
    `SELECT * FROM request_types WHERE tenant_id = ? AND is_active = 1 ORDER BY name`,
    [auth.tenantId],
  );
  return c.json({ requestTypes: types });
});

const requestTypeSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(500).optional().nullable(),
  requiresAmount: z.boolean().default(false),
  requiresAttachment: z.boolean().default(false),
});

app.post("/", requirePermission("requests.types.manage"), async (c) => {
  const body = requestTypeSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const d = body.data;
  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO request_types (id, tenant_id, name, description, requires_amount, requires_attachment)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.name, d.description ?? null, d.requiresAmount ? 1 : 0, d.requiresAttachment ? 1 : 0],
  );
  const requestType = await queryOne<RequestType>(c.env.DB, `SELECT * FROM request_types WHERE id = ?`, [id]);
  return c.json({ requestType }, 201);
});

app.put("/:id", requirePermission("requests.types.manage"), async (c) => {
  const body = requestTypeSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = c.req.param("id");
  const existing = await queryOne<RequestType>(
    c.env.DB,
    `SELECT * FROM request_types WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;
  await exec(
    c.env.DB,
    `UPDATE request_types SET name=?, description=?, requires_amount=?, requires_attachment=?, is_active=? WHERE id=? AND tenant_id=?`,
    [
      d.name ?? existing.name,
      d.description !== undefined ? d.description : existing.description,
      d.requiresAmount !== undefined ? (d.requiresAmount ? 1 : 0) : existing.requires_amount,
      d.requiresAttachment !== undefined ? (d.requiresAttachment ? 1 : 0) : existing.requires_attachment,
      d.isActive !== undefined ? (d.isActive ? 1 : 0) : existing.is_active,
      id,
      auth.tenantId,
    ],
  );
  const requestType = await queryOne<RequestType>(c.env.DB, `SELECT * FROM request_types WHERE id = ?`, [id]);
  return c.json({ requestType });
});

export default app;
