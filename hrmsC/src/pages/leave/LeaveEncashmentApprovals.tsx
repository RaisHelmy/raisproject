import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { downloadCsv } from "../../lib/csv";
import type { LeaveEncashment } from "../../types";

export function LeaveEncashmentApprovals() {
  const [encashments, setEncashments] = useState<LeaveEncashment[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ encashments: LeaveEncashment[] }>("/leave/encashment/approvals").then((res) => setEncashments(res.encashments));
  }

  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/leave/encashment/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  function exportCsv() {
    downloadCsv(
      "leave-encashment-approvals.csv",
      encashments.map((e) => ({
        employee: e.employee_name ?? "",
        employee_no: e.employee_no ?? "",
        type: e.leave_type_name ?? "",
        days: e.days,
        amount: e.amount,
        step: e.step_name ?? "",
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Leave Encashment Approvals</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={encashments.length === 0}>
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
                <th>Amount</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {encashments.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.employee_name} <span className="text-secondary small">({e.employee_no})</span>
                  </td>
                  <td>{e.leave_type_name}</td>
                  <td>{e.days}</td>
                  <td>{e.amount.toFixed(2)}</td>
                  <td className="text-secondary small">{e.step_name ?? "—"}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-success" onClick={() => decide(e.id, "approve")}>
                        Approve
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => decide(e.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {encashments.length === 0 && (
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
