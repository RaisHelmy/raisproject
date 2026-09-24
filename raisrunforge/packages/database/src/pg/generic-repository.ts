import type { Sql } from "postgres";
import type { KeyedRepository, ListOptions, TenantRepository } from "@runforge/domain";

/**
 * Column mapping between a camelCase TS field and its snake_case Postgres column.
 * `json: true` marshals the field as a JSONB column; `bool: true` maps to a
 * native Postgres boolean (Postgres has real booleans, unlike SQLite's 0/1
 * integers, but the flag is kept so schemas can be shared/ported unchanged).
 */
export interface ColumnSpec {
  column: string;
  json?: boolean;
  bool?: boolean;
}

export type Schema<T> = Partial<Record<keyof T & string, ColumnSpec>>;

function toRow<T extends Record<string, unknown>>(item: T, schema: Schema<T>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, spec] of Object.entries(schema) as [keyof T & string, ColumnSpec][]) {
    const value = item[field];
    if (value === undefined) {
      row[spec.column] = null;
    } else if (spec.json) {
      row[spec.column] = JSON.stringify(value);
    } else if (spec.bool) {
      row[spec.column] = Boolean(value);
    } else {
      row[spec.column] = value;
    }
  }
  return row;
}

function fromRow<T>(row: Record<string, unknown>, schema: Schema<T>): T {
  const item: Record<string, unknown> = {};
  for (const [field, spec] of Object.entries(schema) as [keyof T & string, ColumnSpec][]) {
    const raw = row[spec.column];
    if (raw === null || raw === undefined) {
      if (!spec.json) continue; // leave optional fields absent
      item[field] = undefined;
      continue;
    }
    if (spec.json) item[field] = typeof raw === "string" ? JSON.parse(raw) : raw;
    else if (spec.bool) item[field] = raw === true || raw === "t" || raw === 1;
    else item[field] = raw;
  }
  return item as T;
}

/** Postgres-backed implementation of TenantRepository<T>, driven by a column Schema. */
export class PgTenantRepository<T extends { id: string; organizationId: string }> implements TenantRepository<T> {
  constructor(
    private readonly sql: Sql,
    private readonly table: string,
    private readonly schema: Schema<T>,
  ) {}

  async list(organizationId: string, options?: ListOptions<T>): Promise<T[]> {
    let text = `SELECT * FROM ${this.table} WHERE organization_id = $1`;
    const params: unknown[] = [organizationId];
    if (options?.where) {
      for (const [field, value] of Object.entries(options.where)) {
        const spec = this.schema[field as keyof T & string];
        if (!spec || value === undefined) continue;
        params.push(spec.bool ? Boolean(value) : value);
        text += ` AND ${spec.column} = $${params.length}`;
      }
    }
    if (options?.orderBy) {
      const spec = this.schema[options.orderBy];
      if (spec) text += ` ORDER BY ${spec.column} ${options.direction === "desc" ? "DESC" : "ASC"}`;
    }
    if (options?.limit !== undefined) text += ` LIMIT ${Number(options.limit)}`;
    if (options?.offset !== undefined) text += ` OFFSET ${Number(options.offset)}`;
    const results = await this.sql.unsafe(text, params as never[]);
    return (results as unknown as Record<string, unknown>[]).map((r) => fromRow<T>(r, this.schema));
  }

  async get(organizationId: string, id: string): Promise<T | null> {
    const rows = await this.sql.unsafe(
      `SELECT * FROM ${this.table} WHERE organization_id = $1 AND id = $2`,
      [organizationId, id] as never[],
    );
    const row = (rows as unknown as Record<string, unknown>[])[0];
    return row ? fromRow<T>(row, this.schema) : null;
  }

  async insert(item: T): Promise<T> {
    const row = toRow(item as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    await this.sql.unsafe(
      `INSERT INTO ${this.table} (${columns.join(", ")}) VALUES (${placeholders})`,
      columns.map((c) => row[c]) as never[],
    );
    return item;
  }

  async update(organizationId: string, id: string, patch: Partial<T>): Promise<T> {
    const row = toRow(patch as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    if (columns.length === 0) return (await this.get(organizationId, id))!;
    const set = columns.map((c, i) => `${c} = $${i + 1}`).join(", ");
    const params = [...columns.map((c) => row[c]), organizationId, id];
    await this.sql.unsafe(
      `UPDATE ${this.table} SET ${set} WHERE organization_id = $${columns.length + 1} AND id = $${columns.length + 2}`,
      params as never[],
    );
    return (await this.get(organizationId, id))!;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.sql.unsafe(`DELETE FROM ${this.table} WHERE organization_id = $1 AND id = $2`, [
      organizationId,
      id,
    ] as never[]);
  }

  async count(organizationId: string, where?: Partial<T>): Promise<number> {
    let text = `SELECT COUNT(*) as n FROM ${this.table} WHERE organization_id = $1`;
    const params: unknown[] = [organizationId];
    if (where) {
      for (const [field, value] of Object.entries(where)) {
        const spec = this.schema[field as keyof T & string];
        if (!spec || value === undefined) continue;
        params.push(spec.bool ? Boolean(value) : value);
        text += ` AND ${spec.column} = $${params.length}`;
      }
    }
    const rows = await this.sql.unsafe(text, params as never[]);
    const row = (rows as unknown as { n: string | number }[])[0];
    return row ? Number(row.n) : 0;
  }
}

/** Postgres-backed implementation of KeyedRepository<T> (users, organizations — no organization_id column). */
export class PgKeyedRepository<T extends { id: string }> implements KeyedRepository<T> {
  constructor(
    private readonly sql: Sql,
    private readonly table: string,
    private readonly schema: Schema<T>,
  ) {}

  async list(options?: ListOptions<T>): Promise<T[]> {
    let text = `SELECT * FROM ${this.table} WHERE 1=1`;
    const params: unknown[] = [];
    if (options?.where) {
      for (const [field, value] of Object.entries(options.where)) {
        const spec = this.schema[field as keyof T & string];
        if (!spec || value === undefined) continue;
        params.push(value);
        text += ` AND ${spec.column} = $${params.length}`;
      }
    }
    if (options?.limit !== undefined) text += ` LIMIT ${Number(options.limit)}`;
    const results = await this.sql.unsafe(text, params as never[]);
    return (results as unknown as Record<string, unknown>[]).map((r) => fromRow<T>(r, this.schema));
  }

  async get(id: string): Promise<T | null> {
    const rows = await this.sql.unsafe(`SELECT * FROM ${this.table} WHERE id = $1`, [id] as never[]);
    const row = (rows as unknown as Record<string, unknown>[])[0];
    return row ? fromRow<T>(row, this.schema) : null;
  }

  async insert(item: T): Promise<T> {
    const row = toRow(item as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    await this.sql.unsafe(
      `INSERT INTO ${this.table} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
      columns.map((c) => row[c]) as never[],
    );
    return item;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const row = toRow(patch as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    if (columns.length > 0) {
      const params = [...columns.map((c) => row[c]), id];
      await this.sql.unsafe(
        `UPDATE ${this.table} SET ${columns.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id = $${columns.length + 1}`,
        params as never[],
      );
    }
    return (await this.get(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.sql.unsafe(`DELETE FROM ${this.table} WHERE id = $1`, [id] as never[]);
  }
}
