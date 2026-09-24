import type { Tenant } from "../../shared/types";
import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export async function createTenant(
  db: AppDatabase,
  input: { name: string; slug: string },
): Promise<Tenant> {
  const tenant: Tenant = {
    id: newId(),
    name: input.name,
    slug: input.slug,
    plan: "trial",
    status: "active",
    created_at: now(),
  };
  await db
    .prepare(
      `INSERT INTO tenants (id, name, slug, plan, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(tenant.id, tenant.name, tenant.slug, tenant.plan, tenant.status, tenant.created_at)
    .run();
  return tenant;
}

export async function getTenantBySlug(db: AppDatabase, slug: string): Promise<Tenant | null> {
  const row = await db.prepare(`SELECT * FROM tenants WHERE slug = ?`).bind(slug).first<Tenant>();
  return row ?? null;
}

export async function getTenantById(db: AppDatabase, id: string): Promise<Tenant | null> {
  const row = await db.prepare(`SELECT * FROM tenants WHERE id = ?`).bind(id).first<Tenant>();
  return row ?? null;
}

/** Used only by system/cron jobs that must run across every tenant. */
export async function listActiveTenants(db: AppDatabase): Promise<Tenant[]> {
  const { results } = await db.prepare(`SELECT * FROM tenants WHERE status = 'active'`).all<Tenant>();
  return results ?? [];
}
