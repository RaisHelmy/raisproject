import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import type { EmployeeRequest } from "../../types";

export function RequestHistory() {
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<{ requests: EmployeeRequest[] }>("/requests/me")
      .then((res) => setRequests(res.requests))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this request?")) return;
    await api.post(`/requests/${id}/cancel`);
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">My Requests</h1>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <Fragment key={req.id}>
                  <tr>
                    <td>{req.request_type_name}</td>
                    <td>{req.title}</td>
                    <td>{req.amount != null ? req.amount.toFixed(2) : "—"}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                      >
                        <i className="bi bi-paperclip" />
                      </button>
                      {req.workflow_instance_id && (
                        <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${req.workflow_instance_id}`}>
                          Routing
                        </Link>
                      )}
                      {req.status === "pending" && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(req.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === req.id && (
                    <tr>
                      <td colSpan={5} className="bg-light">
                        <AttachmentPanel module="employee_request" recordId={req.id} canUpload={req.status === "pending"} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No requests yet.
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
