import { Database, type Statement } from "bun:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// A minimal D1Database-compatible shim over bun:sqlite, implementing only
// the surface drizzle-orm/d1's driver actually calls (prepare/bind/run/
// all/raw, and batch). This is Bun-only test infrastructure (CLAUDE.md
// §3.2 — lives under test/, not src/) — it exists so the tenant-isolation
// suite can exercise the real src/db/client.ts query logic under `bun
// test` without standing up workerd/miniflare.

class BoundStatement {
  constructor(private stmt: Statement, private params: unknown[]) {}

  async run() {
    this.stmt.run(...(this.params as never[]));
    return { success: true, results: [], meta: { changes: 0, last_row_id: 0 } };
  }

  async all() {
    const results = this.stmt.all(...(this.params as never[]));
    return { success: true, results, meta: { changes: 0, last_row_id: 0 } };
  }

  async raw() {
    return this.stmt.values(...(this.params as never[]));
  }
}

class PreparedStatement {
  constructor(private stmt: Statement) {}
  bind(...params: unknown[]) {
    return new BoundStatement(this.stmt, params);
  }
}

export class D1Shim {
  private db: Database;

  constructor() {
    this.db = new Database(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.applyMigrations();
  }

  private applyMigrations() {
    const migrationsDir = join(import.meta.dir, "../../src/db/migrations");
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      // drizzle-kit separates statements with a `--> statement-breakpoint` marker.
      for (const statement of sql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (trimmed) this.db.exec(trimmed);
      }
    }
  }

  prepare(sql: string) {
    return new PreparedStatement(this.db.query(sql));
  }

  async batch(statements: BoundStatement[]) {
    const results = [];
    for (const stmt of statements) results.push(await stmt.run());
    return results;
  }

  close() {
    this.db.close();
  }
}

/** Cast to D1Database — the shim implements the subset drizzle-orm/d1 actually calls. */
export function createTestD1(): D1Database {
  return new D1Shim() as unknown as D1Database;
}
