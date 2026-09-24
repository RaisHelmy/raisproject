import type { Event } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";

export function Events() {
  const { data: events, loading } = useApi(() => api.get<Event[]>("/events?limit=150"), [], { pollMs: 5000 });

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Events</h1>
          <div className="rf-page-sub">Every important action across your infrastructure, in order.</div>
        </div>
      </div>
      {loading && <div className="rf-skeleton" style={{ height: 200 }} />}
      <div className="rf-card">
        {events?.map((e) => (
          <div key={e.id} className="d-flex align-items-start gap-2 py-2" style={{ borderBottom: "1px solid var(--rf-border-soft)" }}>
            <i className={`bi ${e.status === "failed" ? "bi-x-circle text-danger" : e.status === "pending" ? "bi-hourglass-split text-info" : "bi-check-circle text-success"} mt-1`} />
            <div className="flex-grow-1">
              <div>{e.message}</div>
              <div className="rf-faint">
                {e.actorName} ({e.actorType}) · {e.resourceType} · {new Date(e.createdAt).toLocaleString()}
                {e.simulated && <span className="rf-demo-pill ms-2">simulated</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
