import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import type { TrainingEnrollment } from "../../types";

export function EnrollmentApprovals() {
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ enrollments: TrainingEnrollment[] }>("/training/enrollments/approvals").then((res) => setEnrollments(res.enrollments));
  }
  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/training/enrollments/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Training Approvals</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Program</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((en) => (
                <tr key={en.id}>
                  <td>
                    {en.employee_name} <span className="text-secondary small">({en.employee_no})</span>
                  </td>
                  <td>{en.program_title}</td>
                  <td className="text-secondary small">{en.step_name ?? "—"}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-success" onClick={() => decide(en.id, "approve")}>
                        Approve
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => decide(en.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
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
