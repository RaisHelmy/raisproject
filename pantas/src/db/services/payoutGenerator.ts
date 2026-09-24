import type { Db } from "../client";
import {
  getAccountTotals,
  listEntriesInPeriod,
  writeBalancedLedgerEntries,
} from "../repositories/ledger";
import { createPayoutBatch } from "../repositories/payouts";

/**
 * Weekly payout batch generation (CLAUDE.md "Collecting the fee on cash
 * jobs" / build order Step 11). For every payee (runner or vendor) with
 * runner_payable/vendor_payable activity in [periodStart, periodEnd):
 *   grossPayable = credits - debits on their payable account in the period
 *   feesToNet    = min(grossPayable, their outstanding accrued_fee_receivable balance)
 *   netPayable   = grossPayable - feesToNet
 * The netting itself is written as its own balanced ledger entry (clearing
 * the receivable), then a payout_batches row records the result — never a
 * mutable "balance owed" column anywhere.
 */
export async function generateWeeklyPayouts(
  db: Db,
  groupId: string | null,
  periodStart: string,
  periodEnd: string,
) {
  const runnerEntries = await listEntriesInPeriod(db, groupId, "runner_payable", periodStart, periodEnd);
  const vendorEntries = await listEntriesInPeriod(db, groupId, "vendor_payable", periodStart, periodEnd);

  const payees = new Map<string, { accountType: "runner_payable" | "vendor_payable"; payeeType: "runner" | "vendor" }>();
  for (const e of runnerEntries) if (e.accountRefId) payees.set(e.accountRefId, { accountType: "runner_payable", payeeType: "runner" });
  for (const e of vendorEntries) if (e.accountRefId) payees.set(e.accountRefId, { accountType: "vendor_payable", payeeType: "vendor" });

  const batches = [];
  for (const [payeeId, { accountType, payeeType }] of payees) {
    const totals = await getAccountTotals(db, groupId, accountType, payeeId);
    const grossPayable = totals.creditTotal - totals.debitTotal;
    if (grossPayable <= 0) continue;

    const feeTotals = await getAccountTotals(db, groupId, "accrued_fee_receivable", payeeId);
    const outstandingFees = feeTotals.debitTotal - feeTotals.creditTotal;
    const feesToNet = Math.max(0, Math.min(grossPayable, outstandingFees));
    const netPayable = grossPayable - feesToNet;

    if (feesToNet > 0) {
      await writeBalancedLedgerEntries(db, `payout:${groupId ?? "platform"}:${payeeId}:${periodStart}:${periodEnd}:fee_offset`, [
        {
          groupId,
          jobId: null,
          accountType: "accrued_fee_receivable",
          accountRefId: payeeId,
          direction: "credit",
          amountMinor: feesToNet,
          description: "accrued cash-job fees netted against weekly payout",
        },
        {
          groupId,
          jobId: null,
          accountType,
          accountRefId: payeeId,
          direction: "debit",
          amountMinor: feesToNet,
          description: "payable reduced by netted accrued fees",
        },
      ]);
    }

    const batch = await createPayoutBatch(db, {
      groupId,
      payeeType,
      payeeId,
      periodStart,
      periodEnd,
      totalPayableMinor: netPayable,
      totalFeesDeductedMinor: feesToNet,
    });
    batches.push(batch);
  }
  return batches;
}

/**
 * Cash-job matching gate (CLAUDE.md: "stop showing them cash jobs until
 * they clear it"). Threshold is a parameter, not a constant, so it can be
 * configured per group/ops policy rather than hardcoded — see
 * src/worker/routes/jobs.ts for where this is applied to job listing.
 */
export async function isBlockedFromCashJobs(
  db: Db,
  groupId: string | null,
  payeeId: string,
  thresholdMinor: number,
): Promise<boolean> {
  const totals = await getAccountTotals(db, groupId, "accrued_fee_receivable", payeeId);
  const outstanding = totals.debitTotal - totals.creditTotal;
  return outstanding > thresholdMinor;
}
