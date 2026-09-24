#!/usr/bin/env bun
/** Re-applies migrations/0002_seed.sql (idempotent reference data). Usage: DATABASE_URL=... bun scripts/seed.mjs */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const url = process.env.DATABASE_URL; if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => undefined });
await sql.unsafe(readFileSync(join(import.meta.dir ?? ".", "..", "migrations", "0002_seed.sql"), "utf8"));
await sql.end(); console.log("seeded");
