import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { jobOffers, jobs } from "../schema";
import { groupScope } from "./base";
import { withAudit } from "./withAudit";

/**
 * Counter-offer negotiation, alongside (not instead of) FCFS claiming — see
 * CLAUDE.md "Price negotiation". The toll-cost acknowledgement gate is
 * enforced by the route handler (src/worker/routes/offers.ts), logged the
 * same way as any other consent event via appendAuditLog — not tracked on
 * this table.
 */

export interface CreateOfferInput {
  groupId: string | null;
  jobId: string;
  runnerUserId: string;
  proposedFeeMinor: number;
  message?: string;
}

export async function createOffer(db: Db, input: CreateOfferInput) {
  if (input.proposedFeeMinor <= 0 || !Number.isInteger(input.proposedFeeMinor)) {
    throw new Error("proposedFeeMinor must be a positive integer minor-unit amount");
  }
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    groupId: input.groupId,
    jobId: input.jobId,
    runnerUserId: input.runnerUserId,
    proposedFeeMinor: input.proposedFeeMinor,
    message: input.message ?? null,
    status: "pending" as const,
    respondedAt: null,
  };
  return withAudit(
    db,
    { action: "job_offer.create", entityType: "job_offer", entityId: row.id },
    async () => {
      await db.insert(jobOffers).values(row);
      return row;
    },
  );
}

export async function getOfferById(db: Db, groupId: string | null, offerId: string) {
  const rows = await db
    .select()
    .from(jobOffers)
    .where(and(groupScope(jobOffers.groupId, groupId), eq(jobOffers.id, offerId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listOffersForJob(
  db: Db,
  groupId: string | null,
  jobId: string,
) {
  return db
    .select()
    .from(jobOffers)
    .where(and(groupScope(jobOffers.groupId, groupId), eq(jobOffers.jobId, jobId)));
}

export async function withdrawOffer(db: Db, groupId: string | null, offerId: string) {
  return withAudit(
    db,
    { action: "job_offer.withdraw", entityType: "job_offer", entityId: offerId },
    async () => {
      const offer = await getOfferById(db, groupId, offerId);
      if (!offer) throw new Error(`offer ${offerId} not found`);
      if (offer.status !== "pending") {
        throw new Error(`cannot withdraw offer in status ${offer.status}`);
      }
      await db
        .update(jobOffers)
        .set({ status: "withdrawn", respondedAt: nowIso(), updatedAt: nowIso() })
        .where(eq(jobOffers.id, offerId));
      return { offerId };
    },
  );
}

export async function rejectOffer(db: Db, groupId: string | null, offerId: string) {
  return withAudit(
    db,
    { action: "job_offer.reject", entityType: "job_offer", entityId: offerId },
    async () => {
      const offer = await getOfferById(db, groupId, offerId);
      if (!offer) throw new Error(`offer ${offerId} not found`);
      if (offer.status !== "pending") {
        throw new Error(`cannot reject offer in status ${offer.status}`);
      }
      await db
        .update(jobOffers)
        .set({ status: "rejected", respondedAt: nowIso(), updatedAt: nowIso() })
        .where(eq(jobOffers.id, offerId));
      return { offerId };
    },
  );
}

/**
 * Accepting an offer is the one negotiation operation that touches two
 * tables: the accepted offer flips to `accepted`, every other pending offer
 * on the same job is auto-rejected, and the job itself takes the
 * negotiated price, gets its runner assigned, and moves to `claimed` — all
 * as one logical unit (see the D1-batch-atomicity note in
 * repositories/ledger.ts; the same caveat applies here). Requires the job
 * to still be `posted` — the same FCFS-window rules that gate claimJob do
 * not apply to negotiation (an offer can be made and accepted at any point
 * before the job is claimed), but the job must not already be claimed by
 * someone else.
 */
export async function acceptOffer(db: Db, groupId: string | null, offerId: string) {
  return withAudit(
    db,
    { action: "job_offer.accept", entityType: "job_offer", entityId: offerId },
    async () => {
      const offer = await getOfferById(db, groupId, offerId);
      if (!offer) throw new Error(`offer ${offerId} not found`);
      if (offer.status !== "pending") {
        throw new Error(`cannot accept offer in status ${offer.status}`);
      }

      const [job] = await db
        .select()
        .from(jobs)
        .where(and(groupScope(jobs.groupId, groupId), eq(jobs.id, offer.jobId)))
        .limit(1);
      if (!job) throw new Error(`job ${offer.jobId} not found`);
      if (job.status !== "posted") {
        throw new Error(`cannot accept an offer on a job in status ${job.status}`);
      }

      const now = nowIso();

      await db
        .update(jobOffers)
        .set({ status: "accepted", respondedAt: now, updatedAt: now })
        .where(eq(jobOffers.id, offerId));

      const otherPending = await db
        .select()
        .from(jobOffers)
        .where(
          and(
            groupScope(jobOffers.groupId, groupId),
            eq(jobOffers.jobId, offer.jobId),
            eq(jobOffers.status, "pending"),
          ),
        );
      for (const other of otherPending) {
        await db
          .update(jobOffers)
          .set({ status: "rejected", respondedAt: now, updatedAt: now })
          .where(eq(jobOffers.id, other.id));
      }

      await db
        .update(jobs)
        .set({
          deliveryFeeMinor: offer.proposedFeeMinor,
          runnerUserId: offer.runnerUserId,
          status: "claimed",
          claimedAt: now,
          updatedAt: now,
        })
        .where(and(groupScope(jobs.groupId, groupId), eq(jobs.id, offer.jobId)));

      return offer;
    },
  );
}
