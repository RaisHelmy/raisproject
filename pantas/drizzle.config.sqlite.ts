import { defineConfig } from "drizzle-kit";

// Source of truth for D1 (SQLite) migrations, generated from src/db/schema.ts.
//
// Postgres note: production will move to PostgreSQL (see CLAUDE.md). The
// generated SQL here is kept portable (see comments in schema.ts) so that
// migrations/*.sql can be hand-adapted to a Postgres dialect at cutover time
// without a schema redesign. Until then, tests/dualDb.test.ts replays these
// same migration files against both a local SQLite file and a Postgres
// container to catch dialect drift as early as possible.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
