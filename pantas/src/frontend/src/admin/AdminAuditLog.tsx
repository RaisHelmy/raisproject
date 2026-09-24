import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface AuditRow {
  id: string;
  ts: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  result: string;
  resultReason: string | null;
}

export default function AdminAuditLog() {
  const [entityType, setEntityType] = useState("job");
  const [entityId, setEntityId] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setRows(await api.get<AuditRow[]>(`/admin/audit-log?entityType=${entityType}&entityId=${entityId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  return (
    <div>
      <h4>Audit log</h4>
      <p className="text-muted small">
        Append-only — every action, including failures, filterable by entity here. CSV export and
        broader filters (actor, group, date range) are a follow-up beyond this MVP view.
      </p>
      <form onSubmit={search} className="d-flex gap-2 mb-3">
        <input className="form-control" placeholder="entity type (e.g. job, user)" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        <input className="form-control" placeholder="entity id" value={entityId} onChange={(e) => setEntityId(e.target.value)} required />
        <button className="btn btn-primary">Search</button>
      </form>
      {error && <div className="alert alert-danger">{error}</div>}
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.ts).toLocaleString()}</td>
              <td>{r.actorUserId?.slice(0, 8) ?? "system"}</td>
              <td>{r.action}</td>
              <td>
                <span className={`badge text-bg-${r.result === "success" ? "success" : "danger"}`}>
                  {r.result}
                </span>{" "}
                {r.resultReason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
