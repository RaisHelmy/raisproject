import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Repositories are written against this dialect-generic type so the same
 * repository functions in src/db/repositories/* can run unmodified against
 * both the real Hyperdrive-backed Postgres connection in the Worker and a
 * directly-tunnelled Postgres connection in tests (see
 * tests/support/pgTestDb.ts). That's what makes the "repository layer, dual
 * environment test harness" combination in CLAUDE.md's build order actually
 * mean something: the code under test is the same code that runs in the
 * Worker, not a parallel test-only implementation.
 */
export type Db = PostgresJsDatabase<typeof schema>;

/**
 * Postgres migration note: this project moved off D1/SQLite onto Postgres
 * via Cloudflare Hyperdrive. `env.HYPERDRIVE.connectionString` is populated
 * by the Workers runtime from the `hyperdrive` binding in wrangler.jsonc —
 * no host/port/credentials are configured here directly. `max: 5` keeps the
 * connection pool small since each Worker invocation is short-lived and
 * Hyperdrive itself pools connections to the origin database.
 *
 * Shared-database note: as of the second migration, there is only one
 * Hyperdrive config / one Postgres database (`raishelmy`) for the whole
 * account, shared across apps. This app's tables live in their own Postgres
 * SCHEMA within that database — `pantas` for production/dev, `pantas_staging`
 * for the staging environment (see wrangler.jsonc `env.staging.vars.ENVIRONMENT`).
 * `connection.search_path` tells postgres.js which schema unqualified table
 * names (as used by plain `pgTable(...)` in schema.ts) should resolve
 * against, without needing schema-qualified table names anywhere in the app.
 */
export function pgSchemaFor(environment: string | undefined): "pantas" | "pantas_staging" {
  return environment === "staging" ? "pantas_staging" : "pantas";
}

export async function createDb(env: Pick<Env, "HYPERDRIVE" | "ENVIRONMENT">): Promise<Db> {
  // Hyperdrive pools connections at the transaction/statement level and does
  // not preserve session state like `search_path` (as a startup parameter
  // or via `SET`) across statements. Table references are schema-qualified
  // directly in schema.ts (see `pantasSchema` there) instead, so no
  // search_path handling is needed here.
  const sql = postgres(env.HYPERDRIVE.connectionString, {
    max: 5,
    // Hyperdrive terminates TLS to the origin itself; disable client-side TLS
    // negotiation so postgres.js doesn't try to re-negotiate over the
    // already-proxied connection.
    ssl: false,
  });
  return drizzle(sql, { schema });
}
