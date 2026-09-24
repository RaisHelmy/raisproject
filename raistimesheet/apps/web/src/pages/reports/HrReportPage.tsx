import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ProjectDTO, ReportJobDTO, TimesheetDTO } from "@rais/shared-types";
import { auditCategory } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { fetchAllTimesheetIds } from "@/services/bulk";
import { ApiError, api, downloadUrl } from "@/services/api";
import { Card, EmptyState, ErrorAlert, PageHeader, Spinner, useToast } from "@/components/ui";
import { addDays, dateShortcut, fmtDate, formatMinutes, todayIso } from "@/services/format";
import { TimelineChart, type TimelineTask } from "@/components/TimelineChart";
import { useAuth } from "@/services/auth";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ENGAGEMENT_START = "2026-02-01";
const BOOTSWATCH = ["cerulean", "cosmo", "cyborg", "darkly", "flatly", "journal", "litera", "lumen", "lux", "materia", "minty", "morph", "pulse", "quartz", "sandstone", "simplex", "sketchy", "slate", "solar", "spacelab", "superhero", "united", "vapor", "yeti", "zephyr"];
const DEFAULT_THEME = "yeti";
const THEME_KEY = "rts.hr.theme";

/** Swaps in a Bootswatch build of Bootstrap while the HR report is open; the app's own stylesheet is restored on unmount. */
function useBootswatch(theme: string): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!BOOTSWATCH.includes(theme)) { setReady(true); return; }
    setReady(false);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://cdn.jsdelivr.net/npm/bootswatch@5.3.8/dist/${theme}/bootstrap.min.css`;
    link.onload = () => setReady(true);
    link.onerror = () => setReady(true);
    document.head.appendChild(link);
    return () => { link.remove(); };
  }, [theme]);
  return ready;
}

function dayName(iso: string) { return DAYS[new Date(iso + "T00:00:00").getDay()]!; }
function weekStart(iso: string) { return addDays(iso, -((new Date(iso + "T00:00:00").getDay() + 6) % 7)); }
function sortRows(rows: TimesheetDTO[]) {
  return [...rows].sort((a, b) => a.work_date.localeCompare(b.work_date) || (a.start_time ?? "99:99").localeCompare(b.start_time ?? "99:99") || a.reference.localeCompare(b.reference));
}

