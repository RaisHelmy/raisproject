import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { UniformItem } from "./types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const items = await queryAll<UniformItem>(
    c.env.DB,
    `SELECT * FROM uniform_items WHERE tenant_id = ? AND is_active = 1 ORDER BY name`,
    [auth.tenantId],
  );
  return c.json({ items });
});

const itemSchema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().max(120).optional().nullable(),
  availableSizes: z.array(z.string().min(1).max(20)).min(1),
});

app.post("/", requirePermission("uniform.manage"), async (c) => {
  const body = itemSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const d = body.data;
  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO uniform_items (id, tenant_id, name, category, available_sizes) VALUES (?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.name, d.category ?? null, d.availableSizes.join(",")],
  );
  const item = await queryOne<UniformItem>(c.env.DB, `SELECT * FROM uniform_items WHERE id = ?`, [id]);
  return c.json({ item }, 201);
});

app.put("/:id", requirePermission("uniform.manage"), async (c) => {
  const body = itemSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = c.req.param("id");
  const existing = await queryOne<UniformItem>(c.env.DB, `SELECT * FROM uniform_items WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;
  await exec(
    c.env.DB,
    `UPDATE uniform_items SET name=?, category=?, available_sizes=?, is_active=? WHERE id=? AND tenant_id=?`,
    [
      d.name ?? existing.name,
      d.category !== undefined ? d.category : existing.category,
      d.availableSizes ? d.availableSizes.join(",") : existing.available_sizes,
      d.isActive !== undefined ? (d.isActive ? 1 : 0) : existing.is_active,
      id,
      auth.tenantId,
    ],
  );
  const item = await queryOne<UniformItem>(c.env.DB, `SELECT * FROM uniform_items WHERE id = ?`, [id]);
  return c.json({ item });
});

export default app;
