/**
 * Postgres (via Hyperdrive) client shaped like the D1Database API.
 *
 * This project's repositories/services were written directly against
 * `env.DB.prepare(sql).bind(...).run()/.all()/.first()` and `env.DB.batch()`
 * (D1's SQLite-flavoured API) rather than an ORM. Migrating the ~40 call
 * sites to a different query API in one pass was judged too risky to do
 * blindly, so this adapter preserves that exact surface on top of
 * `postgres` (postgres.js), translating `?` placeholders to `$1, $2, ...`
 * and wrapping `.batch()` in a transaction. Call sites are unchanged; only
 * the SQL dialect in migrations (see migrations-pg/) needed to change.
 *
 * TODO(dialect): this shim intentionally does not attempt to emulate every
 * SQLite quirk (e.g. dynamic typing, `?` re-use). A grep across src/ turned
 * up no `strftime`/`json_extract`/`AUTOINCREMENT`/`LIMIT -1` use in runtime
 * queries (only in old sqlite migration DDL), so plain parameterized
 * SELECT/INSERT/UPDATE/DELETE/RETURNING/ON CONFLICT statements were assumed
 * portable as-is. Revisit if a new call site needs SQLite-only syntax.
 */
import postgres from "postgres";

export type Row = Record<string, unknown>;

export interface D1LikeResultMeta {
  changes: number;
  last_row_id: number;
  duration: number;
  rows_read: number;
  rows_written: number;
}

export interface D1LikeResult<T = Row> {
  results: T[];
  success: true;
  meta: D1LikeResultMeta;
}

function toMeta(rowCount: number): D1LikeResultMeta {
  return { changes: rowCount, last_row_id: 0, duration: 0, rows_read: rowCount, rows_written: rowCount };
}

/** Rewrites SQLite-style `?` positional placeholders into Postgres `$1, $2, ...`. */
function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export class PgStatement {
  readonly params: unknown[] = [];
  constructor(
    private readonly sql: postgres.Sql | postgres.TransactionSql,
    readonly text: string,
  ) {}

  bind(...params: unknown[]): PgStatement {
    const next = new PgStatement(this.sql, this.text);
    (next as { params: unknown[] }).params = params;
    return next;
  }

  async all<T = Row>(): Promise<D1LikeResult<T>> {
    const rows = (await this.sql.unsafe(toPgSql(this.text), this.params as never[])) as unknown as T[];
    return { results: rows, success: true, meta: toMeta(rows.length) };
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const rows = (await this.sql.unsafe(toPgSql(this.text), this.params as never[])) as unknown as Row[];
    const row = rows[0];
    if (!row) return null;
    if (column) return (row[column] as T) ?? null;
    return row as T;
  }

  async run<T = Row>(): Promise<D1LikeResult<T>> {
    const rows = (await this.sql.unsafe(toPgSql(this.text), this.params as never[])) as unknown as T[];
    // postgres.js exposes the affected row count on the result array itself.
    const count = (rows as unknown as { count?: number }).count ?? rows.length;
    return { results: rows, success: true, meta: toMeta(count) };
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const rows = (await this.sql.unsafe(toPgSql(this.text), this.params as never[])) as unknown as Row[];
    return rows.map((r) => Object.values(r)) as unknown as T[];
  }
}

export class PgDatabase {
  constructor(public readonly sql: postgres.Sql) {}

  prepare(query: string): PgStatement {
    return new PgStatement(this.sql, query);
  }

  /** Mirrors D1Database#batch: runs every statement atomically, in order. */
  async batch<T = Row>(statements: PgStatement[]): Promise<D1LikeResult<T>[]> {
    const results: D1LikeResult<T>[] = [];
    await this.sql.begin(async (tx) => {
      const scoped = statements.map((s) => rebind(s, tx));
      for (const stmt of scoped) {
        results.push(await stmt.run<T>());
      }
    });
    return results;
  }

  async exec(query: string): Promise<void> {
    await this.sql.unsafe(query);
  }
}

// PgStatement's `sql` handle is the pool; batch() needs to re-run each
// prepared statement against the transaction's client instead, so we
// reconstruct it against `tx` reusing the already-bound text/params.
function rebind(stmt: PgStatement, tx: postgres.TransactionSql): PgStatement {
  return new PgStatement(tx, stmt.text).bind(...stmt.params);
}

