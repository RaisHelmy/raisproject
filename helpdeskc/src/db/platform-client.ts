import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, isNull, ne } from "drizzle-orm";
import * as schema from "./schema";

/**
 * The only sanctioned uses of a non-tenant-scoped client: platform-level
 * operations that are inherently cross-tenant (creating a tenant, resolving
 * Host -> tenant, platform admin auth). Nothing here returns tenant-owned
 * rows (tickets, contacts, etc.) — those always go through tenantDb().
 *
 * Migrated from D1 to Postgres via Hyperdrive — see src/db/client.ts for the
 * rationale on constructing a fresh postgres.js client per call.
 */
export function platformDb(hyperdrive: Hyperdrive) {
  // Shared `raishelmy` Postgres database, this app isolated into schema
  // `helpdeskc`. Tables are schema-qualified directly in src/db/schema/
  // (via `_schema.ts`'s `pgSchema("helpdeskc")`) rather than relying on
  // `search_path` — Hyperdrive pools connections at the transaction/
  // statement level and doesn't preserve session state like search_path
  // across statements.
  const sql_ = postgres(hyperdrive.connectionString, { max: 5 });
  const db = drizzle(sql_, { schema });

  return {
    tenants: {
      async getBySlug(slug: string) {
        const rows = await db.select().from(schema.tenants).where(and(eq(schema.tenants.slug, slug), isNull(schema.tenants.deletedAt))).limit(1);
        return rows[0] ?? null;
      },
      /**
       * For cron jobs that must iterate every tenant (CLAUDE.md §10) — each
       * iteration still queries through tenantDb(), scoped per tenant.
       * Excludes only cancelled tenants; trial/past_due/suspended tenants
       * keep their SLA clocks and auto-close running since CLAUDE.md §12
       * says suspension must never delete or freeze data silently.
       */
      async listNonCancelledIds() {
        const rows = await db.select({ id: schema.tenants.id }).from(schema.tenants).where(and(isNull(schema.tenants.deletedAt), ne(schema.tenants.billingState, "cancelled")));
        return rows.map((r) => r.id);
      },
      async getById(id: string) {
        const rows = await db.select().from(schema.tenants).where(and(eq(schema.tenants.id, id), isNull(schema.tenants.deletedAt))).limit(1);
        return rows[0] ?? null;
      },
      /**
       * Also seeds the tenant_usage row so later increments can always
       * UPDATE, never upsert. D1 had no interactive transactions (CLAUDE.md
       * §4), so this used `db.batch()`; Postgres supports real transactions,
       * so this now runs both inserts atomically via `db.transaction()`
       * instead — strictly stronger than the D1 batch it replaces.
       */
      async create(values: typeof schema.tenants.$inferInsert) {
        await db.transaction(async (tx) => {
          await tx.insert(schema.tenants).values(values);
          await tx.insert(schema.tenantUsage).values({
            tenantId: values.id,
            attachmentBytesTotal: 0,
            ticketCountTotal: 0,
            updatedAt: values.createdAt,
          });
        });
      },
    },
    domains: {
      async findActiveByHostname(hostname: string) {
        const rows = await db.select().from(schema.domains).where(and(eq(schema.domains.hostname, hostname), eq(schema.domains.status, "active"), isNull(schema.domains.deletedAt))).limit(1);
        return rows[0] ?? null;
      },
      /** Called on custom domain removal — the caller must also purge the KV mapping immediately (CLAUDE.md §6.6). */
      async remove(id: string) {
        await db.update(schema.domains).set({ deletedAt: new Date().toISOString() }).where(eq(schema.domains.id, id));
      },
    },
    plans: {
      async list() {
        return db.select().from(schema.plans);
      },
    },
    platformAdmins: {
      async findByEmail(email: string) {
        const rows = await db.select().from(schema.platformAdmins).where(and(eq(schema.platformAdmins.email, email), isNull(schema.platformAdmins.deletedAt))).limit(1);
        return rows[0] ?? null;
      },
    },
    auditLog: {
      async record(values: typeof schema.auditLog.$inferInsert) {
        await db.insert(schema.auditLog).values(values);
      },
    },
  };
}

export type PlatformDb = ReturnType<typeof platformDb>;
