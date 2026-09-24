import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireCronSecret } from "../middleware/cronAuth";
import { listActiveTenants } from "../db/tenants";
import { listOutlets } from "../db/outlets";
import { getGuest } from "../db/guests";
import { createManageToken } from "../lib/manageToken";
import { alreadyNotified, sendEmail, reservationReminderEmail } from "../lib/notify";
import {
  guestsWithBirthdayToday,
  guestsForWinback,
  topSpenderGuests,
  listActiveCampaignsByTrigger,
  hasRecentCampaignSend,
  recordCampaignSend,
} from "../db/campaigns";
import type { CampaignTrigger } from "../db/campaigns";

export const cronRoutes = new Hono<AppEnv>();
cronRoutes.use("*", requireCronSecret);

/** Intended to run hourly. Reminds guests of reservations starting in the next 20-28h, once. */
cronRoutes.post("/reminders", async (c) => {
  const tenants = await listActiveTenants(c.env.DB);
  const windowStart = Date.now() + 20 * 3600 * 1000;
  const windowEnd = Date.now() + 28 * 3600 * 1000;
  let remindersSent = 0;

  for (const tenant of tenants) {
    const outlets = await listOutlets(c.env.DB, tenant.id);
    for (const outlet of outlets) {
      const { results } = await c.env.DB.prepare(
        `SELECT id, guest_id, starts_at, party_size FROM reservations
         WHERE tenant_id = ? AND outlet_id = ? AND status = 'booked' AND starts_at BETWEEN ? AND ?`,
      )
        .bind(tenant.id, outlet.id, windowStart, windowEnd)
        .all<{ id: string; guest_id: string | null; starts_at: number; party_size: number }>();

      for (const reservation of results ?? []) {
        if (!reservation.guest_id) continue;
        const already = await alreadyNotified(c.env.DB, tenant.id, "reservation_reminder", reservation.id);
        if (already) continue;

        const guest = await getGuest(c.env.DB, tenant.id, reservation.guest_id);
        if (!guest?.email) continue;

        const token = await createManageToken(c.env.JWT_SECRET, tenant.id, reservation.id);
        const manageUrl = `${c.env.PUBLIC_APP_URL ?? ""}/book/${tenant.slug}/manage/${reservation.id}?token=${token}`;
        const { subject, html } = reservationReminderEmail({
          outletName: outlet.name,
          guestName: guest.name,
          startsAt: reservation.starts_at,
          partySize: reservation.party_size,
          manageUrl,
        });
        const result = await sendEmail(c.env.DB, c.env, tenant.id, {
          to: guest.email,
          subject,
          html,
          kind: "reservation_reminder",
          referenceId: reservation.id,
        });
        if (result.sent) remindersSent++;
      }
    }
  }

  return c.json({ ok: true, data: { remindersSent } });
});

/** Intended to run daily. Fires birthday/winback/top_spender campaigns for every active tenant. */
cronRoutes.post("/campaigns", async (c) => {
  const tenants = await listActiveTenants(c.env.DB);
  let totalSent = 0;

  const segmentFor: Record<CampaignTrigger, (tenantId: string) => Promise<{ id: string; email: string | null }[]>> = {
    birthday: (tenantId) => guestsWithBirthdayToday(c.env.DB, tenantId),
    winback: (tenantId) => guestsForWinback(c.env.DB, tenantId, 90),
    top_spender: (tenantId) => topSpenderGuests(c.env.DB, tenantId, 20),
    manual: async () => [],
  };

  for (const trigger of ["birthday", "winback", "top_spender"] as CampaignTrigger[]) {
    const campaigns = await listActiveCampaignsByTrigger(c.env.DB, trigger);
    for (const campaign of campaigns) {
      const tenant = tenants.find((t) => t.id === campaign.tenant_id);
      if (!tenant || campaign.channel !== "email") continue;

      const guests = await segmentFor[trigger](tenant.id);
      for (const guest of guests) {
        if (!guest.email) continue;
        const recent = await hasRecentCampaignSend(c.env.DB, tenant.id, campaign.id, guest.id, Date.now() - 300 * 24 * 3600 * 1000);
        if (recent) continue;

        const result = await sendEmail(c.env.DB, c.env, tenant.id, {
          to: guest.email,
          subject: campaign.subject ?? "A message from your favorite restaurant",
          html: campaign.body,
          kind: "campaign",
          referenceId: `${campaign.id}:${guest.id}:${new Date().getFullYear()}`,
        });
        if (result.sent) {
          await recordCampaignSend(c.env.DB, tenant.id, campaign.id, guest.id);
          totalSent++;
        }
      }
    }
  }

  return c.json({ ok: true, data: { totalSent } });
});
