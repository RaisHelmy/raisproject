import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import type { ApplicationStatus, TrainingEnrollment } from "../../types";

export function MyEnrollments() {
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ enrollments: TrainingEnrollment[] }>("/training/enrollments/me").then((res) => setEnrollments(res.enrollments));
  }
  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this enrollment?")) return;
    await api.post(`/training/enrollments/${id}/cancel`);
    load();
  }

  async function submitEvaluation(id: string) {
    setError(null);
    try {
      await api.post(`/training/enrollments/${id}/evaluation`, { rating: ratings[id] ?? 5 });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">My Enrollments</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Program</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((en) => (
                <tr key={en.id}>
                  <td>{en.program_title}</td>
                  <td>
                    {en.status === "completed" ? (
                      <span className="badge text-bg-success">completed</span>
                    ) : (
                      <StatusBadge status={en.status as ApplicationStatus} />
                    )}
                  </td>
                  <td className="d-flex gap-2 align-items-center">
                    {en.workflow_instance_id && (
                      <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${en.workflow_instance_id}`}>
                        Routing
                      </Link>
                    )}
                    {en.status === "pending" && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(en.id)}>
                        Cancel
                      </button>
                    )}
                    {en.status === "completed" && (
                      <>
                        <select
                          className="form-select form-select-sm"
                          style={{ width: 90 }}
                          value={ratings[en.id] ?? 5}
                          onChange={(e) => setRatings((prev) => ({ ...prev, [en.id]: Number(e.target.value) }))}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} ★
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-sm btn-outline-primary" onClick={() => submitEvaluation(en.id)}>
                          Rate
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-secondary py-4">
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
