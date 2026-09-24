import type { Repository } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";

export function Git() {
  const { data: repos } = useApi(() => api.get<Repository[]>("/git/repositories"), []);
  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Git</h1>
          <div className="rf-page-sub">Connected GitHub/GitLab accounts and repositories.</div>
        </div>
        <button className="btn-rf btn-rf-primary"><i className="bi bi-git me-1" />Connect Account</button>
      </div>
      <div className="rf-table-card">
        <table className="rf-table">
          <thead><tr><th>Repository</th><th>Default Branch</th><th>Visibility</th></tr></thead>
          <tbody>
            {repos?.map((r) => (
              <tr key={r.id}>
                <td className="fw-medium">{r.fullName}</td>
                <td className="rf-faint rf-mono">{r.defaultBranch}</td>
                <td><StatusBadge status={r.private ? "unknown" : "healthy"} label={r.private ? "Private" : "Public"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
