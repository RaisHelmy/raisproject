import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { EquityGrant } from "../../types";

export function MyGrants() {
  const [grants, setGrants] = useState<EquityGrant[]>([]);

  function load() {
    api.get<{ grants: EquityGrant[] }>("/ltip/me").then((res) => setGrants(res.grants));
  }
  useEffect(load, []);

  async function decide(id: string, action: "accept" | "decline") {
    await api.post(`/ltip/${id}/decide`, { action });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">My Equity Grants</h1>
      <div className="row g-3">
        {grants.map((g) => (
          <div key={g.id} className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <h2 className="h6">{g.quantity.toLocaleString()} units</h2>
                  <span
                    className={`badge ${g.status === "accepted" ? "text-bg-success" : g.status === "declined" ? "text-bg-secondary" : "text-bg-warning"}`}
                  >
                    {g.status}
                  </span>
                </div>
                <div className="text-secondary small">Granted {g.grant_date}</div>
                <div className="text-secondary small">
                  Vests {g.vesting_start} → {g.vesting_end}
                </div>

                {g.status === "accepted" && (
                  <div className="mt-2">
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-bar" style={{ width: `${g.vestingPercent}%` }} />
                    </div>
                    <div className="text-secondary small mt-1">{g.vestingPercent}% vested</div>
                  </div>
                )}

                {g.status === "offered" && (
                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-sm btn-primary" onClick={() => decide(g.id, "accept")}>
                      Accept
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => decide(g.id, "decline")}>
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {grants.length === 0 && <div className="text-secondary">No equity grants yet.</div>}
      </div>
    </div>
  );
}
