import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { JiraIssueDTO, ProjectDTO } from "@rais/shared-types";
import { useApi, useDebounced } from "@/hooks/useApi";
import { Card, DataTable, EmptyState, ErrorAlert, PageHeader, Pagination, Spinner, StatusBadge, type Column } from "@/components/ui";
import { fmtDate } from "@/services/format";

const FILTERS = [["all", "All"], ["mine", "My tasks"], ["open", "Open"], ["completed", "Completed"], ["delayed", "Delayed"], ["due_soon", "Due soon"], ["missing_timesheet", "Missing timesheet"]];

export default function JiraTasksPage() {
  const [sp, setSp] = useSearchParams();
  const filter = sp.get("filter") ?? "mine";
  const page = Number(sp.get("page") ?? "1");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const projects = useApi<ProjectDTO[]>("/projects");
  const list = useApi<{ items: JiraIssueDTO[]; total: number; page: number; page_size: number }>("/jira/issues", { filter, page, q: dq, project_key: sp.get("project_key") ?? "" });
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== "page") n.delete("page"); setSp(n); };
  const columns: Column<JiraIssueDTO>[] = [
    { key: "key", header: "Key", render: (r) => <Link to={`/jira/tasks/${r.issue_key}`} className="fw-semibold text-decoration-none">{r.issue_key}</Link>, priority: 1, width: "100px" },
    { key: "summary", header: "Summary", render: (r) => <Link to={`/jira/tasks/${r.issue_key}`} className="text-decoration-none text-reset">{r.summary}</Link>, priority: 1 },
    { key: "project", header: "Project", render: (r) => r.project_key, priority: 3 },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} />, priority: 1 },
    { key: "assignee", header: "Assignee", render: (r) => r.assignee_name ?? <span className="text-secondary">Unassigned</span>, priority: 3 },
    { key: "priority", header: "Priority", render: (r) => r.priority ?? "—", priority: 3 },
    { key: "due", header: "Due", render: (r) => fmtDate(r.due_date), priority: 2 },
    { key: "work", header: "Work date", render: (r) => fmtDate(r.work_date), priority: 3 },
    { key: "ts", header: "Timesheet", render: (r) => r.timesheet_id ? <Link to={`/timesheets/${r.timesheet_id}`}>{r.timesheet_reference}</Link> : <span className="text-secondary small">None</span>, priority: 2 },
    { key: "delay", header: "Delay", render: (r) => <><StatusBadge value={r.delay.state} /> {r.delay.days !== null && r.delay.state === "DELAYED" && <span className="small text-danger ms-1">{r.delay.message}</span>}</>, priority: 1 },
  ];
  return (
    <div>
      <PageHeader title="My Jira Tasks" subtitle="Jira issues for your projects, with timesheet coverage and delay status." breadcrumb={[{ label: "Jira Sync Center", to: "/jira" }, { label: "Tasks" }]} />
      <Card className="mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group btn-group-sm flex-wrap" role="group" aria-label="Filters">{FILTERS.map(([k, l]) => <button key={k} className={`btn btn-outline-secondary${filter === k ? " active" : ""}`} onClick={() => set("filter", k!)}>{l}</button>)}</div>
          <select className="form-select form-select-sm ms-auto" style={{ width: 160 }} value={sp.get("project_key") ?? ""} onChange={(e) => set("project_key", e.target.value)} aria-label="Project"><option value="">All projects</option>{projects.data?.filter((p) => p.jira_project_key).map((p) => <option key={p.id} value={p.jira_project_key!}>{p.jira_project_key}</option>)}</select>
          <input className="form-control form-control-sm" style={{ width: 220 }} placeholder="Search key or summary" value={q} onChange={(e) => { setQ(e.target.value); set("q", e.target.value); }} aria-label="Search" />
        </div>
      </Card>
      <ErrorAlert error={list.error} onRetry={list.reload} />
      {!list.data ? <Spinner /> : <Card className="p-0"><DataTable columns={columns} rows={list.data.items} keyOf={(r) => r.issue_key} rowLink={(r) => `/jira/tasks/${r.issue_key}`} empty={<EmptyState icon="kanban" title={filter === "delayed" ? "No delayed tasks." : filter === "missing_timesheet" ? "Every active task has a timesheet." : "No Jira tasks found."} body={filter === "mine" ? "Tasks are matched to you by your Jira account. Set it under Profile if this list looks empty." : undefined} />} /><div className="px-3 pb-3"><Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={(p) => set("page", String(p))} /></div></Card>}
      <p className="small text-secondary mt-2">A task is only reported as delayed when Jira has a reliable due date.</p>
    </div>
  );
}
