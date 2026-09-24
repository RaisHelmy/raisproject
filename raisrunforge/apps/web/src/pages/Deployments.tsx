import { useNavigate } from "react-router-dom";
import type { Deployment } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";

export function Deployments() {
  const { data: deployments, loading } = useApi(() => api.get<Deployment[]>("/deployments"), [], { pollMs: 3000 });
  const navigate = useNavigate();

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Deployments</h1>
          <div className="rf-page-sub">Deployment history across every application and environment.</div>
        </div>
      </div>

      {loading && <div className="rf-skeleton" style={{ height: 200 }} />}
      {!loading && !deployments?.length && <div className="rf-empty"><i className="bi bi-rocket" />No deployments yet.</div>}

      <div className="rf-table-card">
        <table className="rf-table">
          <thead><tr><th>Application</th><th>Version</th><th>Commit</th><th>Environment</th><th>Server</th><th>Status</th><th>Duration</th><th>Time</th></tr></thead>
          <tbody>
            {deployments?.map((d) => (
              <tr key={d.id} onClick={() => navigate(`/deployments/${d.id}`)}>
                <td className="fw-medium">{d.applicationName}</td>
                <td>{d.version}</td>
                <td className="rf-faint rf-mono">{d.commitSha}</td>
                <td><StatusBadge status={d.environment === "production" ? "active" : "unknown"} label={d.environment} /></td>
                <td className="rf-faint">{d.serverName ?? "—"}</td>
                <td><StatusBadge status={d.status} /></td>
                <td className="rf-faint">{d.durationMs ? `${Math.round(d.durationMs / 1000)}s` : "—"}</td>
                <td className="rf-faint">{new Date(d.queuedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
