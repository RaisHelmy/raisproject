import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

const SQLITE_MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../migrations");
// Real, drizzle-kit-generated Postgres migration set (post-cutover source of
// truth — see drizzle.config.postgres.ts). The old hand-written
// migrations/postgres/0000_init.pg.sql mirror is no longer read here; it
// predates the actual cutover and is superseded by this generated set.
const PG_MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../migrations_pg");

const EXPECTED_TABLES = [
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
].sort();

describe("dual-database migration harness", () => {
  it("applies every real D1/SQLite migration, in order, and creates every expected table", () => {
    const sqlite = new Database(":memory:");
    const migrationFiles = readdirSync(SQLITE_MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      sqlite.exec(
        readFileSync(path.join(SQLITE_MIGRATIONS_DIR, file), "utf-8").replaceAll(
          "--> statement-breakpoint",
          "",
        ),
      );
    }
    const tables = sqlite
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((r) => (r as { name: string }).name)
      .filter((n) => !n.startsWith("sqlite_"))
      .sort();
    expect(tables).toEqual(EXPECTED_TABLES);
    sqlite.close();
  });

  // Reachable via the SSH tunnel described in CLAUDE.md:
  //   ssh -L 15432:localhost:5432 helix@sshraisubuntu.raishelmy.uk
  // Defaults to that tunnel's local Postgres database so this runs
  // out-of-the-box in this repo's dev environment; override with
  // DATABASE_URL_PG (or DATABASE_URL) to point elsewhere. Still skipped,
  // not failed, when no Postgres instance is reachable at all (e.g. CI
  // without the tunnel).
  //
  // Shared-database note: `raishelmy` is now shared across every app, each
  // isolated into its own schema (this app's is `pantas`, see
  // src/db/client.ts). This test used to drop/recreate the `public` schema
  // to get a clean slate for a from-scratch migration run — on a shared
  // database that would risk clobbering another app's data, so it now uses
  // a disposable, uniquely-named scratch schema instead and drops only that.
  const pgUrl =
    process.env.DATABASE_URL_PG ??
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:15432/raishelmy";
  const SCRATCH_SCHEMA = "pantas_migration_test_scratch";

  async function pgReachable(url: string): Promise<boolean> {
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.end();
      return true;
    } catch {
      return false;
    }
  }

  it("applies every generated Postgres migration, in order, and creates every expected table", async (ctx) => {
    if (!(await pgReachable(pgUrl))) {
      ctx.skip();
      return;
    }
    const client = new Client({ connectionString: pgUrl });
    await client.connect();
    try {
      await client.query(`drop schema if exists ${SCRATCH_SCHEMA} cascade;`);
      await client.query(`create schema ${SCRATCH_SCHEMA};`);
      await client.query(`set search_path to ${SCRATCH_SCHEMA};`);
      const migrationFiles = readdirSync(PG_MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of migrationFiles) {
        const migrationSql = readFileSync(path.join(PG_MIGRATIONS_DIR, file), "utf-8");
        for (const statement of migrationSql.split("--> statement-breakpoint")) {
          const trimmed = statement.trim();
          if (trimmed) await client.query(trimmed);
        }
      }
      const result = await client.query<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = $1 order by table_name`,
        [SCRATCH_SCHEMA],
      );
      expect(result.rows.map((r) => r.table_name).sort()).toEqual(EXPECTED_TABLES);
    } finally {
      await client.query(`drop schema if exists ${SCRATCH_SCHEMA} cascade;`).catch(() => {});
      await client.end();
    }
  });
});
