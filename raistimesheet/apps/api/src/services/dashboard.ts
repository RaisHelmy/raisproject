import type { AppContext } from "./context";
import { isApprover } from "./context";
import type { AttentionItem, DashboardDTO } from "@rais/shared-types";
import { monthRange, todayIso } from "../lib/time";
import { classifyDelay } from "../lib/delay";

export async function buildDashboard(ctx: AppContext): Promise<DashboardDTO> {
  const u = ctx.user!;
  const approver = isApprover(u);
  const today = todayIso(u.timezone);
  const { from, to } = monthRange(today);
  const mine = { user_id: u.id };
  const scope = approver ? {} : mine;

  const [pending, drafts, monthMine, jiraPending, syncErrors, aiPending, byDay, byProject, statusCounts, syncCounts] = await Promise.all([
    ctx.repos.timesheets.summary({ ...scope, status: "SUBMITTED" }),
    ctx.repos.timesheets.summary({ ...mine, status: "DRAFT" }),
    ctx.repos.timesheets.summary({ ...mine, date_from: from, date_to: to, status: ["DRAFT", "SUBMITTED", "APPROVED"] }),
    ctx.repos.timesheets.summary({ ...scope, status: "APPROVED", jira_sync_status: ["NOT_LINKED", "MATCH_SUGGESTED"] }),
    ctx.repos.jira.openSyncErrors({ offset: 0, limit: 1 }),
    ctx.repos.analyses.countPendingReview(u.id),
    ctx.repos.timesheets.minutesByDay({ ...scope, date_from: from, date_to: to, status: ["DRAFT", "SUBMITTED", "APPROVED"] }),
    ctx.repos.timesheets.minutesByProject({ ...scope, date_from: from, date_to: to, status: ["DRAFT", "SUBMITTED", "APPROVED"] }),
    ctx.repos.timesheets.countBy({ ...scope, date_from: from, date_to: to, status: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] }, "status"),
    ctx.repos.timesheets.countBy({ ...scope, status: "APPROVED" }, "jira_sync_status"),
  ]);

  // Delayed tasks from Jira cache for projects the user can see
  const projects = await ctx.repos.projects.list({ active_only: true, ...(approver ? {} : { user_id: u.id }) });
  const keys = projects.map((p) => p.jira_project_key).filter((k): k is string => !!k);
  const issues = keys.length ? await ctx.repos.jira.allIssues(keys) : [];
  const delayedIssues = issues
    .map((i) => ({ i, d: classifyDelay({ due_date: i.due_date, resolved_at: i.resolved_at, status_category: i.status_category as "new" | "indeterminate" | "done" | "unknown", status: i.status, today }) }))
    .filter((x) => x.d.state === "DELAYED" && (approver || !u.jira_account_id || x.i.assignee_account_id === u.jira_account_id))
    .sort((a, b) => (b.d.days ?? 0) - (a.d.days ?? 0));

  const attention: AttentionItem[] = [];
  if (approver && pending.count) attention.push({ key: "pending", severity: "warning", title: `${pending.count} timesheet${pending.count === 1 ? "" : "s"} awaiting approval`, count: pending.count, action_label: "Review", link: "/approvals" });
  if (aiPending) attention.push({ key: "ai_review", severity: "info", title: `${aiPending} AI suggestion${aiPending === 1 ? "" : "s"} require${aiPending === 1 ? "s" : ""} your review`, count: aiPending, action_label: "Review", link: "/imports" });
  if (jiraPending.count) attention.push({ key: "jira_pending", severity: "warning", title: `${jiraPending.count} approved task${jiraPending.count === 1 ? " is" : "s are"} not in Jira`, count: jiraPending.count, action_label: "Review", link: "/jira/reconciliation" });
  if (syncErrors.total) attention.push({ key: "sync_errors", severity: "danger", title: `${syncErrors.total} Jira synchronisation error${syncErrors.total === 1 ? "" : "s"}`, count: syncErrors.total, action_label: "Resolve", link: "/jira/errors" });
  if (delayedIssues.length) attention.push({ key: "delayed", severity: "warning", title: `${delayedIssues.length} delayed task${delayedIssues.length === 1 ? "" : "s"}`, count: delayedIssues.length, action_label: "View", link: "/jira/tasks?filter=delayed" });
  if (drafts.count) attention.push({ key: "drafts", severity: "info", title: `${drafts.count} draft${drafts.count === 1 ? "" : "s"} not yet submitted`, count: drafts.count, action_label: "Open drafts", link: "/timesheets/drafts" });

  return {
    greeting_name: u.name.split(" ")[0] ?? u.name,
    is_approver: approver,
    kpis: { pending_approval: pending.count, pending_hours_minutes: pending.minutes, jira_pending: jiraPending.count, delayed_tasks: delayedIssues.length, hours_this_month_minutes: monthMine.minutes, drafts: drafts.count, ai_review_pending: aiPending, sync_errors: syncErrors.total },
    attention,
    charts: {
      hours_by_day: byDay,
      hours_by_project: byProject,
      task_status: statusCounts.map((s) => ({ status: s.key, count: s.count })),
      jira_sync_status: syncCounts.map((s) => ({ status: s.key, count: s.count })),
      delayed_tasks: delayedIssues.slice(0, 8).map((x) => ({ key: x.i.issue_key, days: x.d.days ?? 0, summary: x.i.summary })),
    },
    all_synced: jiraPending.count === 0 && syncErrors.total === 0,
  };
}
