import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import type { EmployeeRequest } from "../../types";

export function RequestApprovals() {
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    api.get<{ requests: EmployeeRequest[] }>("/requests/approvals").then((res) => setRequests(res.requests));
  }

  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/requests/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Request Approvals</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Title</th>
                <th>Amount</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <Fragment key={req.id}>
                  <tr>
                    <td>
                      {req.employee_name} <span className="text-secondary small">({req.employee_no})</span>
                    </td>
                    <td>{req.request_type_name}</td>
                    <td>{req.title}</td>
                    <td>{req.amount != null ? req.amount.toFixed(2) : "—"}</td>
                    <td className="text-secondary small">{req.step_name ?? "—"}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                        >
                          <i className="bi bi-paperclip" />
                        </button>
                        <button className="btn btn-success" onClick={() => decide(req.id, "approve")}>
                          Approve
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => decide(req.id, "reject")}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === req.id && (
                    <tr>
                      <td colSpan={6} className="bg-light">
                        <AttachmentPanel module="employee_request" recordId={req.id} canUpload={false} />
                      </td>
                    </tr>
                  )}
                </Fragment>
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
