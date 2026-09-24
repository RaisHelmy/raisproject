import type { KeyedRepository, ListOptions, TenantRepository } from "@runforge/domain";

/**
 * Column mapping between a camelCase TS field and its snake_case D1 column.
 * `json: true` marshals the field as a JSON text column; `bool: true` maps
 * SQLite's 0/1 integers to booleans.
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
      row[spec.column] = value ? 1 : 0;
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
    if (spec.json) item[field] = JSON.parse(raw as string);
    else if (spec.bool) item[field] = raw === 1 || raw === true;
    else item[field] = raw;
  }
  return item as T;
}

/** D1-backed implementation of TenantRepository<T>, driven by a column Schema. */
export class D1TenantRepository<T extends { id: string; organizationId: string }> implements TenantRepository<T> {
  constructor(
    private readonly db: D1Database,
    private readonly table: string,
    private readonly schema: Schema<T>,
  ) {}

  async list(organizationId: string, options?: ListOptions<T>): Promise<T[]> {
    let sql = `SELECT * FROM ${this.table} WHERE organization_id = ?`;
    const params: unknown[] = [organizationId];
    if (options?.where) {
      for (const [field, value] of Object.entries(options.where)) {
        const spec = this.schema[field as keyof T & string];
        if (!spec || value === undefined) continue;
        sql += ` AND ${spec.column} = ?`;
        params.push(spec.bool ? (value ? 1 : 0) : value);
      }
    }
    if (options?.orderBy) {
      const spec = this.schema[options.orderBy];
      if (spec) sql += ` ORDER BY ${spec.column} ${options.direction === "desc" ? "DESC" : "ASC"}`;
    }
    if (options?.limit !== undefined) sql += ` LIMIT ${Number(options.limit)}`;
    if (options?.offset !== undefined) sql += ` OFFSET ${Number(options.offset)}`;
    const { results } = await this.db.prepare(sql).bind(...params).all<Record<string, unknown>>();
    return (results ?? []).map((r) => fromRow<T>(r, this.schema));
  }

  async get(organizationId: string, id: string): Promise<T | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${this.table} WHERE organization_id = ? AND id = ?`)
      .bind(organizationId, id)
      .first<Record<string, unknown>>();
    return row ? fromRow<T>(row, this.schema) : null;
  }

  async insert(item: T): Promise<T> {
    const row = toRow(item as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    const placeholders = columns.map(() => "?").join(", ");
    await this.db
      .prepare(`INSERT INTO ${this.table} (${columns.join(", ")}) VALUES (${placeholders})`)
      .bind(...columns.map((c) => row[c]))
      .run();
    return item;
  }

  async update(organizationId: string, id: string, patch: Partial<T>): Promise<T> {
    const row = toRow(patch as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    if (columns.length === 0) return (await this.get(organizationId, id))!;
    const set = columns.map((c) => `${c} = ?`).join(", ");
    await this.db
      .prepare(`UPDATE ${this.table} SET ${set} WHERE organization_id = ? AND id = ?`)
      .bind(...columns.map((c) => row[c]), organizationId, id)
      .run();
    return (await this.get(organizationId, id))!;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM ${this.table} WHERE organization_id = ? AND id = ?`).bind(organizationId, id).run();
  }

  async count(organizationId: string, where?: Partial<T>): Promise<number> {
    let sql = `SELECT COUNT(*) as n FROM ${this.table} WHERE organization_id = ?`;
    const params: unknown[] = [organizationId];
    if (where) {
      for (const [field, value] of Object.entries(where)) {
        const spec = this.schema[field as keyof T & string];
        if (!spec || value === undefined) continue;
        sql += ` AND ${spec.column} = ?`;
        params.push(spec.bool ? (value ? 1 : 0) : value);
      }
    }
    const row = await this.db.prepare(sql).bind(...params).first<{ n: number }>();
    return row?.n ?? 0;
  }
}

/** D1-backed implementation of KeyedRepository<T> (users, organizations — no organization_id column). */
export class D1KeyedRepository<T extends { id: string }> implements KeyedRepository<T> {
  constructor(
    private readonly db: D1Database,
    private readonly table: string,
    private readonly schema: Schema<T>,
  ) {}

  async list(options?: ListOptions<T>): Promise<T[]> {
    let sql = `SELECT * FROM ${this.table} WHERE 1=1`;
    const params: unknown[] = [];
    if (options?.where) {
      for (const [field, value] of Object.entries(options.where)) {
        const spec = this.schema[field as keyof T & string];
        if (!spec || value === undefined) continue;
        sql += ` AND ${spec.column} = ?`;
        params.push(value);
      }
    }
    if (options?.limit !== undefined) sql += ` LIMIT ${Number(options.limit)}`;
    const { results } = await this.db.prepare(sql).bind(...params).all<Record<string, unknown>>();
    return (results ?? []).map((r) => fromRow<T>(r, this.schema));
  }

  async get(id: string): Promise<T | null> {
    const row = await this.db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    return row ? fromRow<T>(row, this.schema) : null;
  }

  async insert(item: T): Promise<T> {
    const row = toRow(item as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    await this.db
      .prepare(`INSERT INTO ${this.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
      .bind(...columns.map((c) => row[c]))
      .run();
    return item;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const row = toRow(patch as Record<string, unknown>, this.schema);
    const columns = Object.keys(row);
    if (columns.length > 0) {
      await this.db
        .prepare(`UPDATE ${this.table} SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
        .bind(...columns.map((c) => row[c]), id)
        .run();
    }
    return (await this.get(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM ${this.table} WHERE id = ?`).bind(id).run();
  }
}
