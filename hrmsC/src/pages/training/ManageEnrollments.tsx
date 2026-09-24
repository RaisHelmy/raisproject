import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import type { ApplicationStatus, TrainingEnrollment } from "../../types";

export function ManageEnrollments() {
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);

  function load() {
    api.get<{ enrollments: TrainingEnrollment[] }>("/training/enrollments").then((res) => setEnrollments(res.enrollments));
  }
  useEffect(load, []);

  async function markComplete(id: string) {
    await api.patch(`/training/enrollments/${id}/complete`);
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Manage Enrollments</h1>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Program</th>
                <th>Status</th>
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
                  <td>
                    {en.status === "completed" ? (
                      <span className="badge text-bg-success">completed</span>
                    ) : (
                      <StatusBadge status={en.status as ApplicationStatus} />
                    )}
                  </td>
                  <td className="text-end">
                    {en.status === "approved" && (
                      <button className="btn btn-sm btn-outline-primary" onClick={() => markComplete(en.id)}>
                        Mark Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No enrollments yet.
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
