import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

// readD1Migrations just reads {name, sql} pairs off disk in filename order;
// reused here for the Postgres-dialect migrations (see migrations-pg/) since
// test/setup.ts replays them against the tunnelled Postgres test database
// instead of calling applyD1Migrations.
const migrations = await readD1Migrations("./migrations-pg");

export default defineWorkersConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    poolOptions: {
      workers: {
        // Storage is shared across tests: per-test isolation is unavailable
        // while a Workflows binding is declared, and this pool version fails
        // when it is forced. Tests therefore assert what they mean rather than
        // assuming a pristine database, e.g. "this row exists" over "the table
        // holds exactly N rows".
        isolatedStorage: false,
        singleWorker: true,
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            APP_ENV: "development",
            AI_GATEWAY_ID: "test",
            SESSION_SECRET: "test-secret",
            TEST_MIGRATIONS: migrations,
          },
        },
      },
    },
  },
});
