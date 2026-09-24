import { Link, useSearchParams } from "react-router-dom";
import type { TimesheetDTO } from "@rais/shared-types";
import { useApi } from "@/hooks/useApi";
import { Card, DataTable, Duration, EmptyState, ErrorAlert, PageHeader, Pagination, Spinner, StatusBadge, type Column } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/services/format";

export default function ApprovalHistoryPage() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page") ?? "1");
  const status = sp.get("status") ?? "APPROVED,REJECTED";
  const list = useApi<{ items: TimesheetDTO[]; total: number; page: number; page_size: number }>("/timesheets", { scope: "all", status, page, page_size: 25, sort: "updated_at", dir: "desc" });
  const columns: Column<TimesheetDTO>[] = [
    { key: "when", header: "Decided", render: (r) => fmtDateTime(r.approved_at ?? r.updated_at), priority: 2 },
    { key: "task", header: "Task", render: (r) => <><Link to={`/timesheets/${r.id}`} className="fw-medium text-decoration-none text-reset">{r.title}</Link><div className="small text-secondary">{r.reference} · {r.user_name} · {fmtDate(r.work_date)}</div></>, priority: 1 },
    { key: "project", header: "Project", render: (r) => r.project_code, priority: 3 },
    { key: "dur", header: "Duration", render: (r) => <Duration minutes={r.duration_minutes} />, priority: 2 },
    { key: "status", header: "Decision", render: (r) => <><StatusBadge value={r.status} />{r.status === "REJECTED" && r.rejection_reason && <div className="small text-secondary">{r.rejection_reason}</div>}</>, priority: 1 },
    { key: "by", header: "By", render: (r) => r.approved_by_name ?? "—", priority: 3 },
    { key: "jira", header: "Jira", render: (r) => r.jira_issue_key ? <Link to={`/jira/tasks/${r.jira_issue_key}`}>{r.jira_issue_key}</Link> : r.status === "APPROVED" ? <StatusBadge value={r.jira_sync_status} /> : "—", priority: 3 },
  ];
  return (
    <div>
      <PageHeader title="Approval History" subtitle="Every approval decision, newest first." actions={<select className="form-select form-select-sm" style={{ width: 200 }} value={status} onChange={(e) => { const n = new URLSearchParams(sp); n.set("status", e.target.value); n.delete("page"); setSp(n); }} aria-label="Filter decisions"><option value="APPROVED,REJECTED">Approved &amp; rejected</option><option value="APPROVED">Approved only</option><option value="REJECTED">Rejected only</option></select>} />
      <ErrorAlert error={list.error} onRetry={list.reload} />
      {!list.data ? <Spinner /> : <Card className="p-0"><DataTable columns={columns} rows={list.data.items} keyOf={(r) => r.id} rowLink={(r) => `/timesheets/${r.id}`} empty={<EmptyState icon="archive" title="No decisions yet." />} /><div className="px-3 pb-3"><Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={(p) => { const n = new URLSearchParams(sp); n.set("page", String(p)); setSp(n); }} /></div></Card>}
    </div>
  );
}
