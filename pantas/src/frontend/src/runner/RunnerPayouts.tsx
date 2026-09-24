import { useEffect, useState } from "react";
import { api } from "../api";

interface PayoutBatch {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalPayableMinor: number;
  totalFeesDeductedMinor: number;
  status: string;
}

export default function RunnerPayouts() {
  const [batches, setBatches] = useState<PayoutBatch[]>([]);

  useEffect(() => {
    api.get<PayoutBatch[]>("/payouts/mine").then(setBatches).catch(console.error);
  }, []);

  return (
    <div>
      <h4>Weekly payouts</h4>
      {batches.length === 0 && <p className="text-muted">No payout batches yet.</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Payable</th>
            <th>Fees deducted</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>
                {b.periodStart.slice(0, 10)} – {b.periodEnd.slice(0, 10)}
              </td>
              <td>RM {(b.totalPayableMinor / 100).toFixed(2)}</td>
              <td>RM {(b.totalFeesDeductedMinor / 100).toFixed(2)}</td>
              <td>
                <span className="badge text-bg-secondary">{b.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
