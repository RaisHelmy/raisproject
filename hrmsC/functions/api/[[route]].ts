import app from "../../worker/app";
import { getDb } from "../../worker/core/db";
import type { Bindings } from "../../worker/core/types";

// Thin Pages Functions adapter (kept intentionally dumb per CLAUDE.md — all
// real logic lives in worker/). Not using hono/cloudflare-pages's `handle()`
// directly because we need to inject `env.DB` (a `postgres.js` client built
// from the Hyperdrive binding's connection string) before Hono ever sees the
// request — every route module reads `c.env.DB`, unchanged from the D1 era,
// so this is the one seam where D1 -> Postgres actually gets wired up.
type PagesEnv = Omit<Bindings, "DB"> & { HYPERDRIVE: Hyperdrive };

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
  const db = getDb(context.env.HYPERDRIVE.connectionString);
  const env: Bindings = { ...context.env, DB: db };
  try {
    return await app.fetch(context.request, env, {
      waitUntil: context.waitUntil,
      passThroughOnException: context.passThroughOnException,
      props: {},
    });
  } finally {
    // Close this request's connection without delaying the response — see
    // the comment on getDb() in worker/core/db.ts for why a fresh client is
    // created per request rather than reused across requests.
    context.waitUntil(db.end({ timeout: 5 }));
  }
};
