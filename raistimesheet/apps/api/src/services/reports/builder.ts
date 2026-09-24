/**
 * Report data assembly + rendering (XLSX / PDF). The same data structure feeds the
 * web print view, so every format tells the same story.
 */
import type { AppContext } from "../context";
import { isApprover } from "../context";
import type { ReportParams, ReportPreviewDTO, ReportType } from "@rais/shared-types";
import { auditCategory } from "@rais/shared-types";
import type { TimesheetFilter } from "../../repositories/types";
import { classifyDelay } from "../../lib/delay";
import { formatDateLong, formatDateShort, minutesToHuman, nowIso, todayIso } from "../../lib/time";
import { buildXlsx, type Sheet } from "./xlsx";
import { buildPdf, type PdfDocSpec } from "./pdf";
import { buildHrPdf } from "./hr-pdf";
import { buildHrXlsx } from "./hr-xlsx";
import { Errors } from "../../lib/errors";

export interface ReportData {
  type: ReportType;
  title: string;
  app: string;
  client_project: string;
  period: { from: string; to: string; label: string };
  generated_at: string;
  generated_by: string;
  filters: ReportParams;
  kpis: { label: string; value: string }[];
  hours_by_project: { project: string; minutes: number; tasks: number; completed: number }[];
  hours_by_date: { date: string; minutes: number; tasks: number }[];
  timesheets: { reference: string; date: string; day: string; task: string; description: string; project: string; project_name: string; user: string; start: string; end: string; minutes: number; work_status: string; approval: string; jira_key: string; jira_summary: string; jira_status: string; lane_key: string; lane_label: string }[];
  reconciliation: { reference: string; date: string; task: string; minutes: number; match: string; jira_key: string; confidence: string; sync_status: string; error_reference: string }[];
  delayed: { key: string; summary: string; project: string; assignee: string; due: string; completed: string; delay: string; status: string; timesheet: string }[];
  approvals: { reference: string; task: string; submitted_by: string; submitted_at: string; approved_by: string; approved_at: string; status: string }[];
  status_breakdown: { status: string; count: number }[];
}

function filterFor(ctx: AppContext, p: ReportParams): TimesheetFilter {
  const f: TimesheetFilter = { date_from: p.date_from, date_to: p.date_to };
  if (p.project_id) f.project_id = p.project_id;
  if (p.client_id) f.client_id = p.client_id;
  if (p.status) f.status = p.status;
  else f.status = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];
  if (p.jira_sync_status) f.jira_sync_status = p.jira_sync_status;
  // Reports are about one person's work: the signed-in user unless an approver picks someone else.
  f.user_id = isApprover(ctx.user) && p.user_id ? p.user_id : ctx.user!.id;
  return f;
}

export async function reportPreview(ctx: AppContext, p: ReportParams): Promise<ReportPreviewDTO> {
  validateParams(p);
  const f = filterFor(ctx, p);
  const s = await ctx.repos.timesheets.summary(f);
  const delayed = (await delayedRows(ctx, p, f)).length;
  return { period: { from: p.date_from, to: p.date_to }, entries: s.count, total_minutes: s.minutes, projects: s.projects, delayed, jira_pending: s.jira_pending, completed: s.completed, approved: s.approved };
}

export function validateParams(p: ReportParams) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date_to)) throw Errors.validation("Please choose a valid date range.");
  if (p.date_from > p.date_to) throw Errors.validation("The start date must be before the end date.");
}

