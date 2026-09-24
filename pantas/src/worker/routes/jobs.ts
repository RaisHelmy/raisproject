import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  cancelJob,
  claimJob,
  createDraftJob,
  disputeJob,
  getJobById,
  listJobsForGroup,
  markDelivered,
  markInTransit,
  markPickedUp,
  postJob,
} from "../../db/repositories/jobs";
import { settleJob } from "../../db/services/settlement";
import { isBlockedFromCashJobs } from "../../db/services/payoutGenerator";
import { appendAuditLog } from "../../db/repositories/auditLog";
import { getUserById } from "../../db/repositories/users";
import { reportNonPaymentAndMaybeSuspend } from "../../db/services/nonPaymentGuard";
import { CONSENT_TEXTS, isKnownConsentVersion } from "../consentText";
import { getRequestContext } from "../requestContext";
import { getDurableObjectStub } from "../durableObjects/liveLocationRoom";

/** CLAUDE.md: "Stop tracking the moment the job reaches a terminal state." */
async function stopTracking(env: Env, jobId: string) {
  try {
    const stub = getDurableObjectStub(env, jobId);
    await stub.fetch("https://do/stop", { method: "POST" });
  } catch (err) {
    console.error(`failed to stop live tracking for job ${jobId}`, err);
  }
}

const jobs = new Hono<AppEnv>();
jobs.use("*", requireAuth);

/**
 * Configurable, not hardcoded logic-wise (CLAUDE.md: "Build this threshold
 * check into job matching from the start") — the number itself is a policy
 * knob an admin should be able to tune per group; a single platform-wide
 * constant here is the MVP placeholder for that, not a permanent decision.
 */
const CASH_BLOCK_THRESHOLD_MINOR = 5000; // RM 50.00

const createJobSchema = z.object({
  groupId: z.string().nullable().optional(),
  type: z.enum(["food_order", "item_order", "fetch", "delivery", "ride"]),
  paymentMethod: z.enum(["cash", "gateway"]),
  deliveryFeeMinor: z.number().int().positive(),
  declaredValueMinor: z.number().int().positive().optional(),
  isAnonymousJob: z.boolean().optional(),
  postImmediately: z.boolean().optional(),
  codConsentVersion: z.string().optional(),
});

jobs.post("/", requireRole("purchaser"), async (c) => {
  const session = c.get("session")!;
  const body = createJobSchema.parse(await c.req.json());
  const db = await createDb(c.env);

  // Second of the two required COD warnings — the first is at anonymity
  // opt-in (see routes/auth.ts). Every cash job gets this one at checkout,
  // anonymous or not (CLAUDE.md "Cash-on-delivery risk flow").
  if (body.paymentMethod === "cash") {
    if (!body.codConsentVersion || !isKnownConsentVersion(body.codConsentVersion)) {
      return c.json({ error: "codConsentVersion required when paying cash" }, 400);
    }
    const ctx = getRequestContext();
    await appendAuditLog(db, {
      actorUserId: session.userId,
      actorRole: session.activeRole,
      groupId: session.groupId,
      action: "consent.cod_checkout_ack",
      entityType: "user",
      entityId: session.userId,
      afterJson: {
        consentVersion: body.codConsentVersion,
        text: CONSENT_TEXTS[body.codConsentVersion],
      },
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "success",
    });
  }

  const job = await createDraftJob(db, {
    groupId: body.groupId ?? session.groupId,
    type: body.type,
    purchaserUserId: session.userId,
    paymentMethod: body.paymentMethod,
    deliveryFeeMinor: body.deliveryFeeMinor,
    declaredValueMinor: body.declaredValueMinor,
    isAnonymousJob: body.isAnonymousJob,
  });
  if (body.postImmediately ?? true) {
    const posted = await postJob(db, job.groupId, job.id);
    return c.json(posted, 201);
  }
  return c.json(job, 201);
});

jobs.post("/:id/post", requireRole("purchaser"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  const posted = await postJob(db, session.groupId, c.req.param("id"));
  return c.json(posted);
});

/**
 * Runner's open job feed: posted jobs only, with cash-blocked runners and
 * (per CLAUDE.md "Cash-on-delivery risk flow") anonymous-COD jobs filtered
 * out unless this runner has opted in via `auto_reject_anonymous_cod`.
 */
jobs.get("/feed", requireRole("runner"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  const [all, runner] = await Promise.all([
    listJobsForGroup(db, session.groupId),
    getUserById(db, session.userId),
  ]);
  const blocked = await isBlockedFromCashJobs(
    db,
    session.groupId,
    session.userId,
    CASH_BLOCK_THRESHOLD_MINOR,
  );
  const feed = all.filter((j) => {
    if (j.status !== "posted") return false;
    if (blocked && j.paymentMethod === "cash") return false;
    const isAnonymousCod = j.isAnonymousJob && j.paymentMethod === "cash";
    if (isAnonymousCod && (runner?.autoRejectAnonymousCod ?? true)) return false;
    return true;
  });
  return c.json(feed);
});