export default function HrReportPage({ print = false }: { print?: boolean }) {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const from = sp.get("date_from") ?? ENGAGEMENT_START;
  const to = sp.get("date_to") ?? todayIso();
  const projectId = sp.get("project_id") ?? "";
  const status = sp.get("status") ?? "APPROVED";
  const theme = sp.get("theme") ?? (() => { try { return localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME; } catch { return DEFAULT_THEME; } })();
  const themeReady = useBootswatch(theme);
  const projects = useApi<ProjectDTO[]>(print ? null : "/projects");
  const issues = useApi<{ items: { issue_key: string; summary: string }[] }>("/jira/issues", { filter: "all", page_size: 200 });
  const [rawRows, setRows] = useState<TimesheetDTO[] | null>(null);
  const simple = sp.get("simple") === "1";
  const rows = useMemo(() => {
    if (!rawRows || !simple) return rawRows;
    return rawRows.map((r) => ({ ...r, title: auditCategory(r.title), description: "", project_code: "All activities", project_name: "All activities", jira_issue_key: null }));
  }, [rawRows, simple]);
  const [error, setError] = useState<ApiError | null>(null);
  const act = useAction();
  const toast = useToast();

  const set = (patch: Record<string, string>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); } setSp(n); };

  useEffect(() => {
    let live = true;
    setRows(null); setError(null);
    fetchAllTimesheetIds({ scope: "mine", status: status || undefined, date_from: from, date_to: to, project_id: projectId, sort: "work_date", dir: "asc" })
      .then((r) => { if (live) setRows(sortRows(r)); })
      .catch((e: unknown) => { if (live) setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", e instanceof Error ? e.message : String(e), 0)); });
    return () => { live = false; };
  }, [from, to, projectId, status]);

  useEffect(() => { if (print && rows && themeReady) { const t = setTimeout(() => window.print(), 900); return () => clearTimeout(t); } }, [print, rows, themeReady]);
  const setTheme = (t: string) => { try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ } set({ theme: t }); };

  const byDate = useMemo(() => {
    const m = new Map<string, TimesheetDTO[]>();
    for (const r of rows ?? []) m.set(r.work_date, [...(m.get(r.work_date) ?? []), r]);
    return [...m.entries()];
  }, [rows]);
  const total = (rows ?? []).reduce((a, r) => a + r.duration_minutes, 0);
  const projectCodes = [...new Set((rows ?? []).map((r) => r.project_code))];
  const untimed = (rows ?? []).filter((r) => !r.start_time || !r.end_time).length;
  const timelineTasks = useMemo<TimelineTask[]>(() => {
    const summary = new Map((issues.data?.items ?? []).map((i) => [i.issue_key, i.summary]));
    return (rows ?? []).map((r) => ({ date: r.work_date, minutes: r.duration_minutes, title: r.title, project: r.project_code, project_name: r.project_name, start: r.start_time, end: r.end_time, group: simple ? r.title : r.jira_issue_key ?? "other", group_label: simple ? r.title : r.jira_issue_key ? `${r.jira_issue_key} ${summary.get(r.jira_issue_key) ?? ""}`.trim() : "Other work (no Jira issue)" }));
  }, [rows, issues.data, simple]);
  const download = async (format: "XLSX" | "PDF") => {
    const r = await act.run(() => api<ReportJobDTO>("/reports", { body: { type: "HR_TIMESHEET", date_from: from, date_to: to, project_id: projectId || null, client_id: null, user_id: null, status: status || null, jira_sync_status: null, simplified: simple, format } }));
    if (r) { toast.show(`${format} file ready`); window.location.assign(downloadUrl(`/reports/${r.data.id}/download`)); }
  };

  const period = `${fmtDate(from, "long")} – ${fmtDate(to, "long")}`;
  const project = projects.data?.find((p) => p.id === projectId);

  const table = rows && (
    <div className="table-responsive">
      <table className="table table-sm table-bordered align-middle mb-0 hr-table">
        <thead className="table-light"><tr><th style={{ width: 36 }}>No</th><th style={{ width: 88 }}>Date</th><th style={{ width: 84 }}>Day</th>{!simple && <th style={{ width: 76 }}>Project</th>}<th>{simple ? "Activity" : "Task"}</th><th style={{ width: 56 }}>Start</th><th style={{ width: 56 }}>End</th><th style={{ width: 76 }} className="text-end">Duration</th></tr></thead>
        <tbody>
          {(() => {
            let n = 0;
            return byDate.map(([date, items]) => {
              const dayTotal = items.reduce((a, r) => a + r.duration_minutes, 0);
              return [
                ...items.map((r, i) => {
                  n++;
                  return (
                    <tr key={r.id}>
                      <td className="text-secondary">{n}</td>
                      {i === 0 && <td rowSpan={items.length} className="fw-semibold text-nowrap">{fmtDate(date)}</td>}
                      {i === 0 && <td rowSpan={items.length} className="text-nowrap">{dayName(date)}</td>}
                      {!simple && <td><span className="badge text-bg-light border">{r.project_code}</span></td>}
                      <td>{print || simple ? r.title : <Link to={`/timesheets/${r.id}`} className="text-reset text-decoration-none">{r.title}</Link>}</td>
                      <td className="text-nowrap">{r.start_time ?? "—"}</td>
                      <td className="text-nowrap">{r.end_time ?? "—"}</td>
                      <td className="text-end text-nowrap">{formatMinutes(r.duration_minutes)}</td>
                    </tr>
                  );
                }),
                <tr key={`${date}-total`} className="table-light hr-subtotal"><td colSpan={simple ? 6 : 7} className="text-end small text-secondary">Total {fmtDate(date)}</td><td className="text-end fw-semibold text-nowrap">{formatMinutes(dayTotal)}</td></tr>,
              ];
            });
          })()}
        </tbody>
        <tfoot><tr className="table-primary"><td colSpan={simple ? 6 : 7} className="text-end fw-bold">Grand total — {rows.length} tasks over {byDate.length} days</td><td className="text-end fw-bold text-nowrap">{formatMinutes(total)}</td></tr></tfoot>
      </table>
    </div>
  );

  const header = (
    <dl className="row mb-0 small">
      <dt className="col-4 col-md-2">Name</dt><dd className="col-8 col-md-4">{user?.name}</dd>
      {!simple && <><dt className="col-4 col-md-2">Email</dt><dd className="col-8 col-md-4">{user?.email}</dd></>}
      <dt className="col-4 col-md-2">Period</dt><dd className="col-8 col-md-4">{period}</dd>
      {!simple && <><dt className="col-4 col-md-2">Projects</dt><dd className="col-8 col-md-4">{projectCodes.join(", ") || "—"}</dd></>}
      <dt className="col-4 col-md-2">Total hours</dt><dd className="col-8 col-md-4">{formatMinutes(total)} ({(total / 60).toFixed(2)} h)</dd>
      <dt className="col-4 col-md-2">Working days</dt><dd className="col-8 col-md-4">{byDate.length}</dd>
    </dl>
  );

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const groupKey = (r: TimesheetDTO) => (simple ? r.title : r.project_code);
  const byProject = [...new Set((rows ?? []).map(groupKey))].map((code) => {
    const items = (rows ?? []).filter((r) => groupKey(r) === code);
    return { code, name: items[0]?.project_name ?? "", tasks: items.length, days: new Set(items.map((r) => r.work_date)).size, minutes: items.reduce((a, r) => a + r.duration_minutes, 0) };
  }).sort((a, b) => b.minutes - a.minutes);
  const byMonth = [...(rows ?? []).reduce((m, r) => { const k = r.work_date.slice(0, 7); const v = m.get(k) ?? { tasks: 0, minutes: 0, days: new Set<string>() }; v.tasks++; v.minutes += r.duration_minutes; v.days.add(r.work_date); return m.set(k, v); }, new Map<string, { tasks: number; minutes: number; days: Set<string> }>()).entries()].sort();
  const overview = rows && (
    <>
      <div className="row g-2 mb-3">
        {[["Total hours", formatMinutes(total)], ["Tasks", String(rows.length)], ["Working days", String(byDate.length)], ["Avg per working day", formatMinutes(byDate.length ? Math.round(total / byDate.length) : 0)]].map(([l, v]) => (
          <div key={l} className="col-6 col-md-3"><div className="border rounded p-2 h-100 bg-body-tertiary"><div className="small text-secondary text-uppercase" style={{ fontSize: 11 }}>{l}</div><div className="fs-4 fw-bold">{v}</div></div></div>
        ))}
      </div>
      <div className="mb-3">{header}</div>
      <div className="row g-3">
        <div className="col-lg-7">
          <h3 className="h6">{simple ? "Hours by activity type" : "Hours by project"}</h3>
          <table className="table table-sm table-bordered mb-0 hr-table"><thead className="table-light"><tr><th>{simple ? "Activity type" : "Project"}</th><th className="text-end">Tasks</th><th className="text-end">Days</th><th className="text-end">Hours</th><th className="text-end">Share</th></tr></thead>
            <tbody>{byProject.map((p) => <tr key={p.code}><td>{simple ? p.code : <><span className="badge text-bg-light border me-1">{p.code}</span>{p.name}</>}</td><td className="text-end">{p.tasks}</td><td className="text-end">{p.days}</td><td className="text-end text-nowrap">{formatMinutes(p.minutes)}</td><td className="text-end">{total ? Math.round((p.minutes / total) * 100) : 0}%</td></tr>)}</tbody>
            <tfoot><tr className="table-light fw-bold"><td>Total</td><td className="text-end">{rows.length}</td><td className="text-end">{byDate.length}</td><td className="text-end text-nowrap">{formatMinutes(total)}</td><td className="text-end">100%</td></tr></tfoot></table>
        </div>
        <div className="col-lg-5">
          <h3 className="h6">Hours by month</h3>
          <table className="table table-sm table-bordered mb-0 hr-table"><thead className="table-light"><tr><th>Month</th><th className="text-end">Days</th><th className="text-end">Tasks</th><th className="text-end">Hours</th></tr></thead>
            <tbody>{byMonth.map(([k, m]) => <tr key={k}><td>{MONTH_NAMES[Number(k.slice(5, 7)) - 1]} {k.slice(0, 4)}</td><td className="text-end">{m.days.size}</td><td className="text-end">{m.tasks}</td><td className="text-end text-nowrap">{formatMinutes(m.minutes)}</td></tr>)}</tbody>
            <tfoot><tr className="table-light fw-bold"><td>Total</td><td className="text-end">{byDate.length}</td><td className="text-end">{rows.length}</td><td className="text-end text-nowrap">{formatMinutes(total)}</td></tr></tfoot></table>
        </div>
      </div>
    </>
  );
  const timelineNote = simple ? "One lane per activity type · bar spans first to last work day · darker marks are actual work days" : "One lane per deliverable (Jira issue) under its project · bar spans first to last work day · darker marks are actual work days";
  const timelineTitle = simple ? "Activity timeline" : "Project timeline";

  if (print) {
    return (
      <div className="hr-print">
        <style>{`@page { size: A4 portrait; margin: 25.4mm; }`}</style>
        <div className="no-print d-flex justify-content-between align-items-center mb-3"><a href="/reports/hr" className="btn btn-sm btn-outline-secondary">← Back to HR Timesheet</a><button className="btn btn-sm btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print / Save as PDF (A4 portrait)</button></div>
        <h1 className="h4 mb-1">Timesheet — {user?.name}</h1>
        <div className="text-secondary small mb-3">{status === "APPROVED" ? "Approved work only" : "All recorded work"}{simple ? " · summary of work activities" : ""} · generated {fmtDate(new Date().toISOString().slice(0, 10), "long")}</div>
        <ErrorAlert error={error} />
        {!rows ? <Spinner /> : <>
          <section className="hr-print-overview">
            <h2 className="h5 mb-3">1. Overview</h2>
            {overview}
          </section>
          <section className="hr-print-timeline">
            <h2 className="h5 mb-1">2. {timelineTitle}</h2>
            <div className="small text-secondary mb-2">{timelineNote}</div>
            <TimelineChart flat={simple} from={from} to={to} tasks={timelineTasks} width={960} print />
          </section>
          <section className="hr-print-table">
            <h2 className="h5 mb-3">3. Daily timesheet</h2>
            {table}
          </section>
        </>}
      </div>
    );
  }

  const printHref = `/reports/hr/print?${new URLSearchParams({ date_from: from, date_to: to, ...(projectId ? { project_id: projectId } : {}), status, theme, ...(simple ? { simple: "1" } : {}) }).toString()}`;
  return (
    <div>
      <PageHeader title="HR Timesheet" subtitle="Your own work only — one row per task with start and end time, with a project timeline. Same layout as the downloads — 1 Overview, 2 Project timeline, 3 Daily timesheet (PDF pages / Excel sheets) or export to Excel to submit to HR."
        breadcrumb={[{ label: "Report Center", to: "/reports" }, { label: "HR Timesheet" }]}
        actions={<>{rows && rows.length > 0 && <><button className="btn btn-primary" onClick={() => download("PDF")} disabled={act.busy}><i className="bi bi-file-earmark-pdf me-1" />Download PDF</button><button className="btn btn-outline-primary" onClick={() => download("XLSX")} disabled={act.busy}><i className="bi bi-file-earmark-excel me-1" />Download Excel</button></>}<Link to={printHref} target="_blank" className="btn btn-outline-secondary"><i className="bi bi-printer me-1" />Print view</Link></>} />
      <Card className="mb-3">
        <div className="mb-2"><div className="btn-group btn-group-sm flex-wrap" role="group" aria-label="Period shortcuts">{[["all", "Since 1 Feb 2026"], ["this_week", "This Week"], ["last_week", "Last Week"], ["this_month", "This Month"], ["last_month", "Last Month"], ["quarter", "Quarter"]].map(([k, l]) => { const r = k === "all" ? { from: ENGAGEMENT_START, to: todayIso() } : dateShortcut(k!); return <button key={k} className={`btn btn-outline-secondary${r.from === from && r.to === to ? " active" : ""}`} onClick={() => set({ date_from: r.from, date_to: r.to })}>{l}</button>; })}</div></div>
        <div className="row g-2">
          <div className="col-6 col-md-3"><label className="form-label small mb-0" htmlFor="hr-from">From</label><input id="hr-from" type="date" className="form-control form-control-sm" value={from} onChange={(e) => set({ date_from: e.target.value })} /></div>
          <div className="col-6 col-md-3"><label className="form-label small mb-0" htmlFor="hr-to">To</label><input id="hr-to" type="date" className="form-control form-control-sm" value={to} onChange={(e) => set({ date_to: e.target.value })} /></div>
          <div className="col-md-3"><label className="form-label small mb-0" htmlFor="hr-project">Project</label><select id="hr-project" className="form-select form-select-sm" value={projectId} onChange={(e) => set({ project_id: e.target.value })}><option value="">All projects</option>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></div>
          <div className="col-md-3"><label className="form-label small mb-0" htmlFor="hr-theme">Theme (Bootswatch)</label><select id="hr-theme" className="form-select form-select-sm" value={theme} onChange={(e) => setTheme(e.target.value)}>{BOOTSWATCH.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}{t === DEFAULT_THEME ? " (default)" : ""}</option>)}</select></div>
          <div className="col-md-3"><label className="form-label small mb-0" htmlFor="hr-status">Include</label><select id="hr-status" className="form-select form-select-sm" value={status} onChange={(e) => set({ status: e.target.value })}><option value="APPROVED">Approved only</option><option value="">All statuses</option></select></div>
        </div>
        <div className="form-check form-switch mt-3 mb-0">
          <input className="form-check-input" type="checkbox" role="switch" id="hr-simple" checked={simple} onChange={(e) => set({ simple: e.target.checked ? "1" : "" })} />
          <label className="form-check-label" htmlFor="hr-simple"><strong>Simplified view</strong> <span className="text-secondary small">— for public / audit sharing: work is shown by activity type only, with dates, times and hours. Applies to the page, PDF and Excel.</span></label>
        </div>
      </Card>
      {simple && <div className="alert alert-info py-2 small"><i className="bi bi-eye-slash me-1" />Simplified view is on — work is shown by activity type only.</div>}
      <ErrorAlert error={error} /><ErrorAlert error={act.error} />
      {!rows ? <Spinner /> : rows.length === 0 ? <Card><EmptyState icon="calendar-x" title="No work in this period." body={project ? `Nothing recorded for ${project.code}.` : "Try a different period."} /></Card> : <>
        <Card title="1. Overview" className="mb-3">{overview}{untimed > 0 && <div className="alert alert-warning py-2 small mt-3 mb-0">{untimed} task{untimed === 1 ? " has" : "s have"} no start/end time. Open the task to add times.</div>}</Card>
        <Card title={`2. ${timelineTitle}`} className="mb-3"><div className="small text-secondary mb-2">{timelineNote} · hover for details</div><TimelineChart flat={simple} from={from} to={to} tasks={timelineTasks} width={Math.max(1100, Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000) * 5)} /></Card>
        <Card title="3. Daily timesheet" className="mb-3 p-0">{table}</Card>
      </>}
      {toast.node}
    </div>
  );
}
