import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export interface LoyaltyAccount {
  id: string;
  tenant_id: string;
  guest_id: string;
  points_balance: number;
  tier: string;
  created_at: number;
  updated_at: number;
}

const TIER_THRESHOLDS: [minPoints: number, tier: string][] = [
  [0, "member"],
  [500, "silver"],
  [1500, "gold"],
  [5000, "platinum"],
];

function tierForPoints(points: number): string {
  let tier = "member";
  for (const [min, name] of TIER_THRESHOLDS) {
    if (points >= min) tier = name;
  }
  return tier;
}

async function getOrCreateAccount(db: AppDatabase, tenantId: string, guestId: string): Promise<LoyaltyAccount> {
  const existing = await db
    .prepare(`SELECT * FROM loyalty_accounts WHERE tenant_id = ? AND guest_id = ?`)
    .bind(tenantId, guestId)
    .first<LoyaltyAccount>();
  if (existing) return existing;

  const id = newId();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO loyalty_accounts (id, tenant_id, guest_id, points_balance, tier, created_at, updated_at)
       VALUES (?, ?, ?, 0, 'member', ?, ?)`,
    )
    .bind(id, tenantId, guestId, ts, ts)
    .run();
  return { id, tenant_id: tenantId, guest_id: guestId, points_balance: 0, tier: "member", created_at: ts, updated_at: ts };
}

export async function getLoyaltyAccount(db: AppDatabase, tenantId: string, guestId: string): Promise<LoyaltyAccount> {
  return getOrCreateAccount(db, tenantId, guestId);
}

/**
 * Awards or deducts points, idempotent per (reason, referenceId) so a retried
 * webhook/status-update can't double-award. Positive delta = earn, negative = redeem.
 */
export async function adjustLoyaltyPoints(
  db: AppDatabase,
  tenantId: string,
  guestId: string,
  input: { delta: number; reason: string; referenceId?: string },
): Promise<LoyaltyAccount> {
  if (input.referenceId) {
    const existing = await db
      .prepare(
        `SELECT id FROM loyalty_transactions WHERE tenant_id = ? AND guest_id = ? AND reason = ? AND reference_id = ? LIMIT 1`,
      )
      .bind(tenantId, guestId, input.reason, input.referenceId)
      .first();
    if (existing) return getOrCreateAccount(db, tenantId, guestId);
  }

  const account = await getOrCreateAccount(db, tenantId, guestId);
  const nextBalance = Math.max(0, account.points_balance + input.delta);
  const nextTier = tierForPoints(nextBalance);

  await db.batch([
    db
      .prepare(`UPDATE loyalty_accounts SET points_balance = ?, tier = ?, updated_at = ? WHERE tenant_id = ? AND guest_id = ?`)
      .bind(nextBalance, nextTier, now(), tenantId, guestId),
    db
      .prepare(
        `INSERT INTO loyalty_transactions (id, tenant_id, guest_id, delta, reason, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(newId(), tenantId, guestId, input.delta, input.reason, input.referenceId ?? null, now()),
  ]);

  return { ...account, points_balance: nextBalance, tier: nextTier };
}

export interface LoyaltyTransaction {
  id: string;
  delta: number;
  reason: string;
  reference_id: string | null;
  created_at: number;
}

export async function listLoyaltyTransactions(db: AppDatabase, tenantId: string, guestId: string): Promise<LoyaltyTransaction[]> {
  const { results } = await db
    .prepare(`SELECT * FROM loyalty_transactions WHERE tenant_id = ? AND guest_id = ? ORDER BY created_at DESC LIMIT 100`)
    .bind(tenantId, guestId)
    .all<LoyaltyTransaction>();
  return results ?? [];
}

/** 1 point per full currency unit spent (e.g. $1 = 1 point), a simple default accrual rate. */
export function pointsForPartySize(partySize: number): number {
  return partySize * 10;
}
