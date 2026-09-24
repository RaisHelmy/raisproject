import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { nonPaymentIncidents } from "../schema";
import { withAudit } from "./withAudit";

export interface ReportNonPaymentInput {
  jobId: string;
  purchaserUserId: string;
  reportedByUserId: string;
  amountMinor: number;
}

/**
 * Tracked against the purchaser's real identity, never the anonymous
 * handle (CLAUDE.md "Cash-on-delivery risk flow") — purchaserUserId here
 * is always the real user id; anonymity only ever affects display.
 */
export async function reportNonPayment(db: Db, input: ReportNonPaymentInput) {
  const row = {
    id: newId(),
    createdAt: nowIso(),
    jobId: input.jobId,
    purchaserUserId: input.purchaserUserId,
    reportedByUserId: input.reportedByUserId,
    amountMinor: input.amountMinor,
    resolved: false,
  };
  return withAudit(
    db,
    { action: "non_payment.report", entityType: "non_payment_incident", entityId: row.id },
    async () => {
      await db.insert(nonPaymentIncidents).values(row);
      return row;
    },
  );
}

export async function listIncidentsForPurchaser(db: Db, purchaserUserId: string) {
  return db
    .select()
    .from(nonPaymentIncidents)
    .where(eq(nonPaymentIncidents.purchaserUserId, purchaserUserId));
}

export async function countUnresolvedIncidents(db: Db, purchaserUserId: string): Promise<number> {
  const rows = await listIncidentsForPurchaser(db, purchaserUserId);
  return rows.filter((r) => !r.resolved).length;
}
