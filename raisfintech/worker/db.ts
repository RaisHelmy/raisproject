// Postgres (via Cloudflare Hyperdrive) data layer.
//
// This project never used an ORM — every call site talks to the database
// through the D1 `prepare().bind().first()/.all()/.run()` /
// `DB.batch([...])` surface. Rather than rewrite ~100 call sites (and risk
// subtly breaking them) this module implements that exact surface on top of
// `postgres` (postgres.js), so `worker/index.ts`, `worker/auth.ts`,
// `worker/gamify.ts`, `worker/jobs.ts`, `worker/sync.ts` and `worker/email.ts`
// are unchanged apart from swapping the binding they read from.
//
// SQL text keeps SQLite-style `?` positional placeholders at the call sites;
// this shim rewrites them to Postgres `$1, $2, ...` placeholders before
// sending the query.
import postgres from "postgres";
import type { Env } from "./types";

export interface D1LikeMeta {
  changes: number;
  duration: number;
  last_row_id?: number;
}

export interface D1LikeResult<T = unknown> {
  results: T[];
  success: boolean;
  meta: D1LikeMeta;
}

type Sql = ReturnType<typeof postgres>;

const PG_SCHEMA = "raisfintech";

/** Rewrites SQLite `?` placeholders (in source order) to Postgres `$1, $2, ...`. */
function toPgQuery(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

class PgPreparedStatement {
  constructor(
    private readonly client: Sql,
    private readonly query: string,
    private readonly params: unknown[] = []
  ) {}

  bind(...args: unknown[]): PgPreparedStatement {
    return new PgPreparedStatement(this.client, this.query, args);
  }

  private async execute<T>(): Promise<{ rows: T[]; count: number }> {
    const text = toPgQuery(this.query);
    // Hyperdrive pools connections at the transaction/statement level and
    // does not preserve session state (a `SET search_path`, or the
    // search_path startup parameter used to be set on `connection` in
    // getDb() below) across separate statements — every unqualified table
    // reference otherwise resolves against the default schema and fails
    // with "relation ... does not exist". A `SET search_path` + the query
    // wrapped in one explicit transaction *is* pinned to a single backend
    // connection under Hyperdrive's transaction pooling, so do that instead.
    const rows = (await this.client.begin(async (tx) => {
      await tx.unsafe(`SET search_path TO ${PG_SCHEMA}`);
      return tx.unsafe(text, this.params as never[]);
    })) as unknown as T[] & { count?: number };
    return { rows, count: rows.count ?? rows.length };
  }

  async run<T = unknown>(): Promise<D1LikeResult<T>> {
    const { rows, count } = await this.execute<T>();
    return { results: rows, success: true, meta: { changes: count, duration: 0 } };
  }

  async all<T = unknown>(): Promise<D1LikeResult<T>> {
    const { rows, count } = await this.execute<T>();
    return { results: rows, success: true, meta: { changes: count, duration: 0 } };
  }

  async first<T = unknown>(): Promise<T | null> {
    const { rows } = await this.execute<T>();
    return rows[0] ?? null;
  }

  /** Internal: used by PgD1.batch() to run a bound statement inside a transaction. */
  _withClient(client: Sql): PgPreparedStatement {
    return new PgPreparedStatement(client, this.query, this.params);
  }
}

/** D1Database-shaped wrapper around a postgres.js client, for Hyperdrive. */
export class PgD1 {
  constructor(private readonly client: Sql) {}

  prepare(query: string): PgPreparedStatement {
    return new PgPreparedStatement(this.client, query);
  }

  async batch<T = unknown>(stmts: PgPreparedStatement[]): Promise<D1LikeResult<T>[]> {
    return this.client.begin(async (tx) => {
      await tx.unsafe(`SET search_path TO ${PG_SCHEMA}`);
      const out: D1LikeResult<T>[] = [];
      for (const stmt of stmts) {
        out.push(await stmt._withClient(tx as unknown as Sql).run<T>());
      }
      return out;
    }) as Promise<D1LikeResult<T>[]>;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    await this.client.begin(async (tx) => {
      await tx.unsafe(`SET search_path TO ${PG_SCHEMA}`);
      await tx.unsafe(query);
    });
    return { count: 0, duration: 0 };
  }
}

/**
 * Creates a fresh postgres.js client bound to Hyperdrive for this request,
 * wrapped in the D1-compatible shim above. This used to be cached at module
 * scope per isolate, but a postgres.js client holds a live socket (an I/O
 * object), and Workers forbids using an I/O object created in one request's
 * context from a later request — a warm isolate reusing the cached client
 * failed intermittently with "Cannot perform I/O on behalf of a different
 * request." Hyperdrive already pools/reuses the underlying connections at
 * the edge, so creating a new client per request is cheap and correct.
 */
export function getDb(env: Env): PgD1 {
  const client = postgres(env.HYPERDRIVE.connectionString, {
      max: 5,
      // The shared "raishelmy" Postgres database hosts every app in its own
      // schema; this app's tables live in schema `raisfintech`. All SQL at
      // the call sites is unqualified (as it was against D1/SQLite and the
      // old dedicated database's `public` schema), so default the session's
      // search_path to this app's schema rather than qualifying every call.
      connection: {
        search_path: "raisfintech",
      },
      // Hyperdrive already pools/caches at the edge; keep postgres.js's own
      // prepared-statement cache on (default) so Hyperdrive's query cache
      // can key off of it.
      fetch_types: false,
      // Hyperdrive terminates TLS to the origin itself and does not expect
      // the client to negotiate TLS again on top of the already-proxied
      // connection; "prefer" was hanging until CONNECT_TIMEOUT against
      // Hyperdrive (worked fine for a raw local Postgres tunnel, but not
      // through Hyperdrive). Disable client-side TLS negotiation instead,
      // matching the other apps sharing this Hyperdrive config.
      ssl: false,
      types: {
        // postgres.js returns int8/bigint (e.g. COUNT(*)) as a string by
        // default to avoid precision loss. Every COUNT(*)/SUM() in this app
        // is compared/added as a plain number and stays well under
        // Number.MAX_SAFE_INTEGER, so parse it back to a number to match
        // the D1 (SQLite) behaviour the call sites were written against.
        int8: {
          to: 20,
          from: [20],
          serialize: (x: number) => String(x),
          parse: (x: string) => Number.parseInt(x, 10),
        },
      },
  });
  return new PgD1(client);
}
