import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api/client";
import type { ClaimType } from "../../types";

export function ClaimTypesAdmin() {
  const [claimTypes, setClaimTypes] = useState<ClaimType[]>([]);
  const [name, setName] = useState("");
  const [isMileage, setIsMileage] = useState(false);
  const [mileageRate, setMileageRate] = useState("");
  const [isAdvance, setIsAdvance] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ claimTypes: ClaimType[] }>("/claims/types").then((res) => setClaimTypes(res.claimTypes));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/claims/types", {
        name,
        isMileage,
        mileageRate: isMileage ? Number(mileageRate) : null,
        isAdvance,
      });
      setName("");
      setIsMileage(false);
      setMileageRate("");
      setIsAdvance(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(ct: ClaimType) {
    await api.put(`/claims/types/${ct.id}`, { isActive: !ct.is_active });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Claim Types</h1>
      <p className="text-secondary">
        Mileage types auto-compute the claim amount from distance × rate. Advance types flag a pre-expense claim
        submitted before a trip.
      </p>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={handleCreate}>
            <div className="col-md-3">
              <label className="form-label small">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-2 form-check mt-4">
              <input
                type="checkbox"
                className="form-check-input"
                id="isMileage"
                checked={isMileage}
                onChange={(e) => setIsMileage(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="isMileage">
                Mileage
              </label>
            </div>
            {isMileage && (
              <div className="col-md-2">
                <label className="form-label small">Rate / unit</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="form-control"
                  value={mileageRate}
                  onChange={(e) => setMileageRate(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="col-md-2 form-check mt-4">
              <input
                type="checkbox"
                className="form-check-input"
                id="isAdvance"
                checked={isAdvance}
                onChange={(e) => setIsAdvance(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="isAdvance">
                Advance claim
              </label>
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
                <th>Mileage rate</th>
                <th>Advance</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claimTypes.map((ct) => (
                <tr key={ct.id}>
                  <td>{ct.name}</td>
                  <td>{ct.is_mileage ? ct.mileage_rate : "—"}</td>
                  <td>{ct.is_advance ? "Yes" : "No"}</td>
                  <td>
                    <span className={`badge ${ct.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {ct.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(ct)}>
                      {ct.is_active ? "Deactivate" : "Activate"}
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
