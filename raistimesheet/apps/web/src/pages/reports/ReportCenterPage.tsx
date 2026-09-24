import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ClientDTO, ProjectDTO, ReportJobDTO, ReportPreviewDTO, ReportType, UserDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api, buildQuery, downloadUrl } from "@/services/api";
import { Card, ErrorAlert, PageHeader, Spinner, StatusBadge, Steps, useToast } from "@/components/ui";
import { dateShortcut, fmtDate, fmtDateTime, formatMinutes, humanize } from "@/services/format";
import { useAuth } from "@/services/auth";

const TYPES: { value: ReportType; label: string; desc: string }[] = [
  { value: "TIMESHEET_SUMMARY", label: "Timesheet Summary", desc: "KPIs, hours by project and date, plus detail." },
  { value: "DETAILED_TIMESHEET", label: "Detailed Timesheet", desc: "Every entry with description, approval and Jira." },
  { value: "JIRA_RECONCILIATION", label: "Jira Reconciliation", desc: "Approved work versus Jira, with sync status." },
  { value: "DELAYED_TASKS", label: "Delayed Tasks", desc: "Tasks completed after their Jira due date." },
  { value: "PROJECT_WORKLOAD", label: "Project Workload", desc: "Task count, hours and completion per project." },
  { value: "HR_TIMESHEET", label: "HR Timesheet", desc: "Overview, landscape project timeline and daily table with start/end times." },
];
const SHORTCUTS = [["today", "Today"], ["this_week", "This Week"], ["last_week", "Last Week"], ["this_month", "This Month"], ["last_month", "Last Month"], ["quarter", "Quarter"]];

