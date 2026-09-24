/** Small helpers shared by the repositories. Backed by Postgres via `PgDatabase` (see src/db/pg-adapter.ts). */
import type { PgDatabase, PgPreparedStatement, PgResult } from "../../db/pg-adapter";

export function bind(db: PgDatabase, sql: string, ...params: unknown[]): PgPreparedStatement {
  return db.prepare(sql).bind(...params);
}

export async function one<T>(db: PgDatabase, sql: string, ...params: unknown[]): Promise<T | null> {
  const r = await db.prepare(sql).bind(...params).first<T>();
  return r ?? null;
}

export async function all<T>(db: PgDatabase, sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...params).all<T>();
  return r.results ?? [];
}

export async function run(db: PgDatabase, sql: string, ...params: unknown[]): Promise<PgResult<unknown>> {
  return db.prepare(sql).bind(...params).run();
}

/** Build `UPDATE table SET a=?,b=? WHERE id=?` from a patch object (undefined keys skipped). */
export function updateStatement(table: string, id: string, patch: Record<string, unknown>, idColumn = "id"): { sql: string; params: unknown[] } | null {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== idColumn);
  if (!keys.length) return null;
  return { sql: `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE ${idColumn} = ?`, params: [...keys.map((k) => patch[k]), id] };
}

export function insertStatement(table: string, row: Record<string, unknown>): { sql: string; params: unknown[] } {
  const keys = Object.keys(row).filter((k) => row[k] !== undefined);
  return { sql: `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, params: keys.map((k) => row[k]) };
}

export function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

/** Chunk a list of statements into a batch, each batch run atomically (limit ~100 per batch, keep modest). */
export async function batchAll(db: PgDatabase, stmts: PgPreparedStatement[], size = 50): Promise<void> {
  for (let i = 0; i < stmts.length; i += size) {
    await db.batch(stmts.slice(i, i + size));
  }
}
