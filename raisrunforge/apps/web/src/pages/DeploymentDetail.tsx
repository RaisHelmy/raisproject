import { Link, useParams } from "react-router-dom";
import type { Deployment } from "@runforge/shared";
import { isTerminalDeploymentStatus } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

const STEP_ICON: Record<string, string> = {
  success: "bi-check-circle-fill", running: "bi-arrow-repeat", failed: "bi-x-circle-fill",
  pending: "bi-circle", skipped: "bi-dash-circle",
};

export function DeploymentDetail() {
  const { id = "" } = useParams();
  const { data: deployment, refetch } = useApi(() => api.get<Deployment>(`/deployments/${id}`), [id], { pollMs: 1200 });
  const toast = useToast();

  if (!deployment) return <div className="rf-skeleton" style={{ height: 200 }} />;

  const terminal = isTerminalDeploymentStatus(deployment.status);
  const progress = deployment.steps.filter((s) => s.state === "success").length;
  const total = deployment.steps.length || 1;

  async function cancel() {
    await api.post(`/deployments/${id}/cancel`);
    toast.push({ title: "Deployment cancelled", demo: true });
    refetch();
  }

  return (
    <div>
      <div className="rf-breadcrumb">
        <Link to="/deployments">Deployments</Link> / {deployment.applicationName} {deployment.version}
      </div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">{deployment.applicationName} — {deployment.version}</h1>
          <div className="rf-page-sub d-flex align-items-center gap-2 mt-1">
            <StatusBadge status={deployment.status} />
            <span className="text-capitalize">{deployment.environment}</span>
            <span>·</span>
            <span className="rf-mono">{deployment.commitSha}</span>
            {deployment.simulated && <span className="rf-demo-pill">Demo Provider — simulated</span>}
          </div>
        </div>
        {!terminal && <button className="btn-rf btn-rf-danger" onClick={cancel}>Cancel</button>}
      </div>

      {!terminal && (
        <div className="rf-card mb-3">
          <div className="d-flex justify-content-between rf-faint mb-1">
            <span>Deploying…</span>
            <span>{progress}/{total} steps</span>
          </div>
          <div className="rf-progress-track"><div className="rf-progress-fill" style={{ width: `${(progress / total) * 100}%` }} /></div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-7">
          <div className="rf-card">
            <div className="fw-semibold mb-2">Deployment Timeline</div>
            <div className="rf-step-list">
              {deployment.steps.map((s) => (
                <div key={s.key} className={`rf-step rf-step-${s.state}`}>
                  <i className={`bi ${STEP_ICON[s.state]} ${s.state === "running" ? "spin" : ""}`} />
                  <span className="rf-step-label">{s.label}</span>
                  {s.message && <span className="rf-faint ms-auto">{s.message}</span>}
                </div>
              ))}
            </div>
            {deployment.status === "completed" && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--rf-border-soft)" }}>
                <span className="text-success"><i className="bi bi-check-circle-fill me-1" />Deployment successful</span>
              </div>
            )}
            {deployment.status === "failed" && (
              <div className="mt-2 pt-2 text-danger" style={{ borderTop: "1px solid var(--rf-border-soft)" }}>
                <i className="bi bi-x-circle-fill me-1" />{deployment.errorMessage}
              </div>
            )}
          </div>
        </div>
        <div className="col-md-5">
          <div className="rf-card">
            <div className="fw-semibold mb-2">Details</div>
            <Row label="Branch" value={deployment.branch} />
            <Row label="Commit" value={`${deployment.commitSha} — ${deployment.commitMessage}`} />
            <Row label="Trigger" value={deployment.trigger} />
            <Row label="Triggered by" value={deployment.triggeredBy} />
            <Row label="Server" value={deployment.serverName ?? "—"} />
            <Row label="Queued" value={new Date(deployment.queuedAt).toLocaleString()} />
            {deployment.durationMs && <Row label="Duration" value={`${(deployment.durationMs / 1000).toFixed(1)}s`} />}
          </div>
          <Link to={`/applications/${deployment.applicationId}`} className="d-block mt-2 rf-faint">
            View application →
          </Link>
        </div>
      </div>
      <style>{".spin { display: inline-block; animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="d-flex justify-content-between py-1" style={{ borderBottom: "1px solid var(--rf-border-soft)" }}>
      <span className="rf-faint">{label}</span><span className="text-truncate ms-2" style={{ maxWidth: "65%" }}>{value}</span>
    </div>
  );
}
