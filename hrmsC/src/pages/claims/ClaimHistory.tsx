import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import { downloadCsv } from "../../lib/csv";
import type { Claim } from "../../types";

export function ClaimHistory() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<{ claims: Claim[] }>("/claims/me")
      .then((res) => setClaims(res.claims))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this claim?")) return;
    await api.post(`/claims/${id}/cancel`);
    load();
  }

  function exportCsv() {
    downloadCsv(
      "my-claims.csv",
      claims.map((cl) => ({
        type: cl.claim_type,
        date: cl.claim_date,
        amount: cl.amount,
        currency: cl.currency,
        distance: cl.distance ?? "",
        advance: cl.is_advance ? "Yes" : "No",
        status: cl.status,
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">My Claims</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={claims.length === 0}>
          <i className="bi bi-download me-1" /> Export CSV
        </button>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map((cl) => (
                <Fragment key={cl.id}>
                  <tr>
                    <td>{cl.claim_type}</td>
                    <td>{cl.claim_date}</td>
                    <td>
                      {cl.currency} {cl.amount.toFixed(2)}
                    </td>
                    <td>{cl.description ?? "—"}</td>
                    <td>
                      <StatusBadge status={cl.status} />
                    </td>
                    <td className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setExpandedId(expandedId === cl.id ? null : cl.id)}
                      >
                        <i className="bi bi-paperclip" />
                      </button>
                      {cl.workflow_instance_id && (
                        <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${cl.workflow_instance_id}`}>
                          Routing
                        </Link>
                      )}
                      {cl.status === "pending" && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(cl.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === cl.id && (
                    <tr>
                      <td colSpan={6} className="bg-light">
                        <AttachmentPanel module="claim" recordId={cl.id} canUpload={cl.status === "pending"} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!loading && claims.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-4">
                    No claims yet.
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
