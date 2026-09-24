import type { DelayInfo } from "@rais/shared-types";
import { daysBetween } from "./time";

export interface DelayInput {
  due_date: string | null;
  resolved_at: string | null;
  status_category: "new" | "indeterminate" | "done" | "unknown";
  status: string;
  today: string;
  at_risk_days?: number;
}

/**
 * Classify delay. A task is only "delayed" when a reliable due date exists.
 */
export function classifyDelay(i: DelayInput): DelayInfo {
  if (/block/i.test(i.status)) return { state: "BLOCKED", days: null, message: "Blocked" };
  if (!i.due_date) return { state: "NO_DUE_DATE", days: null, message: "No due date" };
  const atRisk = i.at_risk_days ?? 2;
  if (i.status_category === "done") {
    const done = (i.resolved_at ?? i.today).slice(0, 10);
    const d = daysBetween(i.due_date, done);
    if (d > 0) return { state: "DELAYED", days: d, message: `Delayed ${d} day${d === 1 ? "" : "s"}` };
    return { state: "ON_TIME", days: 0, message: "On time" };
  }
  const remaining = daysBetween(i.today, i.due_date);
  if (remaining < 0) return { state: "DELAYED", days: -remaining, message: `Overdue by ${-remaining} day${remaining === -1 ? "" : "s"}` };
  if (remaining <= atRisk) return { state: "AT_RISK", days: remaining, message: remaining === 0 ? "Due today" : `Due in ${remaining} day${remaining === 1 ? "" : "s"}` };
  return { state: "OPEN", days: remaining, message: `Due in ${remaining} days` };
}
