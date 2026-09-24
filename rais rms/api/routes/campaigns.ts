import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { createCampaignSchema, sendCampaignSchema } from "../../shared/schemas";
import {
  campaignStats,
  createCampaign,
  getCampaign,
  hasRecentCampaignSend,
  listCampaigns,
  recordCampaignSend,
  setCampaignStatus,
} from "../db/campaigns";
import { getGuest } from "../db/guests";
import { sendEmail } from "../lib/notify";
import { badRequest, notFound } from "../lib/errors";

export const campaignRoutes = new Hono<AppEnv>();
campaignRoutes.use("*", requireRole(ROLE_GROUPS.MARKETING));

campaignRoutes.get("/", async (c) => {
  const campaigns = await listCampaigns(c.env.DB, c.get("tenantId"));
  return c.json({ ok: true, data: campaigns });
});

campaignRoutes.post("/", zValidator("json", createCampaignSchema), async (c) => {
  const input = getValidated<z.infer<typeof createCampaignSchema>>(c, "json");
  const campaign = await createCampaign(c.env.DB, c.get("tenantId"), input);
  return c.json({ ok: true, data: campaign }, 201);
});

campaignRoutes.get("/:id", async (c) => {
  const campaign = await getCampaign(c.env.DB, c.get("tenantId"), c.req.param("id"));
  if (!campaign) throw notFound();
  const stats = await campaignStats(c.env.DB, c.get("tenantId"), campaign.id);
  return c.json({ ok: true, data: { ...campaign, stats } });
});

const statusSchema = z.object({ status: z.enum(["draft", "active", "paused", "archived"]) });

campaignRoutes.patch("/:id/status", zValidator("json", statusSchema), async (c) => {
  const input = getValidated<z.infer<typeof statusSchema>>(c, "json");
  const changed = await setCampaignStatus(c.env.DB, c.get("tenantId"), c.req.param("id"), input.status);
  if (!changed) throw notFound();
  return c.json({ ok: true, data: { updated: true } });
});

/** Manual send to an explicit guest list — only channel implemented end-to-end today is email. */
campaignRoutes.post("/:id/send", zValidator("json", sendCampaignSchema), async (c) => {
  const tenantId = c.get("tenantId");
  const campaign = await getCampaign(c.env.DB, tenantId, c.req.param("id"));
  if (!campaign) throw notFound();
  if (campaign.channel !== "email") {
    throw badRequest(`${campaign.channel} campaigns aren't wired to a provider yet — only email sends today`);
  }

  const input = getValidated<z.infer<typeof sendCampaignSchema>>(c, "json");
  if (!input.guestIds?.length) throw badRequest("guestIds is required for a manual send");

  let sent = 0;
  for (const guestId of input.guestIds) {
    const guest = await getGuest(c.env.DB, tenantId, guestId);
    if (!guest?.email || !guest.marketing_consent) continue;

    const already = await hasRecentCampaignSend(c.env.DB, tenantId, campaign.id, guestId, Date.now() - 24 * 3600 * 1000);
    if (already) continue;

    await sendEmail(c.env.DB, c.env, tenantId, {
      to: guest.email,
      subject: campaign.subject ?? "A message from your favorite restaurant",
      html: campaign.body,
      kind: "campaign",
      referenceId: `${campaign.id}:${guestId}`,
    });
    await recordCampaignSend(c.env.DB, tenantId, campaign.id, guestId);
    sent++;
  }

  return c.json({ ok: true, data: { sent } });
});
