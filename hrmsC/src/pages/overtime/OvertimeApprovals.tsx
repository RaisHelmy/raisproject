import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { downloadCsv } from "../../lib/csv";
import type { OvertimeRequest } from "../../types";

export function OvertimeApprovals() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ requests: OvertimeRequest[] }>("/overtime/approvals").then((res) => setRequests(res.requests));
  }

  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/overtime/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  function exportCsv() {
    downloadCsv(
      "overtime-approvals.csv",
      requests.map((r) => ({
        employee: r.employee_name ?? "",
        employee_no: r.employee_no ?? "",
        date: r.work_date,
        hours: r.hours,
        reason: r.reason ?? "",
        step: r.step_name ?? "",
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Overtime Approvals</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={requests.length === 0}>
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
                <th>Date</th>
                <th>Hours</th>
                <th>Reason</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.employee_name} <span className="text-secondary small">({r.employee_no})</span>
                  </td>
                  <td>{r.work_date}</td>
                  <td>{r.hours}</td>
                  <td>{r.reason ?? "—"}</td>
                  <td className="text-secondary small">{r.step_name ?? "—"}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-success" onClick={() => decide(r.id, "approve")}>
                        Approve
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => decide(r.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
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
