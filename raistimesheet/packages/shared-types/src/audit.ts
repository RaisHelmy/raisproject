/**
 * "Simplified view" for sharing an HR timesheet outside the organisation (audit, other agencies):
 * keeps dates, times and durations but removes client/project names, Jira keys and task specifics.
 */
const CATEGORIES: Record<string, string> = {
  DEV: "Software development",
  ENH: "Enhancement",
  FIX: "Bug fix",
  SEC: "Security hardening & remediation",
  SUP: "Technical support & operations",
  MTG: "Meeting / discussion",
  REQ: "Requirements analysis",
  FUP: "Follow-up & coordination",
};

/** Generic activity label from a task title's leading tag, e.g. "[DEV] ..." → "Software development". */
export function auditCategory(title: string): string {
  const tag = /^\s*\[([A-Z]{2,4})\]/.exec(title)?.[1];
  return (tag && CATEGORIES[tag]) || "General work";
}
