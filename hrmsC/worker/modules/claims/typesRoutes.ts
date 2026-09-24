import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { ClaimType } from "./types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const types = await queryAll<ClaimType>(
    c.env.DB,
    `SELECT * FROM claim_types WHERE tenant_id = ? AND is_active = 1 ORDER BY name`,
    [auth.tenantId],
  );
  return c.json({ claimTypes: types });
});

const claimTypeSchema = z.object({
  name: z.string().min(1).max(160),
  isMileage: z.boolean().default(false),
  mileageRate: z.number().positive().optional().nullable(),
  isAdvance: z.boolean().default(false),
  requiresAttachment: z.boolean().default(false),
});

app.post("/", requirePermission("claims.types.manage"), async (c) => {
  const body = claimTypeSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const d = body.data;
  if (d.isMileage && !d.mileageRate) return c.json({ error: "Mileage types need a rate" }, 400);

  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO claim_types (id, tenant_id, name, is_mileage, mileage_rate, is_advance, requires_attachment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.name, d.isMileage ? 1 : 0, d.mileageRate ?? null, d.isAdvance ? 1 : 0, d.requiresAttachment ? 1 : 0],
  );
  const claimType = await queryOne<ClaimType>(c.env.DB, `SELECT * FROM claim_types WHERE id = ?`, [id]);
  return c.json({ claimType }, 201);
});

app.put("/:id", requirePermission("claims.types.manage"), async (c) => {
  const body = claimTypeSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = c.req.param("id");
  const existing = await queryOne<ClaimType>(c.env.DB, `SELECT * FROM claim_types WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;
  await exec(
    c.env.DB,
    `UPDATE claim_types SET name=?, is_mileage=?, mileage_rate=?, is_advance=?, requires_attachment=?, is_active=? WHERE id=? AND tenant_id=?`,
    [
      d.name ?? existing.name,
      d.isMileage !== undefined ? (d.isMileage ? 1 : 0) : existing.is_mileage,
      d.mileageRate !== undefined ? d.mileageRate : existing.mileage_rate,
      d.isAdvance !== undefined ? (d.isAdvance ? 1 : 0) : existing.is_advance,
      d.requiresAttachment !== undefined ? (d.requiresAttachment ? 1 : 0) : existing.requires_attachment,
      d.isActive !== undefined ? (d.isActive ? 1 : 0) : existing.is_active,
      id,
      auth.tenantId,
    ],
  );
  const claimType = await queryOne<ClaimType>(c.env.DB, `SELECT * FROM claim_types WHERE id = ?`, [id]);
  return c.json({ claimType });
});

export default app;
