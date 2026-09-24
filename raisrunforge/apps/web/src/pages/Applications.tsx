import { useNavigate, useSearchParams } from "react-router-dom";
import type { Application } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";

export function Applications() {
  const { data: apps, loading } = useApi(() => api.get<Application[]>("/applications"), [], { pollMs: 6000 });
  const navigate = useNavigate();
  const [params] = useSearchParams();

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Applications</h1>
          <div className="rf-page-sub">The primary deployment abstraction — deploy, monitor and manage from here.</div>
        </div>
        <button className="btn-rf btn-rf-primary"><i className="bi bi-plus-lg me-1" />New Application</button>
      </div>

      {loading && <div className="rf-skeleton" style={{ height: 200 }} />}

      <div className="row g-3">
        {apps?.map((a) => (
          <div className="col-md-6 col-xl-4" key={a.id}>
            <div className="rf-card h-100" style={{ cursor: "pointer" }} onClick={() => navigate(`/applications/${a.id}`)}>
              <div className="d-flex justify-content-between align-items-start mb-1">
                <div className="fw-semibold">{a.name}</div>
                <StatusBadge status={a.status} />
              </div>
              <div className="rf-faint mb-2">{a.environment} · {a.runtimeLabel}</div>
              {a.url && <div className="rf-mono mb-2" style={{ fontSize: 12 }}><i className="bi bi-link-45deg" />{a.url.replace("https://", "")}</div>}
              <div className="d-flex justify-content-between rf-faint">
                <span>{a.currentVersion ?? "—"}</span>
                <span>{a.resources.instances} instance{a.resources.instances === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {params.get("new") === "1" && (
        <div className="mt-3 rf-faint">
          <i className="bi bi-info-circle me-1" />
          The full application creation wizard (source → runtime → build → resources → env → database → storage → domain → target → review → deploy) is the next milestone — see the README roadmap.
        </div>
      )}
    </div>
  );
}
