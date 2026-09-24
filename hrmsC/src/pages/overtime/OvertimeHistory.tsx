import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { downloadCsv } from "../../lib/csv";
import type { OvertimeRequest } from "../../types";

export function OvertimeHistory() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<{ requests: OvertimeRequest[] }>("/overtime/me")
      .then((res) => setRequests(res.requests))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this overtime request?")) return;
    await api.post(`/overtime/${id}/cancel`);
    load();
  }

  function exportCsv() {
    downloadCsv(
      "my-overtime.csv",
      requests.map((r) => ({
        date: r.work_date,
        hours: r.hours,
        reason: r.reason ?? "",
        status: r.status,
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">My Overtime Requests</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={requests.length === 0}>
          <i className="bi bi-download me-1" /> Export CSV
        </button>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.work_date}</td>
                  <td>{r.hours}</td>
                  <td>{r.reason ?? "—"}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="d-flex gap-2">
                    {r.workflow_instance_id && (
                      <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${r.workflow_instance_id}`}>
                        Routing
                      </Link>
                    )}
                    {r.status === "pending" && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(r.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No overtime requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
