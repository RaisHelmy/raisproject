import { useEffect, useState } from "react";
import { api } from "../api";

interface Incident {
  id: string;
  jobId: string;
  triggeredByUserId: string;
  status: string;
  createdAt: string;
}

export default function AdminSos() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  async function load() {
    setIncidents(await api.get<Incident[]>("/sos/open"));
  }

  useEffect(() => {
    load();
  }, []);

  async function acknowledge(id: string) {
    await api.post(`/sos/${id}/acknowledge`);
    await load();
  }

  async function resolve(id: string) {
    const note = prompt("Resolution note?");
    if (!note) return;
    await api.post(`/sos/${id}/resolve`, { note });
    await load();
  }

  return (
    <div>
      <h4>Open SOS incidents</h4>
      {incidents.length === 0 && <p className="text-muted">None open.</p>}
      <ul className="list-group">
        {incidents.map((i) => (
          <li key={i.id} className="list-group-item d-flex justify-content-between align-items-center">
            <span>
              Job {i.jobId.slice(0, 8)} · triggered by {i.triggeredByUserId.slice(0, 8)} ·{" "}
              <span className="badge text-bg-danger">{i.status}</span> · {new Date(i.createdAt).toLocaleString()}
            </span>
            <span className="d-flex gap-2">
              {i.status === "triggered" && (
                <button className="btn btn-sm btn-outline-warning" onClick={() => acknowledge(i.id)}>
                  Acknowledge
                </button>
              )}
              <button className="btn btn-sm btn-outline-success" onClick={() => resolve(i.id)}>
                Resolve
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
