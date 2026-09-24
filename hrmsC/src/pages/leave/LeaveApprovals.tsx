import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import type { LeaveApplication } from "../../types";

export function LeaveApprovals() {
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    api
      .get<{ applications: LeaveApplication[] }>("/leave/applications/approvals")
      .then((res) => setApplications(res.applications));
  }

  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/leave/applications/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Leave Approvals</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <Fragment key={app.id}>
                  <tr>
                    <td>
                      {app.employee_name} <span className="text-secondary small">({app.employee_no})</span>
                    </td>
                    <td>{app.leave_type_name}</td>
                    <td>
                      {app.start_date} → {app.end_date}
                    </td>
                    <td>{app.days}</td>
                    <td>{app.reason ?? "—"}</td>
                    <td className="text-secondary small">{app.step_name ?? "—"}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                        >
                          <i className="bi bi-paperclip" />
                        </button>
                        <button className="btn btn-success" onClick={() => decide(app.id, "approve")}>
                          Approve
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => decide(app.id, "reject")}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === app.id && (
                    <tr>
                      <td colSpan={7} className="bg-light">
                        <AttachmentPanel module="leave_application" recordId={app.id} canUpload={false} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
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
