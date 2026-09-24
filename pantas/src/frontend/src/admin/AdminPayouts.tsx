import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Batch {
  id: string;
  payeeType: string;
  payeeId: string;
  totalPayableMinor: number;
  totalFeesDeductedMinor: number;
  status: string;
}

export default function AdminPayouts() {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.post<Batch[]>("/admin/payouts/generate", {
        groupId: null,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
      });
      setBatches(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function markPaid(id: string) {
    await api.post(`/payouts/${id}/mark-paid`);
    setBatches((bs) => bs.map((b) => (b.id === id ? { ...b, status: "paid" } : b)));
  }

  return (
    <div>
      <h4>Generate weekly payout batches</h4>
      <p className="text-muted small">
        Also runs automatically every week via cron — this triggers it on demand for a chosen period.
      </p>
      <form onSubmit={generate} className="d-flex gap-2 mb-3">
        <input type="date" className="form-control" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        <input type="date" className="form-control" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        <button className="btn btn-primary">Generate</button>
      </form>
      {error && <div className="alert alert-danger">{error}</div>}
      <table className="table">
        <thead>
          <tr>
            <th>Payee</th>
            <th>Payable</th>
            <th>Fees deducted</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>
                {b.payeeType} {b.payeeId.slice(0, 8)}
              </td>
              <td>RM {(b.totalPayableMinor / 100).toFixed(2)}</td>
              <td>RM {(b.totalFeesDeductedMinor / 100).toFixed(2)}</td>
              <td>{b.status}</td>
              <td>
                {b.status === "pending" && (
                  <button className="btn btn-sm btn-outline-success" onClick={() => markPaid(b.id)}>
                    Mark paid
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
