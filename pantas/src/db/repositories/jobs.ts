import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { jobs, type carSegmentValues } from "../schema";
import { groupScope } from "./base";
import { getUserById } from "./users";
import { listActivePerkRules } from "./perkRules";
import { withAudit } from "./withAudit";

export type JobType = "food_order" | "item_order" | "fetch" | "delivery" | "ride";
export type PaymentMethod = "cash" | "gateway";
export type JobStatus =
  | "draft"
  | "posted"
  | "claimed"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "settled"
  | "cancelled"
  | "disputed";

export interface CreateJobInput {
  groupId: string | null;
  type: JobType;
  purchaserUserId: string;
  paymentMethod: PaymentMethod;
  deliveryFeeMinor: number;
  declaredValueMinor?: number;
  isAnonymousJob?: boolean;
  vendorId?: string;
  quietRideRequested?: boolean;
  requestedVehicleBrand?: string;
  requestedVehicleModel?: string;
  requestedVehicleSegment?: (typeof carSegmentValues)[number];
  poolEnabled?: boolean;
  scheduledFor?: string;
  spawnedFromScheduleId?: string;
  vendorContractId?: string;
}

export async function createDraftJob(db: Db, input: CreateJobInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    groupId: input.groupId,
    type: input.type,
    status: "draft" as const,
    purchaserUserId: input.purchaserUserId,
    runnerUserId: null,
    vendorId: input.vendorId ?? null,
    paymentMethod: input.paymentMethod,
    declaredValueMinor: input.declaredValueMinor ?? null,
    itemCostMinor: null,
    deliveryFeeMinor: input.deliveryFeeMinor,
    commissionMinor: null,
    isAnonymousJob: input.isAnonymousJob ?? false,
    postedAt: null,
    claimedAt: null,
    pickedUpAt: null,
    inTransitAt: null,
    deliveredAt: null,
    settledAt: null,
    cancelledAt: null,
    quietRideRequested: input.quietRideRequested ?? false,
    requestedVehicleBrand: input.requestedVehicleBrand ?? null,
    requestedVehicleModel: input.requestedVehicleModel ?? null,
    requestedVehicleSegment: input.requestedVehicleSegment ?? null,
    poolEnabled: input.poolEnabled ?? false,
    scheduledFor: input.scheduledFor ?? null,
    spawnedFromScheduleId: input.spawnedFromScheduleId ?? null,
    vendorContractId: input.vendorContractId ?? null,
  };
  return withAudit(
    db,
    { action: "job.create", entityType: "job", entityId: row.id },
    async () => {
      await db.insert(jobs).values(row);
      return row;
    },
  );
}

export async function getJobById(db: Db, groupId: string | null, jobId: string) {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(groupScope(jobs.groupId, groupId), eq(jobs.id, jobId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listJobsForGroup(db: Db, groupId: string | null) {
  return db.select().from(jobs).where(groupScope(jobs.groupId, groupId));
}

/** Admin cross-group visibility — CLAUDE.md: admin always has full visibility. */
export async function adminGetJobById(db: Db, jobId: string) {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

export async function adminListAllJobs(db: Db) {
  return db.select().from(jobs);
}

// ---------------------------------------------------------------------------
// Job lifecycle state machine
//
// draft -> posted -> claimed -> picked_up -> in_transit -> delivered -> settled
//                                                        \-> disputed (from claimed onward)
// any of {draft, posted, claimed} -> cancelled
//
// Every transition is validated against this table server-side; there is no
// client-driven status jump (CLAUDE.md "Jobs and matching").
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ["posted", "cancelled"],
  posted: ["claimed", "cancelled"],
  claimed: ["picked_up", "cancelled", "disputed"],
  picked_up: ["in_transit", "disputed"],
  in_transit: ["delivered", "disputed"],
  delivered: ["settled", "disputed"],
  settled: ["disputed"],
  cancelled: [],
  disputed: [],
};

function assertTransitionAllowed(from: JobStatus, to: JobStatus) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`invalid job transition: ${from} -> ${to}`);
  }
}

