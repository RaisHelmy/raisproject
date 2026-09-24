import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ApplicationStage, JobApplication } from "../../types";

const STAGES: ApplicationStage[] = ["submitted", "screening", "interview", "offered", "rejected", "hired"];

export function ApplicationPipeline() {
  const [applications, setApplications] = useState<JobApplication[]>([]);

  function load() {
    api.get<{ applications: JobApplication[] }>("/recruitment/applications").then((res) => setApplications(res.applications));
  }
  useEffect(load, []);

  async function setStage(id: string, status: ApplicationStage) {
    await api.patch(`/recruitment/applications/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Application Pipeline</h1>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Candidate</th>
                <th>Posting</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.employee_name} <span className="text-secondary small">({a.employee_no})</span>
                  </td>
                  <td>{a.posting_title}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 160 }}
                      value={a.status}
                      disabled={a.status === "withdrawn"}
                      onChange={(e) => setStage(a.id, e.target.value as ApplicationStage)}
                    >
                      {a.status === "withdrawn" && <option value="withdrawn">withdrawn</option>}
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-secondary py-4">
                    No applications yet.
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
