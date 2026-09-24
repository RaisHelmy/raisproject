import { defineConfig } from "drizzle-kit";

// Postgres config, used post-D1-migration (CLAUDE.md §4). Points at the
// shared `raishelmy` Postgres database (single account-wide Hyperdrive,
// `raishelmy-hyperdrive`) that Hyperdrive fronts in prod; for local dev /
// drizzle-kit, reach it through the SSH tunnel documented in the repo
// README / .dev.vars.example (`ssh -L 15432:localhost:5432 ...`) and set
// DATABASE_URL accordingly. The server only accepts encrypted connections
// (pg_hba.conf: hostssl all all all scram-sha-256), so sslmode=require is
// mandatory, e.g.:
//   postgresql://postgres:postgres@localhost:15432/raishelmy?sslmode=require
//
// This app's tables live isolated in Postgres schema `helpdeskc` inside the
// shared `raishelmy` database, and the drizzle schema files use plain,
// non-schema-qualified pgTable() — so drizzle-kit needs to be told which
// schema to operate in. We do that by appending
// `?options=-c search_path=helpdeskc` to DATABASE_URL (see .dev.vars /
// .dev.vars.example) rather than wrapping the schema in pgSchema("helpdeskc"),
// since that would require touching every schema file and every query call
// site across src/db/ for a setting that's purely a connection concern.
// If DATABASE_URL is ever set without that options param, `db:generate` /
// `db:migrate:local` will target the `public` schema of the shared database
// instead — a mistake, not a supported mode.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations_pg",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
