/**
 * Postgres via Cloudflare Hyperdrive.
 *
 * - A fresh postgres.js client per request: Workers forbid reusing an I/O object (the socket) created in one
 *   request from another, and Hyperdrive already pools real connections at the edge.
 * - Hyperdrive pools at the transaction level and does not keep session state (SET search_path) between
 *   statements, so every query runs inside an explicit transaction that sets `search_path = xuanzhi, public`
 *   first (`public` holds the pgvector extension operators).
 * - `ssl: false`: Hyperdrive terminates TLS itself; client-side TLS negotiation hangs.
 */
import postgres from "postgres";

export const SCHEMA = "xuanzhi";

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null>;
}

/** postgres.js cannot infer array element types for untyped `unsafe` params, so JS arrays are serialised to Postgres array literals here. */
export function toPgArray(v: unknown[]): string { return `{${v.map((x) => (x === null || x === undefined ? "NULL" : `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`)).join(",")}}`; }
const prep = (params: unknown[]) => params.map((p) => (Array.isArray(p) ? toPgArray(p) : p));

export class Db implements Queryable {
  constructor(private readonly sql: postgres.Sql) {}

  async query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
    const rows = await this.sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO ${SCHEMA}, public`);
      return tx.unsafe(text, prep(params) as never[]);
    });
    return rows as unknown as T[];
  }

  async one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /** Multiple statements in one transaction (search_path set once). */
  async tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
    return this.sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO ${SCHEMA}, public`);
      const q: Queryable = {
        query: async (text, params = []) => (await tx.unsafe(text, prep(params) as never[])) as never,
        one: async (text, params = []) => ((await tx.unsafe(text, prep(params) as never[])) as never[])[0] ?? null,
      };
      return fn(q);
    }) as Promise<T>;
  }

  async end(): Promise<void> { await this.sql.end({ timeout: 1 }).catch(() => undefined); }
}

export function createDb(connectionString: string): Db {
  const sql = postgres(connectionString, {
    max: 5,
    fetch_types: false,
    ssl: false,
    prepare: false,
    types: {
      // Explicit JSON parsers: with fetch_types disabled postgres.js does not attach its json/jsonb parser, so jsonb columns arrived as strings.
      // Repositories pass jsonb values as pre-encoded JSON strings; postgres.js applies this serializer to jsonb-typed params, so strings must pass through untouched (else they are double-encoded).
      json: { to: 114, from: [114, 3802], serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)), parse: (x: string) => JSON.parse(x) },
      int8: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => parseInt(x, 10) },
      numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => parseFloat(x) },
    },
  });
  return new Db(sql);
}

/** Serialise a float array for a `$n::vector` parameter. */
export function toVectorLiteral(v: number[]): string { return `[${v.map((x) => (Number.isFinite(x) ? x.toFixed(7) : 0)).join(",")}]`; }
