/**
 * Applies migrations/postgres/*.sql to the RunForge Postgres database.
 * Demo mode does not need this — the in-memory DemoWorld requires no schema.
 *
 * Requires DATABASE_URL (a direct Postgres connection string) to be set —
 * e.g. via an SSH tunnel to the DB host:
 *   ssh -L 15432:localhost:5432 <user>@<host>
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raishelmy bun run scripts/db-migrate.ts
 *
 * This app's tables live in the `raisrunforge` schema inside the shared
 * `raishelmy` database (one Postgres instance, one schema per app) — this
 * script sets search_path to `raisrunforge` before applying migrations, so
 * unqualified CREATE TABLE statements land in the right schema rather than
 * `public`.
 *
 * In the deployed Worker, connections instead go through the HYPERDRIVE
 * binding (see apps/api/wrangler.toml) — this script is for local/manual use.
 *
 * Formerly this applied migrations/0001_init.sql (SQLite dialect) to a local
 * D1 database via `wrangler d1 execute`; that file is kept for history but is
 * no longer applied.
 */
import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Example:");
  console.error(
    "  DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raishelmy bun run scripts/db-migrate.ts",
  );
  process.exit(1);
}

const migrationsDir = path.join(import.meta.dir, "..", "migrations", "postgres");
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

const sql = postgres(connectionString, {
  max: 1,
  connection: { search_path: "raisrunforge" },
});
try {
  await sql.unsafe("CREATE SCHEMA IF NOT EXISTS raisrunforge");
  for (const file of files) {
    console.log(`Applying ${file}...`);
    const text = await readFile(path.join(migrationsDir, file), "utf8");
    await sql.unsafe(text);
  }
  console.log("Migrations applied successfully.");
} finally {
  await sql.end();
}
