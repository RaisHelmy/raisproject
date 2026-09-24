import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../src/db/schema";
import type { Db } from "../../src/db/client";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../migrations_pg");

/**
 * Postgres cutover note: this replaces tests/support/sqliteTestDb.ts (kept
 * only in git history, see the migration summary). Repository-layer tests
 * now run against the real Postgres path — same schema.ts, same
 * drizzle-orm/postgres-js driver as production, reached through the same
 * SSH tunnel described in CLAUDE.md for local drizzle-kit use:
 *   ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk
 *
 * DATABASE_URL (or DATABASE_URL_PG) must point at that tunnel, e.g.
 *   postgresql://postgres:postgres@localhost:15432/raishelmy
 * A real Postgres instance is therefore required to run this suite — there
 * is no more in-memory fallback, since the schema is Postgres-only
 * (drizzle-orm/pg-core) post-migration.
 *
 * Shared-database note: this app no longer has its own dedicated database —
 * it shares the `raishelmy` Postgres instance with every other app, isolated
 * into the `pantas` Postgres SCHEMA (see src/db/client.ts). Tests therefore
 * connect with `search_path` pinned to `pantas` so unqualified table names
 * (from plain `pgTable(...)` calls in schema.ts) resolve there instead of
 * `public`, and migrate/truncate operate against `pantas`'s tables only —
 * never touching `public` or any other app's schema in the shared database.
 */
const TEST_DATABASE_URL =
  process.env.DATABASE_URL_PG ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:15432/raishelmy";

const TEST_SCHEMA = "pantas";

let sqlClient: ReturnType<typeof postgres> | undefined;
let migrated = false;

function client() {
  if (!sqlClient) {
    // The remote Postgres server presents a cert for its real VPC hostname
    // (pg2-vpc.raishelmy.uk), which won't match "localhost" through the SSH
    // tunnel — rejectUnauthorized: false accepts the (still encrypted)
    // connection without hostname/CA verification, appropriate for this
    // dev/test-only tunnel path. Production traffic never takes this path;
    // it goes through the HYPERDRIVE binding instead (see src/db/client.ts).
    sqlClient = postgres(TEST_DATABASE_URL, {
      max: 1,
      ssl: { rejectUnauthorized: false },
      connection: { search_path: TEST_SCHEMA },
    });
  }
  return sqlClient;
}

async function ensureMigrated() {
  if (migrated) return;
  const sql = client();
  // The `pantas` schema and its tables already exist from the D1 -> Postgres
  // dump/restore, so this is a no-op in practice — but it's kept (and safe
  // to re-run) because every generated migration uses
  // `CREATE TABLE IF NOT EXISTS`, and search_path above ensures it targets
  // `pantas` rather than `public`.
  await sql.unsafe(`create schema if not exists ${TEST_SCHEMA}`);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const migrationSql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    for (const statement of migrationSql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) await sql.unsafe(trimmed);
    }
  }
  migrated = true;
}

const ALL_TABLES = [
  "audit_log",
  "commission_rules",
  "group_members",
  "groups",
  "job_offers",
  "job_pool_legs",
  "jobs",
  "ledger_entries",
  "non_payment_incidents",
  "payout_batches",
  "perk_rules",
  "products",
  "ratings",
  "ride_schedules",
  "sos_incidents",
  "user_roles",
  "users",
  "vehicle_rental_bookings",
  "vehicle_rental_listings",
  "vehicles",
  "vendor_contract_offers",
  "vendor_contracts",
  "vendors",
];

/**
 * Fresh Postgres test database: migrates once per test process, then
 * truncates every table before each call so tests remain isolated the same
 * way createSqliteTestDb()'s fresh :memory: database used to be — just
 * against a real, shared Postgres instance instead of a new file each time.
 */
export async function createPgTestDb(): Promise<Db> {
  await ensureMigrated();
  const sql = client();
  await sql.unsafe(`truncate table ${ALL_TABLES.join(", ")} restart identity cascade`);
  return drizzle(sql, { schema });
}
