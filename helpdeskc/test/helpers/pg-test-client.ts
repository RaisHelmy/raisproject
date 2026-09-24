import postgres from "postgres";

// Postgres-backed replacement for the old d1-shim.ts (bun:sqlite is no
// longer the storage engine — see CLAUDE.md §4, D1 -> Postgres migration).
// Runs the real src/db/client.ts / platform-client.ts query logic against
// the actual Postgres database (reached through the SSH tunnel documented
// in .dev.vars), rather than an in-memory simulation, since postgres.js has
// no in-memory driver. d1-shim.ts is left in place, unused, alongside the
// old sqlite migrations dir — nothing here deletes either.
//
// The database is now the shared `raishelmy` Postgres instance, with this
// app's 28 tables isolated into schema `helpdeskc`. Other apps' schemas
// live in the SAME database, so every connection here pins
// search_path=helpdeskc (tenantDb()/platformDb() already do this
// themselves via hyperdrive.connectionString — this file's own direct
// `postgres()` client for resetTestDb() needs the same pin) and the
// TRUNCATE below is schema-qualified so it can never touch another app's
// tables even if a name collides.

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Tenant-isolation tests need a real Postgres " +
      "connection — open the SSH tunnel (see .dev.vars) and set " +
      "DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raishelmy?sslmode=require",
  );
}

/** Cast to Hyperdrive — tenantDb()/platformDb() only ever read `.connectionString`. */
export function createTestHyperdrive(): Hyperdrive {
  return { connectionString: DATABASE_URL } as unknown as Hyperdrive;
}

// Tables in FK-safe TRUNCATE order (children before/with parents — CASCADE
// covers the rest, RESTART IDENTITY is irrelevant since every id is a
// UUIDv7 TEXT column, never a serial).
const ALL_TABLES = [
  "attachments",
  "ticket_field_values",
  "ticket_events",
  "ticket_messages",
  "tickets",
  "automation_rules",
  "sla_policies",
  "template_versions",
  "templates",
  "magic_link_tokens",
  "sessions",
  "agent_team_assignments",
  "agent_invites",
  "memberships",
  "roles",
  "agents",
  "contact_email_changes",
  "contacts",
  "teams",
  "accounts",
  "domains",
  "tenant_usage",
  "tenants",
  "invoices",
  "audit_log",
  "platform_config",
  "platform_admins",
  "plans",
];

/** Wipes every table between tests so isolation assertions never see a previous run's rows. */
export async function resetTestDb(): Promise<void> {
  const sql = postgres(DATABASE_URL!, { max: 1, connection: { search_path: "helpdeskc" } });
  try {
    // Schema-qualified so this can only ever touch helpdeskc's own tables,
    // never another app's schema in the shared `raishelmy` database — even
    // if search_path were somehow wrong, or another schema has a
    // same-named table.
    const qualified = ALL_TABLES.map((table) => `helpdeskc.${table}`).join(", ");
    await sql.unsafe(`TRUNCATE TABLE ${qualified} CASCADE`);
  } finally {
    await sql.end();
  }
}
