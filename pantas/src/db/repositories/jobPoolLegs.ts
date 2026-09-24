import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { jobPoolLegs, jobs } from "../schema";
import { withAudit } from "./withAudit";

export interface JoinPoolInput {
  jobId: string;
  purchaserUserId: string;
  pickupNote?: string;
  dropoffNote?: string;
  fareMinor: number;
}

/**
 * MVP pooling is a manual join, not automatic route-matching (CLAUDE.md
 * "Carpool (pooled rides)") — the caller (route handler) is responsible for
 * having already checked the target job is poolEnabled and still open to
 * new legs; this just persists the leg.
 */
export async function joinPool(db: Db, input: JoinPoolInput) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
  if (!job) throw new Error(`job ${input.jobId} not found`);
  if (!job.poolEnabled) throw new Error(`job ${input.jobId} is not pool-enabled`);

  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    jobId: input.jobId,
    purchaserUserId: input.purchaserUserId,
    pickupNote: input.pickupNote ?? null,
    dropoffNote: input.dropoffNote ?? null,
    fareMinor: input.fareMinor,
    status: "pending" as const,
  };
  return withAudit(
    db,
    { action: "job_pool_leg.join", entityType: "job_pool_leg", entityId: row.id },
    async () => {
      await db.insert(jobPoolLegs).values(row);
      return row;
    },
  );
}

export async function listLegsForJob(db: Db, jobId: string) {
  return db.select().from(jobPoolLegs).where(eq(jobPoolLegs.jobId, jobId));
}

export async function confirmPoolLeg(db: Db, legId: string) {
  return withAudit(
    db,
    { action: "job_pool_leg.confirm", entityType: "job_pool_leg", entityId: legId },
    async () => {
      await db.update(jobPoolLegs).set({ status: "confirmed" }).where(eq(jobPoolLegs.id, legId));
      return { legId };
    },
  );
}

export async function cancelPoolLeg(db: Db, legId: string) {
  return withAudit(
    db,
    { action: "job_pool_leg.cancel", entityType: "job_pool_leg", entityId: legId },
    async () => {
      await db.update(jobPoolLegs).set({ status: "cancelled" }).where(eq(jobPoolLegs.id, legId));
      return { legId };
    },
  );
}