/**
 * Creates a fresh postgres.js client bound to Hyperdrive for this request.
 * This used to be cached at module scope per isolate (the theory being
 * pooled connections should be reused across invocations), but a
 * postgres.js client holds a live socket (an I/O object), and Workers
 * forbids using an I/O object created in one request's context from a
 * later request — a warm isolate reusing the cached client failed
 * intermittently with "Cannot perform I/O on behalf of a different
 * request." Hyperdrive already pools the underlying connections at the
 * edge, so creating a new client per request is cheap and correct.
 */
function getSql(connectionString: string): postgres.Sql {
  return postgres(connectionString, {
    max: 5,
    // Hyperdrive terminates TLS/pooling itself; the driver speaks plain
    // Postgres wire protocol to it. In local dev/tests (no real Hyperdrive
    // proxy — see wrangler.jsonc's localConnectionString), this instead
    // connects straight to Postgres over the SSH tunnel.
    // TODO(infra): that local path currently fails — the target server's
    // pg_hba.conf only has an entry for the tunnelled loopback connection,
    // not for the address workerd's sandboxed network presents
    // (172.17.0.1), so local `wrangler dev`/vitest runs need either a
    // matching pg_hba.conf entry (or `ssl`-required entry, once the server
    // has a cert workerd's runtime will trust) added on the Postgres host,
    // or a local-only Postgres for dev. Not fixed here: changing the
    // shared Postgres server's auth policy is outside this migration.
    prepare: false,
    ssl: false,
  });
}

/**
 * Hyperdrive pools connections at the transaction/statement level and does
 * not preserve session state (a `SET search_path`, or the search_path
 * connection option used here previously) across separate statements, so
 * every unqualified table reference in PgStatement otherwise resolves
 * against the default schema and fails with "relation ... does not exist".
 * PgStatement only ever calls `sql.unsafe(...)`, and PgDatabase.batch()
 * only calls `sql.begin(...)`, so this wrapper implements just those two,
 * running `SET search_path` inside the same transaction before delegating.
 */
function withSearchPath(sql: postgres.Sql, schema: string): postgres.Sql {
  return {
    unsafe: (text: string, params?: unknown[]) =>
      sql.begin(async (tx) => {
        await tx.unsafe(`SET search_path TO ${schema}`);
        return tx.unsafe(text, params as never[]);
      }),
    begin: (fn: (tx: postgres.TransactionSql) => unknown) =>
      sql.begin(async (tx) => {
        await tx.unsafe(`SET search_path TO ${schema}`);
        return fn(tx);
      }),
  } as unknown as postgres.Sql;
}

export function getDb(connectionString: string): PgDatabase {
  return new PgDatabase(withSearchPath(getSql(connectionString), "raisaicreatehiggsfield"));
}

/**
 * Attaches `env.DB` from `env.HYPERDRIVE` for any entrypoint that isn't the
 * Hono `fetch` app (which gets it from the `attachDb` middleware in app.ts):
 * `queue()`, `scheduled()`, and the `RaisWorkflowRun` Workflow entrypoint all
 * receive raw bindings from the runtime with no chance to run that
 * middleware first.
 */
export function attachDb<E extends { HYPERDRIVE: { connectionString: string } }>(
  env: E,
): E & { DB: PgDatabase } {
  return Object.assign(env, { DB: getDb(env.HYPERDRIVE.connectionString) });
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Pre-migration helpers, kept as-is: repositories/services build batches of
 * {sql, params} and hand them to `runBatch` so multi-row writes (e.g. ledger
 * entries) stay atomic. Only the underlying statement type changed.
 */
export interface BatchOp {
  sql: string;
  params?: unknown[];
}

export function toStatement(db: PgDatabase, op: BatchOp): PgStatement {
  const stmt = db.prepare(op.sql);
  return op.params && op.params.length > 0 ? stmt.bind(...op.params) : stmt;
}

/** Run multiple writes atomically. Use for anything touching the ledger (invariant 1). */
export async function runBatch(db: PgDatabase, ops: BatchOp[]): Promise<D1LikeResult[]> {
  if (ops.length === 0) return [];
  return db.batch(ops.map((op) => toStatement(db, op)));
}