jobs.get("/mine", requireRole("purchaser"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  const all = await listJobsForGroup(db, session.groupId);
  return c.json(all.filter((j) => j.purchaserUserId === session.userId));
});

jobs.get("/:id", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  const job = await getJobById(db, session.groupId, c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  return c.json(job);
});

const claimSchema = z.object({
  tollAcknowledgementVersion: z.string().optional(),
});

jobs.post("/:id/claim", requireRole("runner"), async (c) => {
  const session = c.get("session")!;
  const body = claimSchema.parse(await c.req.json().catch(() => ({})));
  const db = await createDb(c.env);
  const job = await getJobById(db, session.groupId, c.req.param("id"));

  if (job?.type === "ride" || job?.type === "delivery" || job?.type === "fetch") {
    // Toll acknowledgement gate (CLAUDE.md "Ride comfort & safety
    // preferences" / "Emergency"): required before claim, logged as a
    // consent event, not tracked as a toll cost field.
    if (!body.tollAcknowledgementVersion || !isKnownConsentVersion(body.tollAcknowledgementVersion)) {
      return c.json({ error: "tollAcknowledgementVersion required to claim this job" }, 400);
    }
    const ctx = getRequestContext();
    await appendAuditLog(db, {
      actorUserId: session.userId,
      actorRole: session.activeRole,
      groupId: session.groupId,
      action: "consent.toll_ack",
      entityType: "job",
      entityId: c.req.param("id"),
      afterJson: {
        consentVersion: body.tollAcknowledgementVersion,
        text: CONSENT_TEXTS[body.tollAcknowledgementVersion],
      },
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      requestId: c.get("requestId"),
      result: "success",
    });
  }

  const claimed = await claimJob(db, session.groupId, c.req.param("id"), session.userId);
  return c.json(claimed);
});

jobs.post("/:id/picked-up", requireRole("runner"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await markPickedUp(db, session.groupId, c.req.param("id")));
});

jobs.post("/:id/in-transit", requireRole("runner"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await markInTransit(db, session.groupId, c.req.param("id")));
});

jobs.post("/:id/delivered", requireRole("runner"), async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await markDelivered(db, session.groupId, c.req.param("id")));
});

/**
 * Settlement is a distinct, explicit step from "delivered" rather than
 * automatic, so a purchaser (or admin) confirms receipt before the
 * commission ledger entries are written — matches the lifecycle in
 * CLAUDE.md ("delivered -> settled" is its own transition).
 */
jobs.post("/:id/settle", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  const job = await getJobById(db, session.groupId, c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  if (job.purchaserUserId !== session.userId && session.activeRole !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  const settled = await settleJob(db, session.groupId, c.req.param("id"));
  await stopTracking(c.env, c.req.param("id"));
  return c.json(settled);
});

const nonPaymentSchema = z.object({ amountMinor: z.number().int().positive() });

/**
 * A runner/vendor who accepted an anonymous (or any) COD job and wasn't
 * paid reports it here — tracked against the purchaser's real identity,
 * auto-suspended past a configurable threshold (CLAUDE.md "Cash-on-delivery
 * risk flow"). The platform does not reimburse the loss; this is
 * accountability tracking, not a refund mechanism.
 */
jobs.post("/:id/report-non-payment", requireRole("runner", "vendor"), async (c) => {
  const session = c.get("session")!;
  const body = nonPaymentSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const job = await getJobById(db, session.groupId, c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  if (job.paymentMethod !== "cash") return c.json({ error: "job was not a cash job" }, 400);

  const result = await reportNonPaymentAndMaybeSuspend(db, {
    jobId: job.id,
    purchaserUserId: job.purchaserUserId,
    reportedByUserId: session.userId,
    amountMinor: body.amountMinor,
  });
  return c.json(result, 201);
});

const cancelSchema = z.object({ reason: z.string().min(1) });

jobs.post("/:id/cancel", async (c) => {
  const session = c.get("session")!;
  const body = cancelSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const result = await cancelJob(db, session.groupId, c.req.param("id"), body.reason);
  await stopTracking(c.env, c.req.param("id"));
  return c.json(result);
});

jobs.post("/:id/dispute", async (c) => {
  const session = c.get("session")!;
  const body = cancelSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  // SOS already extends tracking past terminal state (see routes/sos.ts) —
  // a dispute does NOT auto-extend it, admin can trigger that separately if needed.
  const result = await disputeJob(db, session.groupId, c.req.param("id"), body.reason);
  await stopTracking(c.env, c.req.param("id"));
  return c.json(result);
});

export default jobs;
