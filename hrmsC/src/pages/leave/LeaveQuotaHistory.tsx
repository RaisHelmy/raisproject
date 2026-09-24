import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { downloadCsv } from "../../lib/csv";
import type { LeaveQuotaGrant } from "../../types";

export function LeaveQuotaHistory() {
  const [grants, setGrants] = useState<LeaveQuotaGrant[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<{ grants: LeaveQuotaGrant[] }>("/leave/quota/me")
      .then((res) => setGrants(res.grants))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this quota request?")) return;
    await api.post(`/leave/quota/${id}/cancel`);
    load();
  }

  function exportCsv() {
    downloadCsv(
      "my-leave-quota.csv",
      grants.map((g) => ({
        type: g.leave_type_name ?? "",
        days: g.granted_days,
        reason: g.reason ?? "",
        status: g.status,
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">My Leave Quota Requests</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={grants.length === 0}>
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
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>{g.leave_type_name}</td>
                  <td>{g.granted_days}</td>
                  <td>{g.reason ?? "—"}</td>
                  <td>
                    <StatusBadge status={g.status} />
                  </td>
                  <td className="d-flex gap-2">
                    {g.workflow_instance_id && (
                      <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${g.workflow_instance_id}`}>
                        Routing
                      </Link>
                    )}
                    {g.status === "pending" && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(g.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && grants.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No leave quota requests yet.
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
