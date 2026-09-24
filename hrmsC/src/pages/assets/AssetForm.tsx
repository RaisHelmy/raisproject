import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Asset } from "../../types";

export function AssetForm() {
  const navigate = useNavigate();
  const [assetTag, setAssetTag] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ asset: Asset }>("/assets", {
        assetTag,
        name,
        category: category || null,
        serialNumber: serialNumber || null,
        purchaseDate: purchaseDate || null,
        purchaseValue: purchaseValue ? Number(purchaseValue) : null,
      });
      navigate(`/assets/${res.asset.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Add Asset</h1>
      <div className="card shadow-sm" style={{ maxWidth: 560 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Asset tag</label>
                <input className="form-control" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Category</label>
                <input className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Serial number</label>
                <input className="form-control" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Purchase date</label>
                <input type="date" className="form-control" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Purchase value</label>
                <input type="number" min={0} step="0.01" className="form-control" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={submitting}>
              {submitting ? "Saving…" : "Create Asset"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
