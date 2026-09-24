import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppDatabase } from "../../api/lib/db";

/**
 * Minimal AppDatabase-compatible wrapper around bun:sqlite, used only in tests
 * so `bun test` can exercise the Hono app (app.request()) without the Workers
 * runtime or a real Postgres connection. Implements the same subset of the
 * D1-shaped API that api/lib/db.ts's Postgres/Hyperdrive adapter implements:
 * prepare().bind().all()/.first()/.run(), and db.batch(). Deliberately left
 * on SQLite (not Postgres) — it's fast, hermetic, and needs no network/tunnel
 * for CI; it is not meant to catch Postgres-dialect regressions (see
 * README/CLAUDE notes about the migrations/ vs migrations_pg/ split).
 */
class D1StatementShim {
  constructor(
    private readonly sqlite: Database,
    private readonly sql: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): D1StatementShim {
    return new D1StatementShim(this.sqlite, this.sql, params);
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    const stmt = this.sqlite.query(this.sql);
    const results = stmt.all(...(this.params as any[])) as T[];
    return { results };
  }

  async first<T = unknown>(): Promise<T | null> {
    const stmt = this.sqlite.query(this.sql);
    const row = stmt.get(...(this.params as any[])) as T | undefined;
    return row ?? null;
  }

  async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
    const stmt = this.sqlite.query(this.sql);
    stmt.run(...(this.params as any[]));
    const changesRow = this.sqlite.query("SELECT changes() as c").get() as { c: number };
    return { meta: { changes: changesRow.c, last_row_id: 0 } };
  }
}

export function createTestD1(): AppDatabase {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = OFF;");

  const migrationsDir = join(import.meta.dir, "../../migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    sqlite.exec(sql);
  }

  const shim = {
    prepare(sql: string) {
      return new D1StatementShim(sqlite, sql);
    },
    async batch(statements: D1StatementShim[]) {
      const results = [];
      for (const s of statements) results.push(await s.run());
      return results;
    },
  };

  return shim as unknown as AppDatabase;
}
