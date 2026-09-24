import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api/client";
import type { LeaveType } from "../../types";

export function LeaveTypesAdmin() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [name, setName] = useState("");
  const [days, setDays] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ leaveTypes: LeaveType[] }>("/leave/types").then((res) => setLeaveTypes(res.leaveTypes));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/leave/types", { name, defaultEntitlementDays: days, requiresAttachment: false });
      setName("");
      setDays(0);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(lt: LeaveType) {
    await api.put(`/leave/types/${lt.id}`, { isActive: !lt.is_active });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Leave Types</h1>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={handleCreate}>
            <div className="col-md-5">
              <label className="form-label">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label">Default entitlement (days/yr)</label>
              <input
                type="number"
                min={0}
                className="form-control"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                Add
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
                <th>Name</th>
                <th>Default entitlement</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map((lt) => (
                <tr key={lt.id}>
                  <td>{lt.name}</td>
                  <td>{lt.default_entitlement_days} days/yr</td>
                  <td>
                    <span className={`badge ${lt.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {lt.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(lt)}>
                      {lt.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
