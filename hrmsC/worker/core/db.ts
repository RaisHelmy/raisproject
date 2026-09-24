import postgres from "postgres";

/** The `postgres.js` client type. Query helpers below take this in place of
 * the old `D1Database` — every call site (`worker/modules/**`) was already
 * going through `queryAll`/`queryOne`/`exec`, never D1's raw `.prepare()`
 * API, so only this file changed dialect. */
export type Db = ReturnType<typeof postgres>;

/** Deliberately NOT cached/reused across requests. Workers forbids using an
 * I/O object (a `postgres.js` socket included) from a request handler other
 * than the one that created it ("Cannot perform I/O on behalf of a
 * different request") — confirmed live during this migration (a cached
 * module-level client worked for the first request in an isolate and threw
 * on every request after it). Hyperdrive itself pools the real connections
 * to Postgres, so a cheap new `postgres.js` client per request (closed via
 * `ctx.waitUntil(sql.end())` in `functions/api/[[route]].ts`) is the
 * documented/correct pattern, not a performance regression. */
export function getDb(connectionString: string): Db {
  return postgres(connectionString, {
    max: 5,
    fetch_types: false,
  });
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** The rest of the codebase writes queries D1-style, with positional `?`
 * placeholders (`worker/modules/**` was never touched for the migration —
 * see `Bindings.DB` in `worker/core/types.ts`). Postgres wants `$1, $2, ...`,
 * so rewrite the placeholders here rather than touching ~150 call sites.
 * Conservative choice: no query in this codebase uses a literal `?`
 * character outside of a placeholder position (verified by grep before this
 * migration), so a blind sequential replace is safe. */
function toPositional(sqlText: string): string {
  let i = 0;
  return sqlText.replace(/\?/g, () => `$${++i}`);
}

/** Hyperdrive pools connections at the transaction/statement level and does
 * not preserve session state (a `SET search_path`, or the search_path
 * connection option `getDb()` used to set) across separate statements, so
 * every unqualified table reference otherwise resolves against the default
 * schema and fails with "relation ... does not exist". A `SET search_path`
 * + the query wrapped in one explicit transaction *is* pinned to a single
 * backend connection under Hyperdrive's transaction pooling. */
export async function queryAll<T>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const rows = await db.begin(async (tx) => {
    await tx.unsafe(`SET search_path TO hrmsc`);
    return tx.unsafe(toPositional(sql), params as never[]);
  });
  return rows as unknown as T[];
}

export async function queryOne<T>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await queryAll<T>(db, sql, params);
  return rows[0] ?? null;
}

/** Shaped like a subset of D1Result (`{ meta: { changes } }`) so the handful
 * of call sites that check `result.meta.changes` (delete/update
 * not-found checks in employees/vendors/payroll/workflows routes) needed no
 * changes. `postgres.js`'s `.count` is the affected-row count for
 * INSERT/UPDATE/DELETE, matching D1's `meta.changes` semantics. */
export async function exec(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<{ meta: { changes: number } }> {
  const result = await db.begin(async (tx) => {
    await tx.unsafe(`SET search_path TO hrmsc`);
    return tx.unsafe(toPositional(sql), params as never[]);
  });
  return { meta: { changes: result.count ?? 0 } };
}

/** Insert a row into `audit_logs`. Every state-changing mutation on a
 * tenant-owned record should call this so the admin audit trail stays
 * complete (mirrors the `_AuditLog.cshtml` pattern in the reference app). */
export async function recordAudit(
  db: Db,
  entry: {
    tenantId: string;
    module: string;
    recordId: string;
    action: string;
    actorUserId: string | null;
    remarks?: string | null;
  },
): Promise<void> {
  await exec(
    db,
    `INSERT INTO audit_logs (id, tenant_id, module, record_id, action, actor_user_id, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      entry.tenantId,
      entry.module,
      entry.recordId,
      entry.action,
      entry.actorUserId,
      entry.remarks ?? null,
    ],
  );
}