export default function ReportCenterPage() {
  const { isApprover } = useAuth();
  const projects = useApi<ProjectDTO[]>("/projects", { all: 1 });
  const clients = useApi<ClientDTO[]>("/clients");
  const users = useApi<UserDTO[]>(isApprover ? "/admin/users" : null);
  const init = dateShortcut("this_month");
  const [p, setP] = useState({ type: "TIMESHEET_SUMMARY" as ReportType, date_from: init.from, date_to: init.to, project_id: "", client_id: "", user_id: "", status: "", jira_sync_status: "" });
  const [shortcut, setShortcut] = useState("this_month");
  const query = useMemo(() => ({ ...p }), [p]);
  const preview = useApi<ReportPreviewDTO>("/reports/preview", query);
  const history = useApi<{ items: ReportJobDTO[] }>("/reports", { page_size: 10 });
  const act = useAction();
  const toast = useToast();
  const generate = async (format: "XLSX" | "PDF") => {
    const r = await act.run(() => api<ReportJobDTO>("/reports", { body: { ...p, project_id: p.project_id || null, client_id: p.client_id || null, user_id: p.user_id || null, status: p.status || null, jira_sync_status: p.jira_sync_status || null, format } }));
    if (r) { toast.show(`${format} report ready`); history.reload(); window.open(downloadUrl(`/reports/${r.data.id}/download`), "_blank"); }
  };
  const printHref = `/reports/print${buildQuery(query)}`;

  return (
    <div>
      <PageHeader title="Report Center" subtitle="Professional reports for management, project owners and the client PIC." actions={<Link to="/reports/hr" className="btn btn-primary"><i className="bi bi-calendar-week me-1" />HR Timesheet</Link>} />
      <Card className="mb-3"><Steps steps={["Import work", "Review AI", "Submit", "Approval", "Jira sync", "Report"]} active={5} /></Card>
      <div className="row g-3">
        <div className="col-lg-8">
          <Card title="Report builder" className="mb-3">
            <div className="row g-2 mb-3">{TYPES.map((t) => <div key={t.value} className="col-md-6 col-xl-4"><label className={`d-block border rounded p-2 h-100 ${p.type === t.value ? "border-primary bg-light" : ""}`} style={{ cursor: "pointer" }}><input type="radio" className="form-check-input me-2" name="type" checked={p.type === t.value} onChange={() => setP({ ...p, type: t.value })} /><strong>{t.label}</strong><div className="small text-secondary">{t.desc}</div></label></div>)}</div>
            <div className="mb-2"><div className="btn-group btn-group-sm flex-wrap" role="group" aria-label="Period shortcuts">{SHORTCUTS.map(([k, l]) => <button key={k} className={`btn btn-outline-secondary${shortcut === k ? " active" : ""}`} onClick={() => { const r = dateShortcut(k!); setShortcut(k!); setP({ ...p, date_from: r.from, date_to: r.to }); }}>{l}</button>)}<button className={`btn btn-outline-secondary${shortcut === "custom" ? " active" : ""}`} onClick={() => setShortcut("custom")}>Custom</button></div></div>
            <div className="row g-2">
              <div className="col-6 col-md-3"><label className="form-label small mb-0" htmlFor="from">From</label><input id="from" type="date" className="form-control form-control-sm" value={p.date_from} onChange={(e) => { setShortcut("custom"); setP({ ...p, date_from: e.target.value }); }} /></div>
              <div className="col-6 col-md-3"><label className="form-label small mb-0" htmlFor="to">To</label><input id="to" type="date" className="form-control form-control-sm" value={p.date_to} onChange={(e) => { setShortcut("custom"); setP({ ...p, date_to: e.target.value }); }} /></div>
              <div className="col-md-3"><label className="form-label small mb-0" htmlFor="client">Client</label><select id="client" className="form-select form-select-sm" value={p.client_id} onChange={(e) => setP({ ...p, client_id: e.target.value, project_id: "" })}><option value="">All clients</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label small mb-0" htmlFor="project">Project</label><select id="project" className="form-select form-select-sm" value={p.project_id} onChange={(e) => setP({ ...p, project_id: e.target.value })}><option value="">All projects</option>{projects.data?.filter((x) => !p.client_id || x.client_id === p.client_id).map((x) => <option key={x.id} value={x.id}>{x.code} — {x.name}</option>)}</select></div>
              {isApprover && <div className="col-md-3"><label className="form-label small mb-0" htmlFor="user">User</label><select id="user" className="form-select form-select-sm" value={p.user_id} onChange={(e) => setP({ ...p, user_id: e.target.value })}><option value="">Me</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
              <div className="col-md-3"><label className="form-label small mb-0" htmlFor="st">Approval status</label><select id="st" className="form-select form-select-sm" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value })}><option value="">Any</option><option value="APPROVED">Approved</option><option value="SUBMITTED">Submitted</option><option value="DRAFT">Draft</option><option value="REJECTED">Rejected</option></select></div>
              <div className="col-md-3"><label className="form-label small mb-0" htmlFor="js">Jira status</label><select id="js" className="form-select form-select-sm" value={p.jira_sync_status} onChange={(e) => setP({ ...p, jira_sync_status: e.target.value })}><option value="">Any</option><option value="SYNCED">Synced</option><option value="LINKED">Linked</option><option value="MATCH_SUGGESTED">Match suggested</option><option value="NOT_LINKED">No Jira</option><option value="SYNC_FAILED">Sync failed</option></select></div>
            </div>
          </Card>
          <Card title="Recent reports">
            {!history.data ? <Spinner /> : history.data.items.length === 0 ? <div className="text-secondary small">No reports generated yet.</div> : (
              <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Report</th><th>Period</th><th>Format</th><th>Status</th><th>Generated</th><th /></tr></thead><tbody>{history.data.items.map((r) => <tr key={r.id}><td>{humanize(r.type)}</td><td className="text-nowrap">{fmtDate(r.params.date_from)} – {fmtDate(r.params.date_to)}</td><td>{r.format}</td><td><StatusBadge value={r.status} /></td><td className="text-nowrap">{fmtDateTime(r.created_at)}</td><td className="text-end">{r.download_available && <a className="btn btn-sm btn-outline-primary" href={downloadUrl(`/reports/${r.id}/download`)}>Download</a>}</td></tr>)}</tbody></table></div>
            )}
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Report preview">
            <ErrorAlert error={preview.error} />
            {!preview.data ? <Spinner /> : (
              <>
                <dl className="row mb-3">
                  <dt className="col-6">Period</dt><dd className="col-6">{fmtDate(preview.data.period.from)} – {fmtDate(preview.data.period.to)}</dd>
                  <dt className="col-6">Entries</dt><dd className="col-6">{preview.data.entries}</dd>
                  <dt className="col-6">Hours</dt><dd className="col-6">{formatMinutes(preview.data.total_minutes)}</dd>
                  <dt className="col-6">Projects</dt><dd className="col-6">{preview.data.projects}</dd>
                  <dt className="col-6">Approved</dt><dd className="col-6">{preview.data.approved}</dd>
                  <dt className="col-6">Delayed</dt><dd className="col-6">{preview.data.delayed}</dd>
                  <dt className="col-6">Jira pending</dt><dd className="col-6">{preview.data.jira_pending}</dd>
                </dl>
                <ErrorAlert error={act.error} />
                <div className="d-grid gap-2">
                  <button className="btn btn-primary" onClick={() => generate("PDF")} disabled={act.busy}><i className="bi bi-file-earmark-pdf me-1" />Generate PDF</button>
                  <button className="btn btn-outline-primary" onClick={() => generate("XLSX")} disabled={act.busy}><i className="bi bi-file-earmark-excel me-1" />Export Excel</button>
                  <Link to={printHref} target="_blank" className="btn btn-outline-secondary"><i className="bi bi-printer me-1" />Print view</Link>
                </div>
                <p className="small text-secondary mt-3 mb-0">Excel includes Summary, Timesheets, Jira Reconciliation, Delayed Tasks and Audit sheets with frozen headers and filters.</p>
              </>
            )}
          </Card>
        </div>
      </div>
      {toast.node}
    </div>
  );
}
