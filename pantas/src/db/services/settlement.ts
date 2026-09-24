import type { Db } from "../client";
import { getJobById, markSettled } from "../repositories/jobs";
import { getCommissionAmountMinor } from "../repositories/commissionRules";
import { writeBalancedLedgerEntries, type LedgerLine } from "../repositories/ledger";

/**
 * Composes the commission calculation and the ledger double-entry for a
 * settled job, then flips the job's own status to `settled` — one logical
 * unit, so the money math lives in exactly one place (CLAUDE.md "Money").
 *
 * Cash job:
 *   debit  accrued_fee_receivable(payee)  = commission   [payee owes platform]
 *   credit platform_revenue               = commission
 *   (+ if purchase-on-behalf) debit runner_outlay_receivable(runner) = itemCost,
 *                              credit purchaser_charge_clearing      = itemCost
 *
 * Gateway job (purchaser already charged in full at order time — see
 * src/worker/routes/gateway.ts):
 *   debit  purchaser_charge_clearing      = deliveryFee + itemCost
 *   credit runner_payable/vendor_payable  = deliveryFee + itemCost - commission
 *   credit platform_revenue               = commission
 */
export async function settleJob(db: Db, groupId: string | null, jobId: string) {
  const job = await getJobById(db, groupId, jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  if (job.status !== "delivered") {
    throw new Error(`job ${jobId} must be 'delivered' to settle, is '${job.status}'`);
  }

  // Fetch jobs: declared value caps runner outlay — a purchaser attestation
  // used in dispute resolution (CLAUDE.md "Money").
  if (job.type === "fetch" && job.itemCostMinor !== null && job.declaredValueMinor !== null) {
    if (job.itemCostMinor > job.declaredValueMinor) {
      throw new Error(
        `job ${jobId}: runner outlay (${job.itemCostMinor}) exceeds declared value (${job.declaredValueMinor})`,
      );
    }
  }

  const commissionMinor = await getCommissionAmountMinor(db, groupId, job.type);
  const payeeId = job.vendorId ?? job.runnerUserId;
  if (!payeeId) throw new Error(`job ${jobId} has no runner or vendor assigned`);
  const payeeAccountType = job.vendorId ? "vendor_payable" : "runner_payable";

  const lines: LedgerLine[] = [];

  if (job.paymentMethod === "cash") {
    lines.push(
      {
        groupId,
        jobId,
        accountType: "accrued_fee_receivable",
        accountRefId: payeeId,
        direction: "debit",
        amountMinor: commissionMinor,
        description: `flat commission accrued on cash job ${jobId}`,
      },
      {
        groupId,
        jobId,
        accountType: "platform_revenue",
        accountRefId: null,
        direction: "credit",
        amountMinor: commissionMinor,
      },
    );
    if (job.itemCostMinor && job.runnerUserId) {
      lines.push(
        {
          groupId,
          jobId,
          accountType: "runner_outlay_receivable",
          accountRefId: job.runnerUserId,
          direction: "debit",
          amountMinor: job.itemCostMinor,
          description: "purchase-on-behalf outlay, reimbursable — never platform revenue",
        },
        {
          groupId,
          jobId,
          accountType: "purchaser_charge_clearing",
          accountRefId: job.purchaserUserId,
          direction: "credit",
          amountMinor: job.itemCostMinor,
        },
      );
    }
  } else {
    const total = job.deliveryFeeMinor + (job.itemCostMinor ?? 0);
    const netPayable = total - commissionMinor;
    if (netPayable < 0) {
      throw new Error(`job ${jobId}: commission (${commissionMinor}) exceeds total charge (${total})`);
    }
    lines.push(
      {
        groupId,
        jobId,
        accountType: "purchaser_charge_clearing",
        accountRefId: job.purchaserUserId,
        direction: "debit",
        amountMinor: total,
      },
      {
        groupId,
        jobId,
        accountType: payeeAccountType,
        accountRefId: payeeId,
        direction: "credit",
        amountMinor: netPayable,
      },
      {
        groupId,
        jobId,
        accountType: "platform_revenue",
        accountRefId: null,
        direction: "credit",
        amountMinor: commissionMinor,
      },
    );
  }

  await writeBalancedLedgerEntries(db, `job:${jobId}:settle`, lines);
  return markSettled(db, groupId, jobId, commissionMinor);
}