async function transitionJob(
  db: Db,
  groupId: string | null,
  jobId: string,
  to: JobStatus,
  timestampColumn: string | null,
  extraSet: Record<string, unknown> = {},
) {
  const job = await getJobById(db, groupId, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  assertTransitionAllowed(job.status as JobStatus, to);

  const now = nowIso();
  const set: Record<string, unknown> = { status: to, updatedAt: now, ...extraSet };
  if (timestampColumn) set[timestampColumn as string] = now;

  await db
    .update(jobs)
    .set(set)
    .where(and(groupScope(jobs.groupId, groupId), eq(jobs.id, jobId)));

  return { ...job, ...set } as typeof job;
}

export async function postJob(db: Db, groupId: string | null, jobId: string) {
  return withAudit(
    db,
    { action: "job.post", entityType: "job", entityId: jobId },
    () => transitionJob(db, groupId, jobId, "posted", "postedAt"),
  );
}

/**
 * FCFS priority window (CLAUDE.md "Jobs and matching"): for the first
 * PRIORITY_WINDOW_SECONDS after posting, only priority-eligible runners can
 * claim. Priority eligibility is data-driven via perk_rules
 * (perkType: "priority_window"), never a hardcoded `if (verified)` check.
 */
export const PRIORITY_WINDOW_SECONDS = 60;

export async function isPriorityRunner(
  db: Db,
  groupId: string | null,
  runnerUserId: string,
): Promise<boolean> {
  const runner = await getUserById(db, runnerUserId);
  if (!runner) return false;
  const rules = await listActivePerkRules(db, "priority_window");
  return rules.some(
    (rule) =>
      rule.verificationTier === runner.verificationTier &&
      (rule.groupId === null || rule.groupId === groupId),
  );
}

export async function claimJob(
  db: Db,
  groupId: string | null,
  jobId: string,
  runnerUserId: string,
) {
  return withAudit(
    db,
    { action: "job.claim", entityType: "job", entityId: jobId },
    async () => {
      const job = await getJobById(db, groupId, jobId);
      if (!job) throw new Error(`job ${jobId} not found`);
      assertTransitionAllowed(job.status as JobStatus, "claimed");

      if (job.postedAt) {
        const secondsSincePosted = (Date.now() - new Date(job.postedAt).getTime()) / 1000;
        if (secondsSincePosted < PRIORITY_WINDOW_SECONDS) {
          const eligible = await isPriorityRunner(db, groupId, runnerUserId);
          if (!eligible) {
            throw new Error(
              `job is in its ${PRIORITY_WINDOW_SECONDS}s priority window; runner is not priority-eligible`,
            );
          }
        }
      }

      const now = nowIso();
      await db
        .update(jobs)
        .set({
          status: "claimed",
          runnerUserId,
          claimedAt: now,
          updatedAt: now,
        })
        .where(and(groupScope(jobs.groupId, groupId), eq(jobs.id, jobId)));

      return { ...job, status: "claimed" as const, runnerUserId, claimedAt: now };
    },
  );
}

export async function markPickedUp(db: Db, groupId: string | null, jobId: string) {
  return withAudit(
    db,
    { action: "job.picked_up", entityType: "job", entityId: jobId },
    () => transitionJob(db, groupId, jobId, "picked_up", "pickedUpAt"),
  );
}

export async function markInTransit(db: Db, groupId: string | null, jobId: string) {
  return withAudit(
    db,
    { action: "job.in_transit", entityType: "job", entityId: jobId },
    () => transitionJob(db, groupId, jobId, "in_transit", "inTransitAt"),
  );
}

export async function markDelivered(db: Db, groupId: string | null, jobId: string) {
  return withAudit(
    db,
    { action: "job.delivered", entityType: "job", entityId: jobId },
    () => transitionJob(db, groupId, jobId, "delivered", "deliveredAt"),
  );
}

/**
 * Marks the job row `settled` only — it does not write ledger entries or
 * compute commission. Those are composed together in
 * src/db/services/settlement.ts, which calls this as one step of a larger
 * transaction so the commission math lives in one place, not duplicated
 * here.
 */
export async function markSettled(
  db: Db,
  groupId: string | null,
  jobId: string,
  commissionMinor: number,
) {
  return withAudit(
    db,
    { action: "job.settle", entityType: "job", entityId: jobId },
    () => transitionJob(db, groupId, jobId, "settled", "settledAt", { commissionMinor }),
  );
}

export async function cancelJob(
  db: Db,
  groupId: string | null,
  jobId: string,
  reason: string,
) {
  return withAudit(
    db,
    { action: "job.cancel", entityType: "job", entityId: jobId, before: { reason } },
    () => transitionJob(db, groupId, jobId, "cancelled", "cancelledAt"),
  );
}

export async function disputeJob(
  db: Db,
  groupId: string | null,
  jobId: string,
  reason: string,
) {
  return withAudit(
    db,
    { action: "job.dispute", entityType: "job", entityId: jobId, before: { reason } },
    () => transitionJob(db, groupId, jobId, "disputed", null),
  );
}
