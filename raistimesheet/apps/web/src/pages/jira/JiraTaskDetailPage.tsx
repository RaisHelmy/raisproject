import { Link, useParams } from "react-router-dom";
import type { DelayInfo, JiraIssueDTO, TimesheetDTO } from "@rais/shared-types";
import { useApi } from "@/hooks/useApi";
import { Card, Duration, ErrorAlert, KeyValue, PageHeader, Spinner, StatusBadge } from "@/components/ui";
import { fmtDate } from "@/services/format";

export default function JiraTaskDetailPage() {
  const { key } = useParams();
  const d = useApi<{ issue: JiraIssueDTO; timesheets: TimesheetDTO[]; delay: DelayInfo }>(`/jira/issues/${key}`);
  if (d.error) return <ErrorAlert error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Spinner />;
  const i = d.data.issue;
  return (
    <div>
      <PageHeader title={`${i.issue_key} — ${i.summary}`} breadcrumb={[{ label: "Jira Sync Center", to: "/jira" }, { label: "Tasks", to: "/jira/tasks" }, { label: i.issue_key }]} subtitle={<span className="d-inline-flex gap-2 align-items-center"><StatusBadge value={i.status} /> <StatusBadge value={i.delay.state} /> {i.issue_type} · {i.project_key}</span>}
        actions={<>{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="btn btn-outline-secondary"><i className="bi bi-box-arrow-up-right me-1" />Open in Jira</a>}<button className="btn btn-outline-secondary" onClick={d.reload}><i className="bi bi-arrow-repeat me-1" />Refresh</button></>} />
      <div className="row g-3">
        <div className="col-lg-6"><Card title="Task"><KeyValue items={[{ label: "Key", value: i.issue_key }, { label: "Summary", value: i.summary }, { label: "Project", value: i.project_key }, { label: "Type", value: i.issue_type }, { label: "Status", value: <StatusBadge value={i.status} /> }, { label: "Assignee", value: i.assignee_name ?? "Unassigned" }, { label: "Priority", value: i.priority ?? "—" }]} /></Card></div>
        <div className="col-lg-6">
          <Card title="Delay" className="mb-3">
            <KeyValue items={[{ label: "Due", value: fmtDate(i.due_date, "long") }, { label: "Completed", value: i.resolved_at ? fmtDate(i.resolved_at, "long") : "Not completed" }, { label: "Assessment", value: <><StatusBadge value={i.delay.state} /> <span className="ms-2">{i.delay.message}</span></> }]} />
            {i.delay.state === "NO_DUE_DATE" && <p className="small text-secondary mt-2 mb-0">Without a due date in Jira, delay cannot be determined.</p>}
          </Card>
          <Card title="Timesheets">
            {d.data.timesheets.length === 0 ? <div className="text-secondary small">No timesheet is linked to this task.</div> : (
              <ul className="list-unstyled mb-0">{d.data.timesheets.map((t) => <li key={t.id} className="mb-2"><Link to={`/timesheets/${t.id}`} className="fw-medium text-decoration-none">{t.reference}</Link> · {t.title}<div className="small text-secondary">{fmtDate(t.work_date)} · <Duration minutes={t.duration_minutes} /> · {t.user_name} · <StatusBadge value={t.status} /></div></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
