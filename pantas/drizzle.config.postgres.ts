import { defineConfig } from "drizzle-kit";

// Source of truth for Postgres migrations, generated from src/db/schema.ts.
// This is the live config post-cutover — see CLAUDE.md "Critical constraint
// — Postgres migration". Production connects through Cloudflare Hyperdrive
// (see wrangler.jsonc `hyperdrive` binding); drizzle-kit itself talks
// directly to Postgres, so for local generate/push, open the SSH tunnel
// described in the project README/CLAUDE.md and point DATABASE_URL at it,
// e.g.:
//   DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raishelmy?sslmode=no-verify \
//     npx drizzle-kit push --config=drizzle.config.postgres.ts
// (sslmode=no-verify is needed because the server's cert is issued for its
// real VPC hostname, not "localhost", through the tunnel)
//
// Shared-database note: this app's tables live in the `pantas` schema
// (`pantas_staging` for staging) inside the single shared `raishelmy`
// Postgres database — not their own dedicated database anymore. drizzle-kit
// resolves unqualified table names against whatever schema is first on
// Postgres's search_path for the connecting role, so schemaFilter pins it
// explicitly to `pantas` regardless of the role's default search_path.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./migrations_pg",
  schemaFilter: ["pantas"],
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
});
