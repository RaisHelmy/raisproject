/**
 * Thin adapter that gives the existing repositories (`repositories/d1/*.ts`) a
 * D1Database-shaped surface (`prepare().bind().first()/.all()/.run()`, `.batch()`)
 * backed by `postgres` (postgres.js) instead of D1.
 *
 * Deliberate choice: this app never used an ORM — repositories build plain SQL
 * strings with `?` placeholders and call the D1 API directly. Rewriting every
 * repository to a new query-builder API would be a much larger, riskier diff
 * than keeping the same shape and swapping what sits underneath it. `?` is
 * translated to Postgres's `$1, $2, ...` positional placeholders here, and
 * `ON CONFLICT ... DO UPDATE SET x = excluded.x` / `RETURNING` already read
 * identically in both dialects, so the SQL text in the repositories did not
 * need to change.
 */
import type postgres from "postgres";

export interface PgMeta {
  changes: number;
  last_row_id?: number;
}

export interface PgResult<T> {
  results: T[];
  success: boolean;
  meta: PgMeta;
}

/** Replace positional `?` placeholders with Postgres `$1, $2, ...`. */
function toPositional(text: string): string {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

type Sql = postgres.Sql | postgres.TransactionSql;

export const SCHEMA = "raistimesheet";
const TABLES = ["ai_analyses", "ai_work_items", "api_tokens", "audit_logs", "clients", "import_messages", "imports", "jira_connections", "jira_issues", "jira_match_candidates", "jira_oauth_states", "notifications", "project_members", "projects", "rate_limits", "report_jobs", "roles", "sessions", "settings", "sync_errors", "sync_jobs", "timesheet_approvals", "timesheet_jira_links", "timesheets", "timesheet_sequences", "user_roles", "users"];
const TABLE_RE = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)(\\s+)(${TABLES.join("|")})\\b(?!\\.)`, "gi");

/**
 * Schema-qualify every table reference so a query is one billed statement.
 * Hyperdrive drops session state between statements, so the previous approach
 * (BEGIN; SET search_path; query; COMMIT) cost four statements per query and
 * exhausted the account's daily Hyperdrive quota under bulk load.
 */
export function qualifySql(text: string): string {
  return text.replace(TABLE_RE, (_m, kw: string, ws: string, table: string) => `${kw}${ws}${SCHEMA}.${table}`);
}

export class PgPreparedStatement {
  constructor(
    private readonly sql: Sql,
    private readonly text: string,
    private readonly params: unknown[] = [],
    private readonly isTransaction: boolean = false,
  ) {}

  bind(...params: unknown[]): PgPreparedStatement {
    return new PgPreparedStatement(this.sql, this.text, params, this.isTransaction);
  }

  /** Internal: re-target this statement at a different sql instance (used inside a transaction). */
  withSql(sql: Sql): PgPreparedStatement {
    return new PgPreparedStatement(sql, this.text, this.params, true);
  }

  // Runs as ONE statement: table names are schema-qualified by qualifySql(),
  // so no SET search_path round trip is needed (Hyperdrive would drop it anyway).
  private async exec(): Promise<postgres.RowList<Record<string, unknown>[]>> {
    const text = toPositional(qualifySql(this.text));
    if (this.isTransaction) {
      return this.sql.unsafe(text, this.params as never[]);
    }
    try {
      return await (this.sql as postgres.Sql).unsafe(text, this.params as never[]);
    } catch (e) {
      // 42P01 undefined_table: a reference the qualifier did not catch — fall back to the search_path wrapper.
      if ((e as { code?: string })?.code !== "42P01") throw e;
      return (this.sql as postgres.Sql).begin(async (tx) => {
        await tx.unsafe(`SET search_path TO ${SCHEMA}`);
        return tx.unsafe(toPositional(this.text), this.params as never[]);
      }) as unknown as postgres.RowList<Record<string, unknown>[]>;
    }
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const rows = await this.exec();
    return (rows[0] as T) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<PgResult<T>> {
    const rows = await this.exec();
    return { results: rows as unknown as T[], success: true, meta: { changes: rows.count ?? rows.length } };
  }

  async run<T = Record<string, unknown>>(): Promise<PgResult<T>> {
    const rows = await this.exec();
    return { results: rows as unknown as T[], success: true, meta: { changes: rows.count ?? 0 } };
  }
}

export class PgDatabase {
  constructor(private readonly sql: postgres.Sql) {}

  prepare(text: string): PgPreparedStatement {
    return new PgPreparedStatement(this.sql, text);
  }

  /** Runs the statements sequentially inside a single transaction, mirroring D1's atomic batch(). */
  async batch<T = unknown>(statements: PgPreparedStatement[]): Promise<PgResult<T>[]> {
    return this.sql.begin(async (tx) => {
      const out: PgResult<T>[] = [];
      for (const stmt of statements) out.push(await stmt.withSql(tx).run<T>());
      return out;
    });
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }

  async exec(query: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx.unsafe(`SET search_path TO ${SCHEMA}`);
      await tx.unsafe(query);
    });
  }
}
