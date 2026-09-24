import { defineConfig } from "vitest/config";

// Plain node environment for repository-layer / schema tests, which run
// against better-sqlite3 and (optionally) a real Postgres instance directly
// — not through a D1 binding. Worker-route integration tests that need an
// actual D1/KV/R2 binding belong in a separate @cloudflare/vitest-pool-workers
// config, added once there are routes worth exercising that way (Step 4+).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Postgres cutover note: every test file now shares one real Postgres
    // database (via the SSH tunnel — see tests/support/pgTestDb.ts), unlike
    // the old per-file in-memory SQLite database each got for free. Running
    // test files in parallel against that one shared database raced the
    // migration/truncate setup in pgTestDb.ts (duplicate pg_type entries,
    // deadlocks, cross-file data bleeding into assertions). Disabling file
    // parallelism trades some wall-clock time for correctness against the
    // shared instance; tests within a file still run in the declared order.
    fileParallelism: false,
  },
});
