import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  acceptOffer,
  createOffer,
  listOffersForJob,
  rejectOffer,
  withdrawOffer,
} from "../../db/repositories/jobOffers";
import { appendAuditLog } from "../../db/repositories/auditLog";
import { CONSENT_TEXTS, isKnownConsentVersion } from "../consentText";
import { getRequestContext } from "../requestContext";

const offers = new Hono<AppEnv>();
offers.use("*", requireAuth);

const createSchema = z.object({
  jobId: z.string(),
  proposedFeeMinor: z.number().int().positive(),
  message: z.string().optional(),
  tollAcknowledgementVersion: z.string(),
});

offers.post("/", requireRole("runner"), async (c) => {
  const session = c.get("session")!;
  const body = createSchema.parse(await c.req.json());
  if (!isKnownConsentVersion(body.tollAcknowledgementVersion)) {
    return c.json({ error: "unknown tollAcknowledgementVersion" }, 400);
  }
  const db = await createDb(c.env);
  const ctx = getRequestContext();

  // Same toll-cost gate as claiming outright (CLAUDE.md "Price
  // negotiation"): a counter-offer commits the runner just as much as a
  // claim would.
  await appendAuditLog(db, {
    actorUserId: session.userId,
    actorRole: session.activeRole,
    groupId: session.groupId,
    action: "consent.toll_ack",
    entityType: "job",
    entityId: body.jobId,
    afterJson: {
      consentVersion: body.tollAcknowledgementVersion,
      text: CONSENT_TEXTS[body.tollAcknowledgementVersion],
    },
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
    requestId: c.get("requestId"),
    result: "success",
  });

  const offer = await createOffer(db, {
    groupId: session.groupId,
    jobId: body.jobId,
    runnerUserId: session.userId,
    proposedFeeMinor: body.proposedFeeMinor,
    message: body.message,
  });
  return c.json(offer, 201);
});

offers.get("/for-job/:jobId", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await listOffersForJob(db, session.groupId, c.req.param("jobId")));
});

offers.post("/:id/accept", requireRole("purchaser"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await acceptOffer(db, session.groupId, c.req.param("id")));
});

offers.post("/:id/reject", requireRole("purchaser"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  await rejectOffer(db, session.groupId, c.req.param("id"));
  return c.json({ ok: true });
});

offers.post("/:id/withdraw", requireRole("runner"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  await withdrawOffer(db, session.groupId, c.req.param("id"));
  return c.json({ ok: true });
});

export default offers;
