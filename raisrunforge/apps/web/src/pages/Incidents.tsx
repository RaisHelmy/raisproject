import type { Incident } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export function Incidents() {
  const { data: incidents, loading, refetch } = useApi(() => api.get<Incident[]>("/incidents"), [], { pollMs: 6000 });
  const toast = useToast();

  async function updateStatus(id: string, status: string) {
    await api.post(`/incidents/${id}/status`, { status });
    toast.push({ title: "Incident updated", message: status });
    refetch();
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Incidents</h1>
          <div className="rf-page-sub">Automatically detected issues across applications, servers and domains.</div>
        </div>
      </div>
      {loading && <div className="rf-skeleton" style={{ height: 200 }} />}
      <div className="row g-3">
        {incidents?.map((i) => (
          <div className="col-md-6" key={i.id}>
            <div className="rf-card h-100">
              <div className="d-flex justify-content-between mb-1">
                <div className="fw-semibold">{i.title}</div>
                <StatusBadge status={i.status} />
              </div>
              <div className="rf-faint mb-2">
                {i.severity.toUpperCase()} · started {new Date(i.startedAt).toLocaleString()}
                {i.impactPercent !== undefined && <> · impact {i.impactPercent}%</>}
              </div>
              {i.likelyCause && (
                <div className="mb-2">
                  <span className="rf-faint">Likely cause: </span>{i.likelyCause}
                </div>
              )}
              {i.relatedChanges.length > 0 && (
                <div className="rf-faint mb-2">
                  Related changes: {i.relatedChanges.join(", ")}
                </div>
              )}
              {i.status !== "resolved" && (
                <div className="d-flex gap-2 mt-2">
                  {i.status === "open" && <button className="btn-rf" onClick={() => updateStatus(i.id, "investigating")}>Investigate</button>}
                  {i.status !== "mitigated" && <button className="btn-rf" onClick={() => updateStatus(i.id, "mitigated")}>Mark mitigated</button>}
                  <button className="btn-rf btn-rf-primary" onClick={() => updateStatus(i.id, "resolved")}>Resolve</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {incidents?.length === 0 && <div className="col-12 rf-empty"><i className="bi bi-shield-check" />No incidents. Everything is healthy.</div>}
      </div>
    </div>
  );
}
