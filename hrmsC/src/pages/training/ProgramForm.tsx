import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { TrainingProgram } from "../../types";

export function ProgramForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ program: TrainingProgram }>("/training/programs", {
        title,
        category: category || null,
        description: description || null,
        location: location || null,
        startDate: startDate || null,
        endDate: endDate || null,
        capacity: capacity ? Number(capacity) : null,
      });
      navigate(`/training/programs/${res.program.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">New Training Program</h1>
      <div className="card shadow-sm" style={{ maxWidth: 560 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Title</label>
                <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Category</label>
                <input className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Internal, External" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Location</label>
                <input className="form-control" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Start date</label>
                <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">End date</label>
                <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Capacity</label>
                <input type="number" min={1} className="form-control" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={submitting}>
              {submitting ? "Saving…" : "Create Program"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
