import type { Outlet } from "../../shared/types";
import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

function rowToOutlet(row: any): Outlet {
  return { ...row, settings: row.settings ? JSON.parse(row.settings) : null };
}

export async function createOutlet(
  db: AppDatabase,
  tenantId: string,
  input: {
    name: string;
    timezone: string;
    address?: string;
    phone?: string;
    currency: string;
    settings?: Record<string, unknown>;
  },
): Promise<Outlet> {
  const id = newId();
  const created_at = now();
  await db
    .prepare(
      `INSERT INTO outlets (id, tenant_id, name, timezone, address, phone, currency, settings, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      input.name,
      input.timezone,
      input.address ?? null,
      input.phone ?? null,
      input.currency,
      input.settings ? JSON.stringify(input.settings) : null,
      created_at,
    )
    .run();
  return {
    id,
    tenant_id: tenantId,
    name: input.name,
    timezone: input.timezone,
    address: input.address ?? null,
    phone: input.phone ?? null,
    currency: input.currency,
    settings: input.settings ?? null,
    created_at,
  };
}

export async function listOutlets(db: AppDatabase, tenantId: string): Promise<Outlet[]> {
  const { results } = await db
    .prepare(`SELECT * FROM outlets WHERE tenant_id = ? ORDER BY created_at ASC`)
    .bind(tenantId)
    .all();
  return (results ?? []).map(rowToOutlet);
}

export async function getOutlet(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
): Promise<Outlet | null> {
  const row = await db
    .prepare(`SELECT * FROM outlets WHERE tenant_id = ? AND id = ?`)
    .bind(tenantId, outletId)
    .first();
  return row ? rowToOutlet(row) : null;
}
