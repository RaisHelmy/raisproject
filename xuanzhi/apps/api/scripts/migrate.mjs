#!/usr/bin/env bun
/**
 * Applies migrations/*.sql in order to DATABASE_URL (skips versions recorded in xuanzhi.schema_migrations).
 * Usage: DATABASE_URL=postgresql://postgres:postgres@localhost:15432/raishelmy bun scripts/migrate.mjs
 * Requires the SSH tunnel to the VM (see docs/database.md) unless run on the VM itself.
 */
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const url = process.env.DATABASE_URL; if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => undefined });
const dir = join(import.meta.dir ?? ".", "..", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS xuanzhi; CREATE TABLE IF NOT EXISTS xuanzhi.schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
const applied = new Set((await sql.unsafe(`SELECT version FROM xuanzhi.schema_migrations`)).map((r) => r.version));
for (const f of files) {
  const version = f.replace(/\.sql$/, "");
  if (applied.has(version)) { console.log(`skip  ${version}`); continue; }
  console.log(`apply ${version}`);
  await sql.unsafe(readFileSync(join(dir, f), "utf8"));
  await sql.unsafe(`INSERT INTO xuanzhi.schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`, [version]);
}
await sql.end(); console.log("done");
