import { newId, now } from "../lib/ids";
import type { AppDatabase } from "../lib/db";

export type CampaignChannel = "email" | "sms" | "whatsapp";
export type CampaignTrigger = "birthday" | "winback" | "top_spender" | "manual";
export type CampaignStatus = "draft" | "active" | "paused" | "archived";

export interface Campaign {
  id: string;
  tenant_id: string;
  channel: CampaignChannel;
  segment: Record<string, unknown> | null;
  trigger: CampaignTrigger;
  status: CampaignStatus;
  subject: string | null;
  body: string;
  created_at: number;
}

function rowToCampaign(row: any): Campaign {
  return { ...row, segment: row.segment ? JSON.parse(row.segment) : null };
}

export async function createCampaign(
  db: AppDatabase,
  tenantId: string,
  input: {
    channel: CampaignChannel;
    trigger: CampaignTrigger;
    segment?: Record<string, unknown>;
    subject?: string;
    body: string;
  },
): Promise<Campaign> {
  const id = newId();
  const created_at = now();
  // Subject/body are stored in `segment` JSON alongside the actual segment filter,
  // since the campaigns table (per CLAUDE.md's schema) only has a single `segment` JSON column.
  const payload = { filter: input.segment ?? {}, subject: input.subject ?? null, body: input.body };
  await db
    .prepare(
      `INSERT INTO campaigns (id, tenant_id, channel, segment, trigger, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
    )
    .bind(id, tenantId, input.channel, JSON.stringify(payload), input.trigger, created_at)
    .run();
  return {
    id,
    tenant_id: tenantId,
    channel: input.channel,
    segment: payload.filter,
    trigger: input.trigger,
    status: "draft",
    subject: input.subject ?? null,
    body: input.body,
    created_at,
  };
}

function unpackCampaign(row: any): Campaign {
  const raw = row.segment ? JSON.parse(row.segment) : { filter: {}, subject: null, body: "" };
  return {
    ...row,
    segment: raw.filter ?? {},
    subject: raw.subject ?? null,
    body: raw.body ?? "",
  };
}

export async function listCampaigns(db: AppDatabase, tenantId: string): Promise<Campaign[]> {
  const { results } = await db
    .prepare(`SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC`)
    .bind(tenantId)
    .all();
  return (results ?? []).map(unpackCampaign);
}

export async function getCampaign(db: AppDatabase, tenantId: string, id: string): Promise<Campaign | null> {
  const row = await db.prepare(`SELECT * FROM campaigns WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).first();
  return row ? unpackCampaign(row) : null;
}

export async function setCampaignStatus(
  db: AppDatabase,
  tenantId: string,
  id: string,
  status: CampaignStatus,
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE campaigns SET status = ? WHERE tenant_id = ? AND id = ?`)
    .bind(status, tenantId, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function listActiveCampaignsByTrigger(
  db: AppDatabase,
  trigger: CampaignTrigger,
): Promise<Campaign[]> {
  const { results } = await db
    .prepare(`SELECT * FROM campaigns WHERE status = 'active' AND trigger = ?`)
    .bind(trigger)
    .all();
  return (results ?? []).map(unpackCampaign);
}

export async function recordCampaignSend(
  db: AppDatabase,
  tenantId: string,
  campaignId: string,
  guestId: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO campaign_sends (id, tenant_id, campaign_id, guest_id, sent_at, opened, converted, revenue_minor)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0)`,
    )
    .bind(newId(), tenantId, campaignId, guestId, now())
    .run();
}

export async function hasRecentCampaignSend(
  db: AppDatabase,
  tenantId: string,
  campaignId: string,
  guestId: string,
  sinceMs: number,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM campaign_sends WHERE tenant_id = ? AND campaign_id = ? AND guest_id = ? AND sent_at >= ? LIMIT 1`,
    )
    .bind(tenantId, campaignId, guestId, sinceMs)
    .first();
  return !!row;
}

export interface CampaignStats {
  sends: number;
  opens: number;
  conversions: number;
  revenueMinor: number;
}

export async function campaignStats(db: AppDatabase, tenantId: string, campaignId: string): Promise<CampaignStats> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as sends, SUM(opened) as opens, SUM(converted) as conversions, SUM(revenue_minor) as revenue
       FROM campaign_sends WHERE tenant_id = ? AND campaign_id = ?`,
    )
    .bind(tenantId, campaignId)
    .first<{ sends: number; opens: number; conversions: number; revenue: number }>();
  return {
    sends: row?.sends ?? 0,
    opens: row?.opens ?? 0,
    conversions: row?.conversions ?? 0,
    revenueMinor: row?.revenue ?? 0,
  };
}

export interface SegmentGuest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/** Guests whose birthday (month+day of `dob`) is today, tenant-wide. */
export async function guestsWithBirthdayToday(db: AppDatabase, tenantId: string): Promise<SegmentGuest[]> {
  const today = new Date();
  const md = `${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const { results } = await db
    .prepare(
      `SELECT id, name, email, phone FROM guests
       WHERE tenant_id = ? AND dob IS NOT NULL AND substr(dob, 6, 5) = ? AND marketing_consent = 1`,
    )
    .bind(tenantId, md)
    .all<SegmentGuest>();
  return results ?? [];
}

/** Guests whose most recent completed reservation was more than `daysAgo` days ago. */
export async function guestsForWinback(db: AppDatabase, tenantId: string, daysAgo: number): Promise<SegmentGuest[]> {
  const cutoff = Date.now() - daysAgo * 24 * 3600 * 1000;
  const { results } = await db
    .prepare(
      `SELECT g.id as id, g.name as name, g.email as email, g.phone as phone
       FROM guests g
       WHERE g.tenant_id = ? AND g.marketing_consent = 1
         AND g.id IN (
           SELECT guest_id FROM reservations
           WHERE tenant_id = ? AND status = 'completed' AND guest_id IS NOT NULL
           GROUP BY guest_id HAVING MAX(starts_at) < ?
         )`,
    )
    .bind(tenantId, tenantId, cutoff)
    .all<SegmentGuest>();
  return results ?? [];
}

/** Top-spending guests by captured payment volume. */
export async function topSpenderGuests(db: AppDatabase, tenantId: string, limit = 20): Promise<SegmentGuest[]> {
  const { results } = await db
    .prepare(
      `SELECT g.id as id, g.name as name, g.email as email, g.phone as phone
       FROM guests g
       JOIN (
         SELECT guest_id, SUM(amount_minor) as total FROM payments
         WHERE tenant_id = ? AND status = 'captured' AND guest_id IS NOT NULL
         GROUP BY guest_id ORDER BY total DESC LIMIT ?
       ) top ON top.guest_id = g.id
       WHERE g.tenant_id = ? AND g.marketing_consent = 1`,
    )
    .bind(tenantId, limit, tenantId)
    .all<SegmentGuest>();
  return results ?? [];
}
