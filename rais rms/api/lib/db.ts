import postgres from "postgres";

/**
 * Minimal D1-shaped database interface. This is intentionally NOT the
 * `@cloudflare/workers-types` `D1Database` interface (which also requires
 * `dump()`/`exec()`/session methods we never used) — it's just the subset of
 * the D1 API this codebase actually calls: prepare().bind().all()/.first()/.run(),
 * and db.batch(). Keeping the same shape let the Postgres migration swap the
 * backend (D1 -> Hyperdrive/postgres.js) without touching any of the ~330
 * call sites in api/db/*.ts and api/lib/*.ts.
 */
export interface AppDatabase {
  prepare(query: string): AppStatement;
  batch<T = unknown>(statements: AppStatement[]): Promise<AppRunResult<T>[]>;
}

export interface AppStatement {
  bind(...values: unknown[]): AppStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run<T = unknown>(): Promise<AppRunResult<T>>;
}

export interface AppRunResult<T = unknown> {
  success: true;
  results?: T[];
  meta: { changes: number; last_row_id: number; duration: number };
}

/**
 * Rewrites a SQLite-style `?`-placeholder query into a Postgres `$1, $2, ...`
 * query. The codebase's queries are simple (no literal `?` inside string
 * literals), so positional substitution in source order is safe.
 *
 * Also rewrites `LIKE` -> `ILIKE` to preserve SQLite's default
 * case-insensitive ASCII LIKE semantics (used for guest search) — Postgres's
 * `LIKE` is case-sensitive.
 */
function toPgQuery(sql: string): string {
  let i = 0;
  const withPlaceholders = sql.replace(/\?/g, () => `$${++i}`);
  return withPlaceholders.replace(/\bLIKE\b/gi, "ILIKE");
}

class PgStatement implements AppStatement {
  constructor(
    private readonly sql: postgres.Sql,
    private readonly query: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): AppStatement {
    return new PgStatement(this.sql, this.query, values);
  }

  // Hyperdrive pools connections at the transaction/statement level and does
  // not preserve session state (a `SET search_path`, or the search_path
  // connection option `getPgClient()` used to set) across separate
  // statements, so every unqualified table reference otherwise resolves
  // against the default schema and fails with "relation ... does not
  // exist". A `SET search_path` + the query wrapped in one explicit
  // transaction *is* pinned to a single backend connection under
  // Hyperdrive's transaction pooling.
  private exec<T>() {
    return this.sql.begin(async (tx) => {
      await tx.unsafe(`SET search_path TO raisrms`);
      return tx.unsafe(toPgQuery(this.query), this.params as any[]);
    }) as unknown as Promise<T[] & { count: number }>;
  }

  async first<T = unknown>(): Promise<T | null> {
    const rows = await this.exec<T>();
    return (rows[0] as T) ?? null;
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    const rows = await this.exec<T>();
    return { results: Array.from(rows) as T[] };
  }

  async run<T = unknown>(): Promise<AppRunResult<T>> {
    const rows = await this.exec<T>();
    return {
      success: true,
      results: Array.from(rows) as T[],
      meta: { changes: rows.count ?? rows.length, last_row_id: 0, duration: 0 },
    };
  }
}

export function createPgDatabase(sql: postgres.Sql): AppDatabase {
  return {
    prepare(query: string): AppStatement {
      return new PgStatement(sql, query);
    },
    async batch<T = unknown>(statements: AppStatement[]): Promise<AppRunResult<T>[]> {
      return sql.begin(async () => {
        const results: AppRunResult<T>[] = [];
        for (const stmt of statements) {
          results.push(await stmt.run<T>());
        }
        return results;
      });
    },
  };
}

/**
 * Creates a fresh postgres.js client bound to Hyperdrive for this request.
 * This used to be cached at module scope per isolate, but a postgres.js
 * client holds a live socket (an I/O object), and Workers forbids using an
 * I/O object created in one request's context from a later request — a warm
 * isolate reusing the cached client failed intermittently with "Cannot
 * perform I/O on behalf of a different request." Hyperdrive already pools
 * the underlying connections at the edge, so creating a new client per
 * request is cheap and correct.
 */
export function getPgClient(connectionString: string): postgres.Sql {
  return postgres(connectionString, {
    max: 5,
    types: {
      // postgres.js returns BIGINT (oid 20) as a string by default, to avoid
      // silently losing precision above Number.MAX_SAFE_INTEGER. Every
      // BIGINT column in this schema is either an epoch-ms timestamp
      // (~1.7e12 today, nowhere near 2^53) or a COUNT(*)/SUM(int) aggregate
      // — both safe as JS numbers — and D1/SQLite always handed these back
      // as plain numbers, so callers (e.g. api/db/availability.ts's
      // `r.starts_at + turnTime * 60_000` arithmetic) expect a number, not a
      // string. Parse BIGINT as Number here instead of touching every call
      // site.
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
    // Hyperdrive terminates TLS to the origin itself and does not expect the
    // client to negotiate TLS again on top of the already-proxied
    // connection; "prefer" hangs until CONNECT_TIMEOUT against Hyperdrive in
    // practice (confirmed live in another app on this same Hyperdrive
    // config). Disable client-side TLS negotiation instead.
    ssl: false,
  });
}

export function createDbFromHyperdrive(hyperdrive: { connectionString: string }): AppDatabase {
  return createPgDatabase(getPgClient(hyperdrive.connectionString));
}