async function delayedRows(ctx: AppContext, p: ReportParams, f: TimesheetFilter): Promise<ReportData["delayed"]> {
  const projects = await ctx.repos.projects.list({ active_only: false });
  const scoped = projects.filter((x) => (!p.project_id || x.id === p.project_id) && (!p.client_id || x.client_id === p.client_id) && x.jira_project_key);
  const keys = scoped.map((x) => x.jira_project_key!);
  if (!keys.length) return [];
  const issues = await ctx.repos.jira.allIssues(keys);
  const { items: ts } = await ctx.repos.timesheets.list({ ...f, status: undefined }, { offset: 0, limit: 2000 });
  const byKey = new Map<string, string>();
  for (const t of ts) if (t.jira_issue_key) byKey.set(t.jira_issue_key, t.reference);
  const reportUser = f.user_id ? await ctx.repos.users.findById(f.user_id) : null;
  const assignee = reportUser?.jira_account_id ?? null;
  const today = todayIso();
  return issues
    .filter((i) => byKey.has(i.issue_key) || (!!assignee && i.assignee_account_id === assignee))
    .map((i) => ({ i, d: classifyDelay({ due_date: i.due_date, resolved_at: i.resolved_at, status_category: i.status_category as "new" | "indeterminate" | "done" | "unknown", status: i.status, today }) }))
    .filter(({ i, d }) => d.state === "DELAYED" && (byKey.has(i.issue_key) || (i.due_date && i.due_date >= p.date_from && i.due_date <= p.date_to) || (i.resolved_at && i.resolved_at.slice(0, 10) >= p.date_from && i.resolved_at.slice(0, 10) <= p.date_to)))
    .map(({ i, d }) => ({ key: i.issue_key, summary: i.summary, project: i.project_key, assignee: i.assignee_name ?? "Unassigned", due: i.due_date ? formatDateShort(i.due_date) : "—", completed: i.resolved_at ? formatDateShort(i.resolved_at) : "Not completed", delay: d.days !== null ? `${d.days} day${d.days === 1 ? "" : "s"}` : "—", status: i.status, timesheet: byKey.get(i.issue_key) ?? "" }))
    .sort((a, b) => b.delay.localeCompare(a.delay, undefined, { numeric: true }));
}

