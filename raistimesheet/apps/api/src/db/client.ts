/**
 * Postgres connection via Cloudflare Hyperdrive. `env.HYPERDRIVE.connectionString`
 * is resolved by the Workers runtime to the private VPC service in prod, and to the
 * local tunnel target when running under `wrangler dev` with the Hyperdrive binding
 * configured for local development (see docs/database.md).
 *
 * A fresh `postgres.Sql` client (and adapter) is created on every call. This
 * used to be cached at module scope on the theory that repeated invocations
 * of the same isolate should reuse the connection pool, but a postgres.js
 * client holds a live socket (an I/O object), and Workers forbids using an
 * I/O object created in one request's context from a later request — a warm
 * isolate reusing the cached client fails intermittently with "Cannot
 * perform I/O on behalf of a different request." Hyperdrive already pools
 * the underlying connections at the edge, so a new client per request is
 * cheap and correct.
 */
import postgres from "postgres";
import type { Bindings } from "../env";
import { PgDatabase } from "./pg-adapter";

export function getDb(env: Bindings): PgDatabase {
  const sqlClient = postgres(env.HYPERDRIVE.connectionString, {
      max: 5,
      // Hyperdrive already pools/caches connections; skip postgres.js's own
      // startup type-introspection query for lower per-connection latency.
      fetch_types: false,
      // Hyperdrive terminates TLS to the origin itself and does not expect
      // the client to negotiate TLS again on top of the already-proxied
      // connection; other apps on this same Hyperdrive config confirmed
      // "prefer"/"require" are liable to hang until CONNECT_TIMEOUT.
      // Disable client-side TLS negotiation instead.
      ssl: false,
      types: {
        // D1 returned SQLite's dynamic-typed integers as plain JS numbers, and the
        // repositories/services (dashboard sums, pagination totals, etc.) assume
        // `number`. Postgres's `int8`/`numeric` come back from postgres.js as
        // strings by default (to avoid silent precision loss on huge values) —
        // override the parsers so `count(*)`, `sum(...)` etc. keep behaving the
        // same as they did against D1. Safe here: none of this app's aggregates
        // approach Number.MAX_SAFE_INTEGER.
        int8: {
          to: 20,
          from: [20],
          serialize: (x: unknown) => String(x),
          parse: (x: string) => parseInt(x, 10),
        },
        numeric: {
          to: 1700,
          from: [1700],
          serialize: (x: unknown) => String(x),
          parse: (x: string) => parseFloat(x),
        },
      },
  });
  return new PgDatabase(sqlClient);
}
