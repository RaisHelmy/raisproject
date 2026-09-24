import type { Db } from "../client";
import { countUnresolvedIncidents, reportNonPayment } from "../repositories/nonPaymentIncidents";
import { setUserStatus } from "../repositories/users";

/**
 * Configurable threshold, not hardcoded business logic (CLAUDE.md
 * "auto-suspend after a configurable threshold") — the number itself is a
 * policy knob; this default is the MVP placeholder for it.
 */
export const NON_PAYMENT_AUTO_SUSPEND_THRESHOLD = 3;

export async function reportNonPaymentAndMaybeSuspend(
  db: Db,
  input: { jobId: string; purchaserUserId: string; reportedByUserId: string; amountMinor: number },
  threshold: number = NON_PAYMENT_AUTO_SUSPEND_THRESHOLD,
) {
  const incident = await reportNonPayment(db, input);
  const unresolvedCount = await countUnresolvedIncidents(db, input.purchaserUserId);
  let suspended = false;
  if (unresolvedCount >= threshold) {
    await setUserStatus(db, input.purchaserUserId, "suspended");
    suspended = true;
  }
  return { incident, unresolvedCount, suspended };
}
