import { Link } from "react-router-dom";
import type { JiraConnectionDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, EmptyState, ErrorAlert, PageHeader, Spinner, StatCard, StatusBadge, Steps, useToast } from "@/components/ui";
import { fmtDateTime } from "@/services/format";

interface Summary { approved: number; linked: number; needs_review: number; ready_to_create: number; pushing: number; sync_errors: number; failed: number; all_synced: boolean }

export default function JiraSyncCenterPage() {
  const s = useApi<Summary>("/jira/summary", undefined, { poll: 15000 });
  const conn = useApi<JiraConnectionDTO>("/jira/connection");
  const act = useAction();
  const toast = useToast();
  const syncNow = async () => { const r = await act.run(() => api<{ issues: number; reconciled: number; demo: boolean }>("/jira/sync", { body: {} })); if (r) { toast.show(`Synchronised ${r.data.issues} Jira issues · ${r.data.reconciled} timesheets reconciled${r.data.demo ? " (demo)" : ""}`); s.reload(); conn.reload(); } };
  if (s.error) return <ErrorAlert error={s.error} onRetry={s.reload} />;
  if (!s.data) return <Spinner />;
  const d = s.data;
  const exceptions = d.needs_review + d.ready_to_create + d.failed;
  return (
    <div>
      <PageHeader title="Jira Sync Center" subtitle={conn.data ? <span className="d-inline-flex align-items-center gap-2">Connection <StatusBadge value={conn.data.status} /> {conn.data.site_url && <span className="text-secondary">{conn.data.site_url}</span>} · last sync {fmtDateTime(conn.data.last_sync_at)}</span> : "Keeping approved work and Jira in step."}
        actions={<><Link to="/settings/jira" className="btn btn-outline-secondary"><i className="bi bi-plug me-1" />Connection</Link><button className="btn btn-primary" onClick={syncNow} disabled={act.busy}>{act.busy ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-arrow-repeat me-1" />}Sync now</button></>} />
      <Card className="mb-3"><Steps steps={["Import work", "Review AI", "Submit", "Approval", "Jira sync", "Report"]} active={4} /></Card>
      <ErrorAlert error={act.error} />
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg"><StatCard label="Approved work" value={d.approved} icon="check2-circle" /></div>
        <div className="col-6 col-lg"><StatCard label="Already linked" value={d.linked} tone="success" to="/jira/synced" icon="cloud-check" /></div>
        <div className="col-6 col-lg"><StatCard label="Needs review" value={d.needs_review} tone={d.needs_review ? "info" : "default"} to="/jira/reconciliation?view=suggested" icon="diagram-3" /></div>
        <div className="col-6 col-lg"><StatCard label="Ready to create" value={d.ready_to_create} tone={d.ready_to_create ? "warning" : "default"} to="/jira/reconciliation?view=ready_to_create" icon="plus-circle" /></div>
        <div className="col-6 col-lg"><StatCard label="Sync errors" value={d.failed} tone={d.failed ? "danger" : "default"} to="/jira/errors" icon="exclamation-octagon" /></div>
      </div>
      {exceptions === 0 ? (
        <Card><EmptyState icon="cloud-check" title="Everything is synchronised." body={<>{d.linked} approved record{d.linked === 1 ? " is" : "s are"} linked to Jira. No approved work is waiting to be pushed.{d.pushing > 0 && <> {d.pushing} job{d.pushing === 1 ? " is" : "s are"} currently syncing.</>}</>} action={<Link to="/jira/synced" className="btn btn-outline-primary">View synced work</Link>} /></Card>
      ) : (
        <div className="row g-3">
          <div className="col-lg-8">
            <Card title={<><i className="bi bi-flag me-2 text-warning" />Exceptions requiring action</>}>
              <div className="attention-list">
                <div className="attention-item attention-success"><div className="d-flex align-items-center gap-3"><i className="bi bi-check-circle-fill text-success" /><span><strong>{d.linked}</strong> records are synchronised.</span></div><Link to="/jira/synced" className="btn btn-sm btn-outline-secondary">View</Link></div>
                {d.needs_review > 0 && <div className="attention-item attention-info"><div className="d-flex align-items-center gap-3"><span className="attention-dot" /><span><strong>{d.needs_review}</strong> approved timesheet{d.needs_review === 1 ? " has" : "s have"} a suggested Jira match to confirm.</span></div><Link to="/jira/reconciliation?view=suggested" className="btn btn-sm btn-primary">Review</Link></div>}
                {d.ready_to_create > 0 && <div className="attention-item attention-warning"><div className="d-flex align-items-center gap-3"><span className="attention-dot" /><span><strong>{d.ready_to_create}</strong> approved task{d.ready_to_create === 1 ? " is" : "s are"} not in Jira.</span></div><Link to="/jira/reconciliation?view=ready_to_create" className="btn btn-sm btn-primary">Create tasks</Link></div>}
                {d.failed > 0 && <div className="attention-item attention-danger"><div className="d-flex align-items-center gap-3"><span className="attention-dot" /><span><strong>{d.failed}</strong> synchronisation{d.failed === 1 ? "" : "s"} failed.</span></div><Link to="/jira/errors" className="btn btn-sm btn-danger">Resolve</Link></div>}
              </div>
            </Card>
          </div>
          <div className="col-lg-4">
            <Card title="How reconciliation works">
              <ol className="small ps-3 mb-0">
                <li>When a timesheet is approved, it's compared with Jira automatically.</li>
                <li>An explicit key in the conversation links it immediately.</li>
                <li>Similar titles become <em>suggested matches</em> for you to confirm.</li>
                <li>Anything else is <em>ready to create</em> — after you confirm.</li>
                <li>Duplicates are flagged before creation. Creation is idempotent.</li>
              </ol>
            </Card>
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}
