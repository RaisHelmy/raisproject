/**
 * Exact warning text shown in each blocking consent modal, versioned so the
 * audit log can record precisely which wording a user agreed to (CLAUDE.md:
 * "Log the consent event with timestamp and the exact warning text version
 * shown"). Bump the version key whenever the copy changes — never edit text
 * under an existing version key, since past audit rows reference it by id.
 */
export const CONSENT_TEXTS = {
  "anonymity-v1":
    "Going anonymous means: fewer runners/vendors will accept your jobs, " +
    "disputes are harder to win, cash-on-delivery is off by default for " +
    "you, and Pantas still retains your real identity internally at all " +
    "times — anonymity is display-only toward other users.",
  "cod-checkout-v1":
    "You're paying cash on delivery. If you don't pay, the runner or " +
    "vendor who accepted this job bears the loss — Pantas does not " +
    "reimburse non-payment. Repeated non-payment incidents are tracked " +
    "against your account and can lead to suspension.",
  "runner-anonymous-cod-v1":
    "You're opting in to see anonymous cash-on-delivery jobs. If the " +
    "purchaser doesn't pay, that loss is yours to bear — Pantas does not " +
    "reimburse it. You can turn this back off at any time.",
  "runner-toll-v1":
    "Check your route for toll roads before accepting or countering. Any " +
    "toll cost is yours alone — it is never reimbursed by the purchaser " +
    "or by Pantas. If you want to price it in, build it into your " +
    "counter-offer amount.",
} as const;

export type ConsentVersion = keyof typeof CONSENT_TEXTS;

export function isKnownConsentVersion(v: string): v is ConsentVersion {
  return v in CONSENT_TEXTS;
}
