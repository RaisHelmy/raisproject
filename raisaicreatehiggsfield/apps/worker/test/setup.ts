import { env } from "cloudflare:test";
import { attachDb } from "../src/db/client";

/**
 * D1 previously got a fresh in-memory database per test run via
 * `applyD1Migrations`. Postgres (via Hyperdrive) has no equivalent, so this
 * resets the `public` schema on the tunnelled test database (see
 * wrangler.jsonc's `hyperdrive[0].localConnectionString`) and replays the
 * Postgres migrations from migrations-pg/ before any test runs. Storage is
 * shared across tests in this suite already (vitest.config.ts), so doing
 * this once here is equivalent to the old per-run D1 migration apply.
 */
attachDb(env);

await env.DB.exec("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
for (const migration of env.TEST_MIGRATIONS) {
  for (const query of migration.queries) {
    await env.DB.exec(query);
  }
}

/**
 * The AI binding reaches Cloudflare for real and bills the account, even in
 * tests. Replacing it with something that throws means a test can only ever
 * run a model by deliberately injecting a fake provider or its own stub, and
 * anything that forgets fails loudly instead of quietly spending money.
 */
(env as { AI: Ai }).AI = {
  run: async (model: string) => {
    throw new Error(
      `A test tried to call the real AI binding for "${model}". ` +
        "Pass a FakeAIProvider, or override env.AI with a stub for this test.",
    );
  },
} as unknown as Ai;
