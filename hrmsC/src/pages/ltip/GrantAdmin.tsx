import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { downloadCsv } from "../../lib/csv";
import type { Employee, EquityGrant } from "../../types";

export function GrantAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [grants, setGrants] = useState<EquityGrant[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [grantDate, setGrantDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [vestingStart, setVestingStart] = useState("");
  const [vestingEnd, setVestingEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ grants: EquityGrant[] }>("/ltip").then((res) => setGrants(res.grants));
  }
  useEffect(load, []);
  useEffect(() => {
    api.get<{ employees: Employee[] }>("/employees").then((res) => setEmployees(res.employees));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/ltip", { employeeId, grantDate, quantity: Number(quantity), vestingStart, vestingEnd });
      setEmployeeId("");
      setGrantDate("");
      setQuantity("");
      setVestingStart("");
      setVestingEnd("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      "equity-grants.csv",
      grants.map((g) => ({
        employee: g.employee_name,
        employee_no: g.employee_no,
        grant_date: g.grant_date,
        quantity: g.quantity,
        vesting_start: g.vesting_start,
        vesting_end: g.vesting_end,
        status: g.status,
        vesting_percent: g.vestingPercent,
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Equity Grants</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={grants.length === 0}>
          <i className="bi bi-download me-1" /> Export CSV
        </button>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form className="row g-2 align-items-end" onSubmit={handleCreate}>
            <div className="col-md-3">
              <label className="form-label small">Employee</label>
              <select className="form-select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_no})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Grant date</label>
              <input type="date" className="form-control" value={grantDate} onChange={(e) => setGrantDate(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Quantity</label>
              <input type="number" min={1} className="form-control" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Vesting start</label>
              <input type="date" className="form-control" value={vestingStart} onChange={(e) => setVestingStart(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Vesting end</label>
              <input type="date" className="form-control" value={vestingEnd} onChange={(e) => setVestingEnd(e.target.value)} required />
            </div>
            <div className="col-md-1">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                Grant
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Quantity</th>
                <th>Vesting</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.employee_name} <span className="text-secondary small">({g.employee_no})</span>
                  </td>
                  <td>{g.quantity.toLocaleString()}</td>
                  <td>
                    {g.vesting_start} → {g.vesting_end}
                  </td>
                  <td>
                    <span
                      className={`badge ${g.status === "accepted" ? "text-bg-success" : g.status === "declined" ? "text-bg-secondary" : "text-bg-warning"}`}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td>{g.status === "accepted" ? `${g.vestingPercent}%` : "—"}</td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No grants yet.
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
