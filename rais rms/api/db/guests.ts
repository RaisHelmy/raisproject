import type { Guest } from "../../shared/types";
import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

function rowToGuest(row: any): Guest {
  return { ...row, marketing_consent: !!row.marketing_consent };
}

export async function createGuest(
  db: AppDatabase,
  tenantId: string,
  input: {
    name: string;
    email?: string;
    phone?: string;
    marketingConsent?: boolean;
    dob?: string;
    tags?: string[];
  },
): Promise<Guest> {
  const id = newId();
  const created_at = now();
  await db
    .prepare(
      `INSERT INTO guests (id, tenant_id, name, email, phone, marketing_consent, dob, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.marketingConsent ? 1 : 0,
      input.dob ?? null,
      created_at,
      created_at,
    )
    .run();

  if (input.tags?.length) {
    const stmts = input.tags.map((tag) =>
      db
        .prepare(`INSERT INTO guest_tags (id, tenant_id, guest_id, tag) VALUES (?, ?, ?, ?)`)
        .bind(newId(), tenantId, id, tag),
    );
    await db.batch(stmts);
  }

  return {
    id,
    tenant_id: tenantId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    marketing_consent: !!input.marketingConsent,
    dob: input.dob ?? null,
    created_at,
  };
}

export async function listGuests(
  db: AppDatabase,
  tenantId: string,
  opts: { page: number; pageSize: number; search?: string },
): Promise<{ items: Guest[]; total: number }> {
  const offset = (opts.page - 1) * opts.pageSize;
  const searchClause = opts.search ? `AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)` : "";
  const params: unknown[] = [tenantId];
  if (opts.search) {
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }

  const { results } = await db
    .prepare(
      `SELECT * FROM guests WHERE tenant_id = ? ${searchClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(...params, opts.pageSize, offset)
    .all();

  const countRow = await db
    .prepare(`SELECT COUNT(*) as c FROM guests WHERE tenant_id = ? ${searchClause}`)
    .bind(...params)
    .first<{ c: number }>();

  return { items: (results ?? []).map(rowToGuest), total: countRow?.c ?? 0 };
}

export async function getGuest(
  db: AppDatabase,
  tenantId: string,
  guestId: string,
): Promise<Guest | null> {
  const row = await db
    .prepare(`SELECT * FROM guests WHERE tenant_id = ? AND id = ?`)
    .bind(tenantId, guestId)
    .first();
  return row ? rowToGuest(row) : null;
}

export async function updateGuest(
  db: AppDatabase,
  tenantId: string,
  guestId: string,
  input: Partial<{
    name: string;
    email: string;
    phone: string;
    marketingConsent: boolean;
    dob: string;
  }>,
): Promise<Guest | null> {
  const existing = await getGuest(db, tenantId, guestId);
  if (!existing) return null;

  const next = {
    name: input.name ?? existing.name,
    email: input.email ?? existing.email,
    phone: input.phone ?? existing.phone,
    marketing_consent:
      input.marketingConsent !== undefined ? (input.marketingConsent ? 1 : 0) : existing.marketing_consent ? 1 : 0,
    dob: input.dob ?? existing.dob,
  };

  await db
    .prepare(
      `UPDATE guests SET name = ?, email = ?, phone = ?, marketing_consent = ?, dob = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
    )
    .bind(next.name, next.email, next.phone, next.marketing_consent, next.dob, now(), tenantId, guestId)
    .run();

  return getGuest(db, tenantId, guestId);
}

export async function getGuestTags(db: AppDatabase, tenantId: string, guestId: string): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT tag FROM guest_tags WHERE tenant_id = ? AND guest_id = ?`)
    .bind(tenantId, guestId)
    .all<{ tag: string }>();
  return (results ?? []).map((r) => r.tag);
}

export interface GuestNote {
  id: string;
  tenant_id: string;
  guest_id: string;
  author_id: string | null;
  note: string;
  created_at: number;
}

export async function addGuestNote(
  db: AppDatabase,
  tenantId: string,
  guestId: string,
  input: { authorId: string | null; note: string },
): Promise<GuestNote> {
  const id = newId();
  const created_at = now();
  await db
    .prepare(
      `INSERT INTO guest_notes (id, tenant_id, guest_id, author_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, tenantId, guestId, input.authorId, input.note, created_at)
    .run();
  return { id, tenant_id: tenantId, guest_id: guestId, author_id: input.authorId, note: input.note, created_at };
}

export async function listGuestNotes(db: AppDatabase, tenantId: string, guestId: string): Promise<GuestNote[]> {
  const { results } = await db
    .prepare(`SELECT * FROM guest_notes WHERE tenant_id = ? AND guest_id = ? ORDER BY created_at DESC`)
    .bind(tenantId, guestId)
    .all<GuestNote>();
  return results ?? [];
}

export interface GuestVisit {
  id: string;
  outlet_id: string;
  starts_at: number;
  party_size: number;
  status: string;
}

/** Cross-outlet visit history for a guest — supports UMAI's group-level guest view. */
export async function listGuestVisits(db: AppDatabase, tenantId: string, guestId: string): Promise<GuestVisit[]> {
  const { results } = await db
    .prepare(
      `SELECT id, outlet_id, starts_at, party_size, status FROM reservations
       WHERE tenant_id = ? AND guest_id = ? ORDER BY starts_at DESC LIMIT 100`,
    )
    .bind(tenantId, guestId)
    .all<GuestVisit>();
  return results ?? [];
}
