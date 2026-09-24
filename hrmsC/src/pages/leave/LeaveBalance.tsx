import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { LeaveBalanceEntry } from "../../types";

export function LeaveBalance() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [balances, setBalances] = useState<LeaveBalanceEntry[]>([]);

  useEffect(() => {
    api.get<{ balances: LeaveBalanceEntry[] }>(`/leave/balances/me?year=${year}`).then((res) =>
      setBalances(res.balances),
    );
  }, [year]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Leave Balance</h1>
        <select
          className="form-select"
          style={{ width: 120 }}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="row g-3">
        {balances.map((b) => (
          <div key={b.leaveTypeId} className="col-md-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h2 className="h6 text-secondary mb-3">{b.leaveTypeName}</h2>
                <div className="d-flex justify-content-between">
                  <span>Entitled</span>
                  <strong>{b.entitledDays}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Used</span>
                  <strong>{b.usedDays}</strong>
                </div>
                <hr />
                <div className="d-flex justify-content-between fs-5">
                  <span>Remaining</span>
                  <strong className="text-primary">{b.remainingDays}</strong>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
