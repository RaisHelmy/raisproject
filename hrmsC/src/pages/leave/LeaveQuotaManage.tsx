import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { EmployeePicker } from "../../components/EmployeePicker";
import { StatusBadge } from "../../components/StatusBadge";
import type { LeaveQuotaGrant, LeaveType } from "../../types";

export function LeaveQuotaManage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [grants, setGrants] = useState<LeaveQuotaGrant[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ grants: LeaveQuotaGrant[] }>("/leave/quota").then((res) => setGrants(res.grants));
  }

  useEffect(() => {
    api.get<{ leaveTypes: LeaveType[] }>("/leave/types").then((res) => {
      setLeaveTypes(res.leaveTypes);
      if (res.leaveTypes.length > 0) setLeaveTypeId(res.leaveTypes[0].id);
    });
    load();
  }, []);

  async function handleGrant(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/leave/quota/grant", { employeeId, leaveTypeId, days: Number(days), reason: reason || null });
      setEmployeeId("");
      setDays("");
      setReason("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Leave Quota Grants</h1>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form className="row g-2 align-items-end" onSubmit={handleGrant}>
            <div className="col-md-3">
              <label className="form-label">Employee</label>
              <EmployeePicker value={employeeId} onChange={setEmployeeId} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Leave type</label>
              <select className="form-select" value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Days</label>
              <input
                type="number"
                min={0.5}
                step="0.5"
                className="form-control"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Reason</label>
              <input className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="col-md-1">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting || !employeeId}>
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
                <th>Type</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.employee_name} <span className="text-secondary small">({g.employee_no})</span>
                  </td>
                  <td>{g.leave_type_name}</td>
                  <td>{g.granted_days}</td>
                  <td>{g.reason ?? "—"}</td>
                  <td>
                    <StatusBadge status={g.status} />
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No quota grants yet.
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
