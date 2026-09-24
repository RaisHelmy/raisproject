import type { WaitlistEntry } from "../../shared/types";
import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export async function createWaitlistEntry(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  input: { guestId: string | null; partySize: number; quotedWait?: number },
): Promise<WaitlistEntry> {
  const id = newId();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO waitlist_entries (id, tenant_id, outlet_id, guest_id, party_size, quoted_wait, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`,
    )
    .bind(id, tenantId, outletId, input.guestId, input.partySize, input.quotedWait ?? null, ts, ts)
    .run();
  return {
    id,
    tenant_id: tenantId,
    outlet_id: outletId,
    guest_id: input.guestId,
    party_size: input.partySize,
    quoted_wait: input.quotedWait ?? null,
    status: "waiting",
    created_at: ts,
  };
}

export async function listWaitlist(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
): Promise<WaitlistEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM waitlist_entries WHERE tenant_id = ? AND outlet_id = ? AND status IN ('waiting','notified')
       ORDER BY created_at ASC`,
    )
    .bind(tenantId, outletId)
    .all<WaitlistEntry>();
  return results ?? [];
}

export async function updateWaitlistStatus(
  db: AppDatabase,
  tenantId: string,
  outletId: string,
  id: string,
  status: WaitlistEntry["status"],
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE waitlist_entries SET status = ?, updated_at = ? WHERE tenant_id = ? AND outlet_id = ? AND id = ?`,
    )
    .bind(status, now(), tenantId, outletId, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