export async function buildReportData(ctx: AppContext, p: ReportParams): Promise<ReportData> {
  validateParams(p);
  const f = filterFor(ctx, p);
  const { items } = await ctx.repos.timesheets.list(f, { offset: 0, limit: 5000 }, { column: "work_date", direction: "asc" });
  const summary = await ctx.repos.timesheets.summary(f);
  const links = await ctx.repos.jira.linksForTimesheets(items.map((t) => t.id));
  const cands = await ctx.repos.jira.candidatesForTimesheets(items.filter((t) => t.status === "APPROVED").map((t) => t.id));
  const errors = new Map<string, string>();
  const openErrors = await ctx.repos.jira.openSyncErrors({ offset: 0, limit: 500 });
  for (const e of openErrors.items) if (e.timesheet_id) errors.set(e.timesheet_id, e.reference);
  const issueKeys = [...new Set(items.map((t) => t.jira_issue_key).filter((k): k is string => !!k))];
  const issueMap = new Map((await Promise.all(issueKeys.map((k) => ctx.repos.jira.findIssue(k)))).filter((x) => !!x).map((i) => [i!.issue_key, i!]));
  const delayed = await delayedRows(ctx, p, f);
  const approvals = (await Promise.all(items.filter((t) => t.status !== "DRAFT").map(async (t) => ({ t, a: await ctx.repos.timesheets.approvals(t.id) }))));

  const project = p.project_id ? await ctx.repos.projects.findById(p.project_id) : null;
  const client = p.client_id ? await ctx.repos.clients.findById(p.client_id) : null;
  const clientProject = project ? `${project.client_name} — ${project.name}` : client ? client.name : "All projects";

  const byProject = new Map<string, { minutes: number; tasks: number; completed: number }>();
  const byDate = new Map<string, { minutes: number; tasks: number }>();
  for (const t of items) {
    const bp = byProject.get(t.project_code) ?? { minutes: 0, tasks: 0, completed: 0 };
    bp.minutes += t.duration_minutes; bp.tasks++; if (t.work_status === "COMPLETED") bp.completed++;
    byProject.set(t.project_code, bp);
    const bd = byDate.get(t.work_date) ?? { minutes: 0, tasks: 0 };
    bd.minutes += t.duration_minutes; bd.tasks++;
    byDate.set(t.work_date, bd);
  }
  const statusCounts = new Map<string, number>();
  for (const t of items) statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
  const synced = items.filter((t) => t.jira_sync_status === "SYNCED" || t.jira_sync_status === "LINKED").length;

  const titles: Record<ReportType, string> = { TIMESHEET_SUMMARY: "Timesheet Summary", DETAILED_TIMESHEET: "Detailed Timesheet", JIRA_RECONCILIATION: "Jira Reconciliation", DELAYED_TASKS: "Delayed Tasks", PROJECT_WORKLOAD: "Project Workload", HR_TIMESHEET: "HR Timesheet" };
  const periodLabel = `${formatDateLong(p.date_from)} – ${formatDateLong(p.date_to)}`;

  return {
    type: p.type, title: titles[p.type], app: ctx.env.APP_NAME || "Rais Timesheet", client_project: clientProject, period: { from: p.date_from, to: p.date_to, label: periodLabel },
    generated_at: nowIso(), generated_by: ctx.user?.name ?? "system", filters: p,
    kpis: [
      { label: "Total work", value: minutesToHuman(summary.minutes) }, { label: "Tasks", value: String(summary.count) }, { label: "Completed", value: String(summary.completed) },
      { label: "Approved", value: String(summary.approved) }, { label: "Delayed", value: String(delayed.length) }, { label: "Jira synced", value: String(synced) },
    ],
    hours_by_project: [...byProject.entries()].map(([project, v]) => ({ project, ...v })).sort((a, b) => b.minutes - a.minutes),
    hours_by_date: [...byDate.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    timesheets: items.map((t) => ({ reference: t.reference, date: t.work_date, day: DAY_NAMES[new Date(t.work_date + "T00:00:00Z").getUTCDay()]!, task: t.title, start: t.start_time ?? "", end: t.end_time ?? "", description: t.description, project: t.project_code, project_name: t.project_name, user: t.user_name, minutes: t.duration_minutes, work_status: label(t.work_status), approval: label(t.status), jira_key: t.jira_issue_key ?? "", jira_summary: t.jira_issue_key ? issueMap.get(t.jira_issue_key)?.summary ?? "" : "", lane_key: t.jira_issue_key ?? "other", lane_label: t.jira_issue_key ? `${t.jira_issue_key} ${issueMap.get(t.jira_issue_key)?.summary ?? ""}`.trim() : "Other work (no Jira issue)", jira_status: t.jira_issue_key ? issueMap.get(t.jira_issue_key)?.status ?? "" : label(t.jira_sync_status) })),
    reconciliation: items.filter((t) => t.status === "APPROVED").map((t) => {
      const l = links.get(t.id); const c = cands.get(t.id)?.[0];
      const match = l ? (l.match_type === "CREATED" ? "Created" : l.match_type === "EXACT" ? "Exact match" : l.match_type === "AI_SUGGESTED" ? "Suggested (accepted)" : "Manual") : c ? (c.result === "EXACT_MATCH" ? "Exact match" : "Suggested") : "No match";
      return { reference: t.reference, date: t.work_date, task: t.title, minutes: t.duration_minutes, match, jira_key: l?.jira_issue_key ?? c?.jira_issue_key ?? "", confidence: l?.match_confidence != null ? `${Math.round(l.match_confidence * 100)}%` : c ? `${Math.round(c.confidence * 100)}%` : "", sync_status: label(t.jira_sync_status), error_reference: errors.get(t.id) ?? "" };
    }),
    delayed,
    approvals: approvals.map(({ t, a }) => { const sub = a.find((x) => x.action === "SUBMITTED"); const dec = [...a].reverse().find((x) => x.action === "APPROVED" || x.action === "REJECTED"); return { reference: t.reference, task: t.title, submitted_by: t.user_name, submitted_at: sub?.created_at.slice(0, 10) ?? "", approved_by: dec?.actor_name ?? "", approved_at: dec?.created_at.slice(0, 10) ?? "", status: label(t.status) }; }),
    status_breakdown: [...statusCounts.entries()].map(([status, count]) => ({ status: label(status), count })),
  };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Public/audit version of the HR report: no client, project, Jira or task specifics — only activity type, dates, times, durations. */
export function simplifyReportData(d: ReportData): ReportData {
  const ALL = "All activities";
  const timesheets = d.timesheets.map((t) => {
    const category = auditCategory(t.task);
    return { ...t, task: category, description: "", project: ALL, project_name: ALL, jira_key: "", jira_summary: "", jira_status: "", lane_key: category, lane_label: category };
  });
  // In the simplified view "hours by project" carries hours by activity type instead.
  const byType = new Map<string, { minutes: number; tasks: number; completed: number }>();
  for (const t of timesheets) { const v = byType.get(t.task) ?? { minutes: 0, tasks: 0, completed: 0 }; v.minutes += t.minutes; v.tasks++; if (t.work_status === "Completed") v.completed++; byType.set(t.task, v); }
  return { ...d, client_project: "Summary of work activities", timesheets, hours_by_project: [...byType.entries()].map(([project, v]) => ({ project, ...v })).sort((a, b) => b.minutes - a.minutes), reconciliation: [], delayed: [], approvals: [] };
}

export function label(s: string): string {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function renderXlsx(d: ReportData): Uint8Array {
  const sub = `${d.client_project} · ${d.period.label} · Generated ${d.generated_at.slice(0, 16).replace("T", " ")} by ${d.generated_by}`;
  const totalMin = d.timesheets.reduce((a, t) => a + t.minutes, 0);
  if (d.type === "HR_TIMESHEET") return buildHrXlsx(d);
  const sheets: Sheet[] = [
    {
      name: "Summary", title: `${d.app} — ${d.title}`, subtitle: sub, autofilter: false, freeze: false,
      columns: [{ header: "Metric", width: 28 }, { header: "Value", width: 18 }, { header: "", width: 4 }, { header: "Project", width: 16 }, { header: "Tasks", width: 10, type: "number" }, { header: "Hours", width: 12, type: "duration" }, { header: "Completion", width: 12, type: "percent" }],
      rows: Array.from({ length: Math.max(d.kpis.length, d.hours_by_project.length) }, (_, i) => { const k = d.kpis[i]; const p = d.hours_by_project[i]; return [k?.label ?? "", k?.value ?? "", "", p?.project ?? "", p ? p.tasks : "", p ? p.minutes : "", p ? (p.tasks ? p.completed / p.tasks : 0) : ""]; }),
    },
    {
      name: "Timesheets", title: "Detailed Timesheets", subtitle: sub,
      columns: [{ header: "Reference", width: 16 }, { header: "Date", width: 13, type: "date" }, { header: "Task", width: 46 }, { header: "Description", width: 60 }, { header: "Project", width: 10 }, { header: "User", width: 16 }, { header: "Duration", width: 11, type: "duration" }, { header: "Work status", width: 13 }, { header: "Approval", width: 12 }, { header: "Jira", width: 12 }, { header: "Jira status", width: 14 }],
      rows: d.timesheets.map((t) => [t.reference, t.date, t.task, t.description, t.project, t.user, t.minutes, t.work_status, t.approval, t.jira_key, t.jira_status]),
      totals: ["Total", "", `${d.timesheets.length} entries`, "", "", "", totalMin, "", "", "", ""],
    },
    {
      name: "Jira Reconciliation", title: "Jira Reconciliation (approved work)", subtitle: sub,
      columns: [{ header: "Reference", width: 16 }, { header: "Date", width: 13, type: "date" }, { header: "Task", width: 46 }, { header: "Duration", width: 11, type: "duration" }, { header: "Match", width: 20 }, { header: "Jira key", width: 12 }, { header: "Confidence", width: 12 }, { header: "Sync status", width: 16 }, { header: "Error ref", width: 22 }],
      rows: d.reconciliation.map((r) => [r.reference, r.date, r.task, r.minutes, r.match, r.jira_key, r.confidence, r.sync_status, r.error_reference]),
    },
    {
      name: "Delayed Tasks", title: "Delayed Tasks", subtitle: sub,
      columns: [{ header: "Key", width: 12 }, { header: "Summary", width: 46 }, { header: "Project", width: 10 }, { header: "Assignee", width: 16 }, { header: "Due", width: 13 }, { header: "Completed", width: 14 }, { header: "Delay", width: 10 }, { header: "Status", width: 14 }, { header: "Timesheet", width: 16 }],
      rows: d.delayed.map((r) => [r.key, r.summary, r.project, r.assignee, r.due, r.completed, r.delay, r.status, r.timesheet]),
    },
    {
      name: "Audit", title: "Approval Summary", subtitle: sub,
      columns: [{ header: "Reference", width: 16 }, { header: "Task", width: 46 }, { header: "Submitted by", width: 16 }, { header: "Submitted", width: 13, type: "date" }, { header: "Decided by", width: 16 }, { header: "Decided", width: 13, type: "date" }, { header: "Status", width: 12 }],
      rows: d.approvals.map((a) => [a.reference, a.task, a.submitted_by, a.submitted_at, a.approved_by, a.approved_at, a.status]),
    },
  ];
  return buildXlsx(sheets);
}

export function renderPdf(d: ReportData): Uint8Array {
  if (d.type === "HR_TIMESHEET") return buildHrPdf(d);
  const sections: PdfDocSpec["sections"] = [];
  const hoursByProject = { title: "Hours by Project", columns: [{ header: "Project", width: 3 }, { header: "Tasks", width: 1, align: "right" as const }, { header: "Hours", width: 1.5, align: "right" as const }, { header: "Completion", width: 1.5, align: "right" as const }], rows: d.hours_by_project.map((p) => [p.project, String(p.tasks), minutesToHuman(p.minutes), `${Math.round((p.tasks ? p.completed / p.tasks : 0) * 100)}%`]), totals: ["Total", String(d.hours_by_project.reduce((a, p) => a + p.tasks, 0)), minutesToHuman(d.hours_by_project.reduce((a, p) => a + p.minutes, 0)), ""] };
  const hoursByDate = { title: "Hours by Date", columns: [{ header: "Date", width: 2 }, { header: "Tasks", width: 1, align: "right" as const }, { header: "Hours", width: 1.5, align: "right" as const }], rows: d.hours_by_date.map((x) => [formatDateShort(x.date), String(x.tasks), minutesToHuman(x.minutes)]) };
  const detailed = { title: "Detailed Timesheets", columns: [{ header: "Ref", width: 1.4 }, { header: "Date", width: 1.2 }, { header: "Task", width: 4 }, { header: "Project", width: 0.9 }, { header: "Duration", width: 1, align: "right" as const }, { header: "Status", width: 1.2 }, { header: "Approval", width: 1.1 }, { header: "Jira", width: 1.1 }], rows: d.timesheets.map((t) => [t.reference, formatDateShort(t.date), t.task, t.project, minutesToHuman(t.minutes), t.work_status, t.approval, t.jira_key || "—"]), totals: ["Total", "", `${d.timesheets.length} entries`, "", minutesToHuman(d.timesheets.reduce((a, t) => a + t.minutes, 0)), "", "", ""] };
  const delayed = { title: "Delayed Tasks", columns: [{ header: "Key", width: 1.1 }, { header: "Summary", width: 4 }, { header: "Assignee", width: 1.5 }, { header: "Due", width: 1.2 }, { header: "Completed", width: 1.3 }, { header: "Delay", width: 0.9, align: "right" as const }, { header: "Status", width: 1.2 }], rows: d.delayed.map((r) => [r.key, r.summary, r.assignee, r.due, r.completed, r.delay, r.status]), note: "A task is only reported as delayed when Jira has a reliable due date." };
  const recon = { title: "Jira Reconciliation", columns: [{ header: "Ref", width: 1.4 }, { header: "Date", width: 1.2 }, { header: "Task", width: 4 }, { header: "Match", width: 1.6 }, { header: "Jira", width: 1.1 }, { header: "Conf.", width: 0.8, align: "right" as const }, { header: "Sync", width: 1.3 }, { header: "Error ref", width: 1.8 }], rows: d.reconciliation.map((r) => [r.reference, formatDateShort(r.date), r.task, r.match, r.jira_key || "—", r.confidence, r.sync_status, r.error_reference]) };
  const approvals = { title: "Approval Summary", columns: [{ header: "Ref", width: 1.4 }, { header: "Task", width: 4 }, { header: "Submitted by", width: 1.6 }, { header: "Submitted", width: 1.2 }, { header: "Decided by", width: 1.6 }, { header: "Decided", width: 1.2 }, { header: "Status", width: 1.1 }], rows: d.approvals.map((a) => [a.reference, a.task, a.submitted_by, a.submitted_at ? formatDateShort(a.submitted_at) : "—", a.approved_by || "—", a.approved_at ? formatDateShort(a.approved_at) : "—", a.status]) };
  const workload = { title: "Project Workload", columns: hoursByProject.columns, rows: hoursByProject.rows, totals: hoursByProject.totals };

  switch (d.type) {
    case "TIMESHEET_SUMMARY": sections.push(hoursByProject, hoursByDate, detailed, delayed, recon, approvals); break;
    case "DETAILED_TIMESHEET": sections.push(detailed, hoursByDate); break;
    case "JIRA_RECONCILIATION": sections.push(recon); break;
    case "DELAYED_TASKS": sections.push(delayed); break;
    case "PROJECT_WORKLOAD": sections.push(workload, hoursByDate); break;
  }
  return buildPdf({ app: d.app, title: d.title, subtitle: d.client_project, period: d.period.label, generated_by: d.generated_by, generated_at: d.generated_at.slice(0, 16).replace("T", " ") + " UTC", kpis: d.kpis, sections });
}
