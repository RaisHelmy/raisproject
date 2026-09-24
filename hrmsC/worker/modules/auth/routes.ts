import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { queryOne } from "../../core/db";
import { clearSession, issueSession, verifyPassword } from "../../core/session";
import { requireAuth } from "../../core/middleware";
import { resolveAllPermissions } from "../../core/permissions";
import { provisionTenant } from "./service";
import ssoRoutes from "./sso";
import type { Tenant, UserRow } from "./types";

const app = new Hono<AppEnv>();

// GET /api/auth/sso?token=... — super-admin SSO from the suite landing page.
app.route("/", ssoRoutes);

const registerSchema = z.object({
  tenantName: z.string().min(2).max(120),
  adminName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

app.post("/register-tenant", async (c) => {
  const body = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  }
  const { tenantName, adminName, email, password } = body.data;
  const db = c.env.DB;

  const existing = await queryOne<UserRow>(db, `SELECT id FROM users WHERE email = ?`, [
    email.toLowerCase(),
  ]);
  if (existing) {
    return c.json({ error: "An account with this email already exists" }, 409);
  }

  const provisioned = await provisionTenant(db, { tenantName, adminName, email, password });

  await issueSession(c, {
    sub: provisioned.userId,
    tenantId: provisioned.tenantId,
    role: "admin",
    employeeId: provisioned.employeeId,
    email: email.toLowerCase(),
    name: adminName,
  });

  return c.json({
    tenant: { id: provisioned.tenantId, name: tenantName, slug: provisioned.slug },
    user: { id: provisioned.userId, name: adminName, email: email.toLowerCase(), role: "admin" },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post("/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: "Invalid input" }, 400);
  }
  const { email, password } = body.data;
  const db = c.env.DB;

  const user = await queryOne<UserRow>(db, `SELECT * FROM users WHERE email = ?`, [
    email.toLowerCase(),
  ]);
  if (!user || !user.is_active) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const employee = await queryOne<{ id: string }>(
    db,
    `SELECT id FROM employees WHERE user_id = ?`,
    [user.id],
  );

  await issueSession(c, {
    sub: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    employeeId: employee?.id ?? null,
    email: user.email,
    name: user.name,
  });

  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

app.post("/logout", (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

app.get("/me", requireAuth, async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const tenant = await queryOne<Tenant>(db, `SELECT * FROM tenants WHERE id = ?`, [
    auth.tenantId,
  ]);
  const permissions = await resolveAllPermissions(db, auth.tenantId, auth.role);
  return c.json({ auth, tenant, permissions });
});

export default app;
