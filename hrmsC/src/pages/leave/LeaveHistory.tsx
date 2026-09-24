import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import type { LeaveApplication } from "../../types";

export function LeaveHistory() {
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<{ applications: LeaveApplication[] }>("/leave/applications/me")
      .then((res) => setApplications(res.applications))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this leave application?")) return;
    await api.post(`/leave/applications/${id}/cancel`);
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">My Leave History</h1>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <Fragment key={app.id}>
                  <tr>
                    <td>{app.leave_type_name}</td>
                    <td>
                      {app.start_date} → {app.end_date}
                    </td>
                    <td>{app.days}</td>
                    <td>{app.reason ?? "—"}</td>
                    <td>
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                      >
                        <i className="bi bi-paperclip" />
                      </button>
                      {app.workflow_instance_id && (
                        <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${app.workflow_instance_id}`}>
                          Routing
                        </Link>
                      )}
                      {app.status === "pending" && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(app.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === app.id && (
                    <tr>
                      <td colSpan={6} className="bg-light">
                        <AttachmentPanel module="leave_application" recordId={app.id} canUpload={app.status === "pending"} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && applications.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-4">
                    No leave applications yet.
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
