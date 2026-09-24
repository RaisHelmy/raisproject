import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ClaimType } from "../../types";

export function ClaimApply() {
  const navigate = useNavigate();
  const [claimTypes, setClaimTypes] = useState<ClaimType[]>([]);
  const [claimTypeId, setClaimTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [distance, setDistance] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [claimDate, setClaimDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ claimTypes: ClaimType[] }>("/claims/types").then((res) => {
      setClaimTypes(res.claimTypes);
      if (res.claimTypes.length > 0) setClaimTypeId(res.claimTypes[0].id);
    });
  }, []);

  const selectedType = claimTypes.find((t) => t.id === claimTypeId);
  const estimatedAmount =
    selectedType?.is_mileage && distance ? (Number(distance) * (selectedType.mileage_rate ?? 0)).toFixed(2) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/claims", {
        claimTypeId,
        amount: selectedType?.is_mileage ? undefined : Number(amount),
        distance: selectedType?.is_mileage ? Number(distance) : undefined,
        currency,
        claimDate,
        description: description || null,
      });
      navigate("/claims/history");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Submit Claim</h1>
      <div className="card shadow-sm" style={{ maxWidth: 560 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Claim type</label>
              <select className="form-select" value={claimTypeId} onChange={(e) => setClaimTypeId(e.target.value)} required>
                {claimTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_advance ? " (advance)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="row g-3 mb-3">
              {selectedType?.is_mileage ? (
                <div className="col-8">
                  <label className="form-label">Distance ({selectedType.mileage_rate}/unit)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className="form-control"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    required
                  />
                  {estimatedAmount && <div className="form-text">Estimated amount: {estimatedAmount}</div>}
                </div>
              ) : (
                <div className="col-8">
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="col-4">
                <label className="form-label">Currency</label>
                <input className="form-control" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Claim date</label>
              <input
                type="date"
                className="form-control"
                value={claimDate}
                onChange={(e) => setClaimDate(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !claimTypeId}>
              {submitting ? "Submitting…" : "Submit Claim"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
