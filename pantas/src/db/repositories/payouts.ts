import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { payoutBatches } from "../schema";
import { groupScope } from "./base";
import { withAudit } from "./withAudit";

export interface CreatePayoutBatchInput {
  groupId: string | null;
  payeeType: "runner" | "vendor";
  payeeId: string;
  periodStart: string;
  periodEnd: string;
  totalPayableMinor: number;
  totalFeesDeductedMinor: number;
}

export async function createPayoutBatch(db: Db, input: CreatePayoutBatchInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    groupId: input.groupId,
    payeeType: input.payeeType,
    payeeId: input.payeeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalPayableMinor: input.totalPayableMinor,
    totalFeesDeductedMinor: input.totalFeesDeductedMinor,
    status: "pending" as const,
    paidAt: null,
  };
  return withAudit(
    db,
    { action: "payout_batch.create", entityType: "payout_batch", entityId: row.id },
    async () => {
      await db.insert(payoutBatches).values(row);
      return row;
    },
  );
}

export async function markPayoutBatchPaid(db: Db, batchId: string) {
  return withAudit(
    db,
    { action: "payout_batch.mark_paid", entityType: "payout_batch", entityId: batchId },
    async () => {
      await db
        .update(payoutBatches)
        .set({ status: "paid", paidAt: nowIso(), updatedAt: nowIso() })
        .where(eq(payoutBatches.id, batchId));
      return { batchId };
    },
  );
}

export async function listPayoutBatchesForPayee(
  db: Db,
  groupId: string | null,
  payeeId: string,
) {
  return db
    .select()
    .from(payoutBatches)
    .where(
      and(groupScope(payoutBatches.groupId, groupId), eq(payoutBatches.payeeId, payeeId)),
    );
}

export async function listPendingPayoutBatches(db: Db) {
  return db.select().from(payoutBatches).where(eq(payoutBatches.status, "pending"));
}
