import { and, eq, isNotNull, or } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { ratings } from "../schema";
import { withAudit } from "./withAudit";

export interface CreateRatingInput {
  jobId: string;
  raterUserId: string;
  rateeUserId: string;
  score: number;
  comment?: string;
}

export async function createRating(db: Db, input: CreateRatingInput) {
  const row = {
    id: newId(),
    createdAt: nowIso(),
    jobId: input.jobId,
    raterUserId: input.raterUserId,
    rateeUserId: input.rateeUserId,
    score: input.score,
    comment: input.comment ?? null,
    rejected: false,
    rejectionReason: null,
    resolutionOutcome: null,
    resolverUserId: null,
    resolvedAt: null,
  };
  return withAudit(
    db,
    { action: "rating.create", entityType: "rating", entityId: row.id },
    async () => {
      await db.insert(ratings).values(row);
      return row;
    },
  );
}

/**
 * Any party can reject a rating they received. The row is never deleted —
 * it flips to `rejected` and is excluded from public averages until an
 * admin resolves it (CLAUDE.md: "rating under review", not silently
 * changed).
 */
export async function rejectRating(db: Db, ratingId: string, reason: string) {
  return withAudit(
    db,
    { action: "rating.reject", entityType: "rating", entityId: ratingId, before: { reason } },
    async () => {
      await db
        .update(ratings)
        .set({ rejected: true, rejectionReason: reason })
        .where(eq(ratings.id, ratingId));
      return { ratingId, reason };
    },
  );
}

export async function resolveRating(
  db: Db,
  ratingId: string,
  resolverUserId: string,
  outcome: string,
) {
  return withAudit(
    db,
    { action: "rating.resolve", entityType: "rating", entityId: ratingId },
    async () => {
      await db
        .update(ratings)
        .set({
          resolutionOutcome: outcome,
          resolverUserId,
          resolvedAt: nowIso(),
        })
        .where(eq(ratings.id, ratingId));
      return { ratingId, resolverUserId, outcome };
    },
  );
}

/**
 * Averages/listing must exclude a rating while it's rejected AND still
 * under review (not yet resolved). Once an admin resolves it, it becomes
 * visible again regardless of the original rejection — the resolution
 * outcome is the caller's business logic to interpret (Step 9).
 */
export async function listVisibleRatingsForUser(db: Db, rateeUserId: string) {
  return db
    .select()
    .from(ratings)
    .where(
      and(
        eq(ratings.rateeUserId, rateeUserId),
        or(eq(ratings.rejected, false), isNotNull(ratings.resolvedAt)),
      ),
    );
}
