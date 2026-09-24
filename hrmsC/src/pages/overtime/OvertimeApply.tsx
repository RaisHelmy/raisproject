import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";

export function OvertimeApply() {
  const navigate = useNavigate();
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/overtime", { workDate, hours: Number(hours), reason: reason || null });
      navigate("/overtime/history");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Request Overtime</h1>
      <div className="card shadow-sm" style={{ maxWidth: 560 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="row g-3 mb-3">
              <div className="col-7">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  required
                />
              </div>
              <div className="col-5">
                <label className="form-label">Hours</label>
                <input
                  type="number"
                  min={0.5}
                  max={24}
                  step="0.5"
                  className="form-control"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Reason</label>
              <textarea className="form-control" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
