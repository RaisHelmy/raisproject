import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne, recordAudit } from "../../core/db";
import { hashPassword } from "../../core/session";
import type { UserRow } from "../auth/types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const users = await queryAll<Omit<UserRow, "password_hash">>(
    c.env.DB,
    `SELECT id, tenant_id, email, name, role, is_active, created_at FROM users WHERE tenant_id = ? ORDER BY created_at`,
    [auth.tenantId],
  );
  return c.json({ users });
});

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "hr", "manager", "employee"]),
  employeeId: z.string().optional().nullable(),
});

app.post("/", async (c) => {
  const body = createUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;

  const existing = await queryOne(db, `SELECT id FROM users WHERE email = ?`, [
    d.email.toLowerCase(),
  ]);
  if (existing) return c.json({ error: "An account with this email already exists" }, 409);

  const id = newId();
  const passwordHash = await hashPassword(d.password);
  await exec(
    db,
    `INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.email.toLowerCase(), passwordHash, d.name, d.role],
  );

  if (d.employeeId) {
    await exec(db, `UPDATE employees SET user_id = ? WHERE id = ? AND tenant_id = ?`, [
      id,
      d.employeeId,
      auth.tenantId,
    ]);
  }

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "user",
    recordId: id,
    action: "created",
    actorUserId: auth.userId,
    remarks: `User "${d.name}" (${d.email}) created with role ${d.role}`,
  });

  return c.json({ user: { id, name: d.name, email: d.email.toLowerCase(), role: d.role } }, 201);
});

const updateUserSchema = z.object({
  role: z.enum(["admin", "hr", "manager", "employee"]).optional(),
  isActive: z.boolean().optional(),
});

app.put("/:id", async (c) => {
  const body = updateUserSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const existing = await queryOne<UserRow>(
    db,
    `SELECT * FROM users WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);

  await exec(db, `UPDATE users SET role = ?, is_active = ? WHERE id = ?`, [
    body.data.role ?? existing.role,
    body.data.isActive !== undefined ? (body.data.isActive ? 1 : 0) : existing.is_active,
    id,
  ]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "user",
    recordId: id,
    action: "updated",
    actorUserId: auth.userId,
  });

  return c.json({ ok: true });
});

export default app;
