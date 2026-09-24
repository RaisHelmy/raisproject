import { useNavigate } from "react-router-dom";
import type { Database } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";

export function Databases() {
  const { data: databases, loading } = useApi(() => api.get<Database[]>("/databases"), [], { pollMs: 5000 });
  const navigate = useNavigate();

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Databases</h1>
          <div className="rf-page-sub">PostgreSQL, MySQL, SQL Server, SQLite and Redis — all managed here.</div>
        </div>
        <button className="btn-rf btn-rf-primary"><i className="bi bi-database-add me-1" />New Database</button>
      </div>
      {loading && <div className="rf-skeleton" style={{ height: 200 }} />}
      <div className="row g-3">
        {databases?.map((d) => (
          <div className="col-md-6 col-xl-4" key={d.id}>
            <div className="rf-card h-100" style={{ cursor: "pointer" }} onClick={() => navigate(`/databases/${d.id}`)}>
              <div className="d-flex justify-content-between mb-1">
                <div className="fw-semibold">{d.name}</div>
                <StatusBadge status={d.status} />
              </div>
              <div className="rf-faint mb-2">{d.engine} {d.version}</div>
              <div className="d-flex justify-content-between rf-faint">
                <span>{(d.sizeBytes / 1024 ** 3).toFixed(1)} GB</span>
                <span>{d.connections} / {d.maxConnections} connections</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
