import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne } from "../../core/db";
import { requirePermission } from "../../core/middleware";
import type { LeaveType } from "./types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const types = await queryAll<LeaveType>(
    c.env.DB,
    `SELECT * FROM leave_types WHERE tenant_id = ? AND is_active = 1 ORDER BY name`,
    [auth.tenantId],
  );
  return c.json({ leaveTypes: types });
});

const leaveTypeSchema = z.object({
  name: z.string().min(1).max(120),
  defaultEntitlementDays: z.number().min(0).max(365),
  requiresAttachment: z.boolean().default(false),
});

app.post("/", requirePermission("leave.types.manage"), async (c) => {
  const body = leaveTypeSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = newId();
  await exec(
    c.env.DB,
    `INSERT INTO leave_types (id, tenant_id, name, default_entitlement_days, requires_attachment)
     VALUES (?, ?, ?, ?, ?)`,
    [id, auth.tenantId, body.data.name, body.data.defaultEntitlementDays, body.data.requiresAttachment ? 1 : 0],
  );
  const leaveType = await queryOne<LeaveType>(c.env.DB, `SELECT * FROM leave_types WHERE id = ?`, [id]);
  return c.json({ leaveType }, 201);
});

app.put("/:id", requirePermission("leave.types.manage"), async (c) => {
  const body = leaveTypeSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const id = c.req.param("id");
  const existing = await queryOne<LeaveType>(
    c.env.DB,
    `SELECT * FROM leave_types WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;
  await exec(
    c.env.DB,
    `UPDATE leave_types SET name=?, default_entitlement_days=?, requires_attachment=?, is_active=? WHERE id=? AND tenant_id=?`,
    [
      d.name ?? existing.name,
      d.defaultEntitlementDays ?? existing.default_entitlement_days,
      d.requiresAttachment !== undefined ? (d.requiresAttachment ? 1 : 0) : existing.requires_attachment,
      d.isActive !== undefined ? (d.isActive ? 1 : 0) : existing.is_active,
      id,
      auth.tenantId,
    ],
  );
  const leaveType = await queryOne<LeaveType>(c.env.DB, `SELECT * FROM leave_types WHERE id = ?`, [id]);
  return c.json({ leaveType });
});

export default app;
