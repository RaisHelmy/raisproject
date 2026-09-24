import type { Role, User } from "../../shared/types";
import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export async function createUser(
  db: AppDatabase,
  tenantId: string,
  input: { email: string; passwordHash: string; name: string },
): Promise<User> {
  const id = newId();
  const created_at = now();
  await db
    .prepare(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    )
    .bind(id, tenantId, input.email.toLowerCase(), input.passwordHash, input.name, created_at)
    .run();
  return { id, tenant_id: tenantId, email: input.email.toLowerCase(), name: input.name, status: "active", created_at };
}

export async function getUserByEmail(
  db: AppDatabase,
  tenantId: string,
  email: string,
): Promise<(User & { password_hash: string }) | null> {
  const row = await db
    .prepare(`SELECT * FROM users WHERE tenant_id = ? AND email = ?`)
    .bind(tenantId, email.toLowerCase())
    .first<User & { password_hash: string }>();
  return row ?? null;
}

export async function getUserById(
  db: AppDatabase,
  tenantId: string,
  userId: string,
): Promise<User | null> {
  const row = await db
    .prepare(
      `SELECT id, tenant_id, email, name, status, created_at FROM users WHERE tenant_id = ? AND id = ?`,
    )
    .bind(tenantId, userId)
    .first<User>();
  return row ?? null;
}

export async function assignRole(
  db: AppDatabase,
  tenantId: string,
  input: { userId: string; outletId: string; role: Role },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_outlet_roles (id, tenant_id, user_id, outlet_id, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (tenant_id, user_id, outlet_id) DO UPDATE SET role = excluded.role`,
    )
    .bind(newId(), tenantId, input.userId, input.outletId, input.role, now())
    .run();
}

export async function revokeRole(
  db: AppDatabase,
  tenantId: string,
  input: { userId: string; outletId: string },
): Promise<void> {
  await db
    .prepare(`DELETE FROM user_outlet_roles WHERE tenant_id = ? AND user_id = ? AND outlet_id = ?`)
    .bind(tenantId, input.userId, input.outletId)
    .run();
}

export async function getRolesForUser(
  db: AppDatabase,
  tenantId: string,
  userId: string,
): Promise<Record<string, Role>> {
  const { results } = await db
    .prepare(`SELECT outlet_id, role FROM user_outlet_roles WHERE tenant_id = ? AND user_id = ?`)
    .bind(tenantId, userId)
    .all<{ outlet_id: string; role: Role }>();
  const map: Record<string, Role> = {};
  for (const r of results ?? []) map[r.outlet_id] = r.role;
  return map;
}

export async function listUsersWithRoles(
  db: AppDatabase,
  tenantId: string,
): Promise<Array<User & { roles: Record<string, Role> }>> {
  const { results: users } = await db
    .prepare(
      `SELECT id, tenant_id, email, name, status, created_at FROM users WHERE tenant_id = ? ORDER BY created_at ASC`,
    )
    .bind(tenantId)
    .all<User>();
  const { results: roles } = await db
    .prepare(`SELECT user_id, outlet_id, role FROM user_outlet_roles WHERE tenant_id = ?`)
    .bind(tenantId)
    .all<{ user_id: string; outlet_id: string; role: Role }>();

  return (users ?? []).map((u) => ({
    ...u,
    roles: Object.fromEntries((roles ?? []).filter((r) => r.user_id === u.id).map((r) => [r.outlet_id, r.role])),
  }));
}

export async function setUserStatus(
  db: AppDatabase,
  tenantId: string,
  userId: string,
  status: "active" | "disabled",
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE users SET status = ? WHERE tenant_id = ? AND id = ?`)
    .bind(status, tenantId, userId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
