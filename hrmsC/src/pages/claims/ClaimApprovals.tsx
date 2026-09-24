import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import { downloadCsv } from "../../lib/csv";
import type { Claim } from "../../types";

export function ClaimApprovals() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    api.get<{ claims: Claim[] }>("/claims/approvals").then((res) => setClaims(res.claims));
  }

  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/claims/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  function exportCsv() {
    downloadCsv(
      "claims-approvals.csv",
      claims.map((cl) => ({
        employee: cl.employee_name ?? "",
        employee_no: cl.employee_no ?? "",
        type: cl.claim_type,
        date: cl.claim_date,
        amount: cl.amount,
        currency: cl.currency,
        advance: cl.is_advance ? "Yes" : "No",
        step: cl.step_name ?? "",
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Claims Approvals</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={claims.length === 0}>
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
                <th>Type</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map((cl) => (
                <Fragment key={cl.id}>
                  <tr>
                    <td>
                      {cl.employee_name} <span className="text-secondary small">({cl.employee_no})</span>
                    </td>
                    <td>{cl.claim_type}</td>
                    <td>{cl.claim_date}</td>
                    <td>
                      {cl.currency} {cl.amount.toFixed(2)}
                    </td>
                    <td>{cl.description ?? "—"}</td>
                    <td className="text-secondary small">{cl.step_name ?? "—"}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => setExpandedId(expandedId === cl.id ? null : cl.id)}
                        >
                          <i className="bi bi-paperclip" />
                        </button>
                        <button className="btn btn-success" onClick={() => decide(cl.id, "approve")}>
                          Approve
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => decide(cl.id, "reject")}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === cl.id && (
                    <tr>
                      <td colSpan={7} className="bg-light">
                        <AttachmentPanel module="claim" recordId={cl.id} canUpload={false} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {claims.length === 0 && (
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
