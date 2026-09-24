import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, recordAudit } from "../../core/db";
import { PERMISSIONS, resolveAllPermissions, PERMISSION_KEYS } from "../../core/permissions";

const app = new Hono<AppEnv>();

const CONFIGURABLE_ROLES = ["hr", "manager", "employee"] as const;

app.get("/", async (c) => {
  const auth = c.get("auth");
  const grants: Record<string, Record<string, boolean>> = {};
  for (const role of CONFIGURABLE_ROLES) {
    grants[role] = await resolveAllPermissions(c.env.DB, auth.tenantId, role);
  }
  return c.json({ catalog: PERMISSIONS, grants });
});

const updateSchema = z.object({
  role: z.enum(CONFIGURABLE_ROLES),
  permissionKey: z.enum(PERMISSION_KEYS),
  granted: z.boolean(),
});

app.put("/", async (c) => {
  const body = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const { role, permissionKey, granted } = body.data;

  await exec(
    db,
    `INSERT INTO role_permissions (id, tenant_id, role, permission_key, granted)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, role, permission_key) DO UPDATE SET granted = excluded.granted, updated_at = now()::text`,
    [newId(), auth.tenantId, role, permissionKey, granted ? 1 : 0],
  );

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "role_permission",
    recordId: `${role}:${permissionKey}`,
    action: granted ? "granted" : "revoked",
    actorUserId: auth.userId,
    remarks: `${role} → ${permissionKey}`,
  });

  return c.json({ ok: true });
});

app.delete("/:role/:key", async (c) => {
  const auth = c.get("auth");
  const role = c.req.param("role");
  const key = c.req.param("key");
  if (!CONFIGURABLE_ROLES.includes(role as (typeof CONFIGURABLE_ROLES)[number])) {
    return c.json({ error: "Invalid role" }, 400);
  }
  await exec(c.env.DB, `DELETE FROM role_permissions WHERE tenant_id = ? AND role = ? AND permission_key = ?`, [
    auth.tenantId,
    role,
    key,
  ]);
  await recordAudit(c.env.DB, {
    tenantId: auth.tenantId,
    module: "role_permission",
    recordId: `${role}:${key}`,
    action: "reset_to_default",
    actorUserId: auth.userId,
  });
  return c.json({ ok: true });
});

export default app;
