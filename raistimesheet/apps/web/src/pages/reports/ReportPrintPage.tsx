import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import { ErrorAlert, Spinner } from "@/components/ui";
import { fmtDate, fmtDateTime, formatMinutes } from "@/services/format";

interface ReportData {
  type: string; title: string; app: string; client_project: string; period: { from: string; to: string; label: string }; generated_at: string; generated_by: string;
  kpis: { label: string; value: string }[]; hours_by_project: { project: string; minutes: number; tasks: number; completed: number }[]; hours_by_date: { date: string; minutes: number; tasks: number }[];
  timesheets: { reference: string; date: string; task: string; description: string; project: string; user: string; minutes: number; work_status: string; approval: string; jira_key: string; jira_status: string }[];
  reconciliation: { reference: string; date: string; task: string; minutes: number; match: string; jira_key: string; confidence: string; sync_status: string; error_reference: string }[];
  delayed: { key: string; summary: string; project: string; assignee: string; due: string; completed: string; delay: string; status: string; timesheet: string }[];
  approvals: { reference: string; task: string; submitted_by: string; submitted_at: string; approved_by: string; approved_at: string; status: string }[];
}

/** Print-ready report view (browser print → PDF). Hides all application chrome. */
export default function ReportPrintPage() {
  const [sp] = useSearchParams();
  const q = Object.fromEntries(sp.entries());
  const d = useApi<ReportData>("/reports/data", q);
  useEffect(() => { if (d.data) document.title = `${d.data.title} — ${d.data.client_project}`; }, [d.data]);
  if (d.error) return <div className="p-4"><ErrorAlert error={d.error} /></div>;
  if (!d.data) return <div className="p-4"><Spinner label="Preparing report…" /></div>;
  const r = d.data;
  const show = (s: string) => r.type === "TIMESHEET_SUMMARY" || r.type === s;
  const totalMin = r.timesheets.reduce((a, t) => a + t.minutes, 0);
  return (
    <div className="p-3 p-md-4" style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`@page { size: A4 landscape; margin: 14mm; }`}</style>
      <div className="no-print d-flex justify-content-between align-items-center mb-3"><a href="/reports" className="btn btn-sm btn-outline-secondary">← Back to Report Center</a><button className="btn btn-sm btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print / Save as PDF</button></div>
      <div className="report-view">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div><div className="text-uppercase small text-secondary fw-semibold">{r.app}</div><div className="report-title">{r.title}</div><div>{r.client_project}</div><div className="text-secondary">{r.period.label}</div></div>
          <div className="text-end small text-secondary">Generated {fmtDateTime(r.generated_at)}<br />by {r.generated_by}</div>
        </div>
        <div className="report-kpis">{r.kpis.map((k) => <div key={k.label} className="report-kpi"><div className="k">{k.label}</div><div className="v">{k.value}</div></div>)}</div>

        {(show("PROJECT_WORKLOAD")) && r.hours_by_project.length > 0 && (<><div className="report-section-title">Hours by Project</div><table className="report-table"><thead><tr><th>Project</th><th className="text-end">Tasks</th><th className="text-end">Hours</th><th className="text-end">Completion</th></tr></thead><tbody>{r.hours_by_project.map((p) => <tr key={p.project}><td>{p.project}</td><td className="text-end">{p.tasks}</td><td className="text-end">{formatMinutes(p.minutes)}</td><td className="text-end">{Math.round((p.tasks ? p.completed / p.tasks : 0) * 100)}%</td></tr>)}<tr className="total"><td>Total</td><td className="text-end">{r.hours_by_project.reduce((a, p) => a + p.tasks, 0)}</td><td className="text-end">{formatMinutes(r.hours_by_project.reduce((a, p) => a + p.minutes, 0))}</td><td /></tr></tbody></table></>)}
        {(show("DETAILED_TIMESHEET") || r.type === "PROJECT_WORKLOAD") && r.hours_by_date.length > 0 && (<><div className="report-section-title">Hours by Date</div><table className="report-table"><thead><tr><th>Date</th><th className="text-end">Tasks</th><th className="text-end">Hours</th></tr></thead><tbody>{r.hours_by_date.map((x) => <tr key={x.date}><td>{fmtDate(x.date)}</td><td className="text-end">{x.tasks}</td><td className="text-end">{formatMinutes(x.minutes)}</td></tr>)}</tbody></table></>)}
        {show("DETAILED_TIMESHEET") && (<><div className="report-section-title">Detailed Timesheets</div>{r.timesheets.length === 0 ? <p className="text-secondary">No records for this period.</p> : <table className="report-table"><thead><tr><th>Ref</th><th>Date</th><th>Task</th><th>Project</th><th className="text-end">Duration</th><th>Status</th><th>Approval</th><th>Jira</th></tr></thead><tbody>{r.timesheets.map((t) => <tr key={t.reference}><td>{t.reference}</td><td className="text-nowrap">{fmtDate(t.date)}</td><td>{t.task}{r.type === "DETAILED_TIMESHEET" && t.description && <div className="small text-secondary">{t.description.split("\n")[0]}</div>}</td><td>{t.project}</td><td className="text-end text-nowrap">{formatMinutes(t.minutes)}</td><td>{t.work_status}</td><td>{t.approval}</td><td>{t.jira_key || "—"}</td></tr>)}<tr className="total"><td>Total</td><td /><td>{r.timesheets.length} entries</td><td /><td className="text-end">{formatMinutes(totalMin)}</td><td colSpan={3} /></tr></tbody></table>}</>)}
        {show("DELAYED_TASKS") && (<><div className="report-section-title">Delayed Tasks</div>{r.delayed.length === 0 ? <p className="text-secondary">No delayed tasks in this period.</p> : <table className="report-table"><thead><tr><th>Key</th><th>Summary</th><th>Assignee</th><th>Due</th><th>Completed</th><th className="text-end">Delay</th><th>Status</th></tr></thead><tbody>{r.delayed.map((x) => <tr key={x.key}><td>{x.key}</td><td>{x.summary}</td><td>{x.assignee}</td><td>{x.due}</td><td>{x.completed}</td><td className="text-end">{x.delay}</td><td>{x.status}</td></tr>)}</tbody></table>}<p className="small text-secondary mt-1">A task is only reported as delayed when Jira has a reliable due date.</p></>)}
        {show("JIRA_RECONCILIATION") && (<><div className="report-section-title">Jira Reconciliation</div>{r.reconciliation.length === 0 ? <p className="text-secondary">No approved work in this period.</p> : <table className="report-table"><thead><tr><th>Ref</th><th>Date</th><th>Task</th><th>Match</th><th>Jira</th><th className="text-end">Conf.</th><th>Sync</th><th>Error ref</th></tr></thead><tbody>{r.reconciliation.map((x) => <tr key={x.reference}><td>{x.reference}</td><td className="text-nowrap">{fmtDate(x.date)}</td><td>{x.task}</td><td>{x.match}</td><td>{x.jira_key || "—"}</td><td className="text-end">{x.confidence}</td><td>{x.sync_status}</td><td>{x.error_reference}</td></tr>)}</tbody></table>}</>)}
        {r.type === "TIMESHEET_SUMMARY" && r.approvals.length > 0 && (<><div className="report-section-title">Approval Summary</div><table className="report-table"><thead><tr><th>Ref</th><th>Task</th><th>Submitted by</th><th>Submitted</th><th>Decided by</th><th>Decided</th><th>Status</th></tr></thead><tbody>{r.approvals.map((a) => <tr key={a.reference}><td>{a.reference}</td><td>{a.task}</td><td>{a.submitted_by}</td><td>{a.submitted_at ? fmtDate(a.submitted_at) : "—"}</td><td>{a.approved_by || "—"}</td><td>{a.approved_at ? fmtDate(a.approved_at) : "—"}</td><td>{a.status}</td></tr>)}</tbody></table></>)}
        <div className="report-footer d-flex justify-content-between"><span>{r.app} · {r.client_project} · {r.period.label}</span><span>Generated {fmtDateTime(r.generated_at)} by {r.generated_by}</span></div>
      </div>
    </div>
  );
}
