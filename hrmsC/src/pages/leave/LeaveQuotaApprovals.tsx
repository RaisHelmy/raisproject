import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { downloadCsv } from "../../lib/csv";
import type { LeaveQuotaGrant } from "../../types";

export function LeaveQuotaApprovals() {
  const [grants, setGrants] = useState<LeaveQuotaGrant[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ grants: LeaveQuotaGrant[] }>("/leave/quota/approvals").then((res) => setGrants(res.grants));
  }

  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/leave/quota/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  function exportCsv() {
    downloadCsv(
      "leave-quota-approvals.csv",
      grants.map((g) => ({
        employee: g.employee_name ?? "",
        employee_no: g.employee_no ?? "",
        type: g.leave_type_name ?? "",
        days: g.granted_days,
        reason: g.reason ?? "",
        step: g.step_name ?? "",
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Leave Quota Approvals</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={grants.length === 0}>
          <i className="bi bi-download me-1" /> Export CSV
        </button>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.employee_name} <span className="text-secondary small">({g.employee_no})</span>
                  </td>
                  <td>{g.leave_type_name}</td>
                  <td>{g.granted_days}</td>
                  <td>{g.reason ?? "—"}</td>
                  <td className="text-secondary small">{g.step_name ?? "—"}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-success" onClick={() => decide(g.id, "approve")}>
                        Approve
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => decide(g.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-4">
                    Nothing pending approval.
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
