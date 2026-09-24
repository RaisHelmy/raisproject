import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { downloadCsv } from "../../lib/csv";
import type { LeaveEncashment } from "../../types";

export function LeaveEncashmentHistory() {
  const [encashments, setEncashments] = useState<LeaveEncashment[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<{ encashments: LeaveEncashment[] }>("/leave/encashment/me")
      .then((res) => setEncashments(res.encashments))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this encashment request?")) return;
    await api.post(`/leave/encashment/${id}/cancel`);
    load();
  }

  function exportCsv() {
    downloadCsv(
      "my-leave-encashment.csv",
      encashments.map((e) => ({
        type: e.leave_type_name ?? "",
        days: e.days,
        daily_rate: e.daily_rate,
        amount: e.amount,
        status: e.status,
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">My Leave Encashment Requests</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={encashments.length === 0}>
          <i className="bi bi-download me-1" /> Export CSV
        </button>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>Days</th>
                <th>Rate</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {encashments.map((e) => (
                <tr key={e.id}>
                  <td>{e.leave_type_name}</td>
                  <td>{e.days}</td>
                  <td>{e.daily_rate.toFixed(2)}</td>
                  <td>{e.amount.toFixed(2)}</td>
                  <td>{e.reason ?? "—"}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="d-flex gap-2">
                    {e.workflow_instance_id && (
                      <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${e.workflow_instance_id}`}>
                        Routing
                      </Link>
                    )}
                    {e.status === "pending" && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(e.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && encashments.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    No encashment requests yet.
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
