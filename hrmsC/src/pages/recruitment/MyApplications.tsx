import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { JobApplication } from "../../types";

const STAGE_CLASS: Record<string, string> = {
  submitted: "text-bg-secondary",
  screening: "text-bg-info",
  interview: "text-bg-primary",
  offered: "text-bg-warning",
  hired: "text-bg-success",
  rejected: "text-bg-danger",
  withdrawn: "text-bg-secondary",
};

export function MyApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);

  function load() {
    api.get<{ applications: JobApplication[] }>("/recruitment/applications/me").then((res) => setApplications(res.applications));
  }
  useEffect(load, []);

  async function withdraw(id: string) {
    if (!confirm("Withdraw this application?")) return;
    await api.post(`/recruitment/applications/${id}/withdraw`);
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">My Applications</h1>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Posting</th>
                <th>Department</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>{a.posting_title}</td>
                  <td>{a.department ?? "—"}</td>
                  <td>
                    <span className={`badge ${STAGE_CLASS[a.status]}`}>{a.status}</span>
                  </td>
                  <td>
                    {!["hired", "rejected", "withdrawn"].includes(a.status) && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => withdraw(a.id)}>
                        Withdraw
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
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
