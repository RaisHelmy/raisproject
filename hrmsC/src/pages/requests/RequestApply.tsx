import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { RequestType } from "../../types";

export function RequestApply() {
  const navigate = useNavigate();
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requestTypeId, setRequestTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ requestTypes: RequestType[] }>("/requests/types").then((res) => {
      setRequestTypes(res.requestTypes);
      if (res.requestTypes.length > 0) setRequestTypeId(res.requestTypes[0].id);
    });
  }, []);

  const selectedType = requestTypes.find((rt) => rt.id === requestTypeId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/requests", {
        requestTypeId,
        title,
        amount: selectedType?.requires_amount ? Number(amount) : null,
        details: details || null,
      });
      navigate("/requests/history");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Submit a Request</h1>
      <div className="card shadow-sm" style={{ maxWidth: 560 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Request type</label>
              <select
                className="form-select"
                value={requestTypeId}
                onChange={(e) => setRequestTypeId(e.target.value)}
                required
              >
                {requestTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
              {selectedType?.description && <div className="form-text">{selectedType.description}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label">Title / reference</label>
              <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            {selectedType?.requires_amount && (
              <div className="mb-3">
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
            <div className="mb-3">
              <label className="form-label">Details</label>
              <textarea
                className="form-control"
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || !requestTypeId}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
