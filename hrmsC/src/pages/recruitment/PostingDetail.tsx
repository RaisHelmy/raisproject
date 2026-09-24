import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { JobPosting } from "../../types";

export function PostingDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can("recruitment.manage");
  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  function load() {
    api.get<{ posting: JobPosting }>(`/recruitment/postings/${id}`).then((res) => setPosting(res.posting));
  }
  useEffect(load, [id]);

  async function apply() {
    setError(null);
    try {
      await api.post("/recruitment/applications", { postingId: id, coverNote: coverNote || null });
      setApplied(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function close() {
    await api.put(`/recruitment/postings/${id}`, { status: "closed" });
    load();
  }

  if (!posting) return <div className="text-secondary">Loading…</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="h3 mb-1">{posting.title}</h1>
          <div className="text-secondary">{posting.department ?? "—"}</div>
        </div>
        <span className={`badge ${posting.status === "open" ? "text-bg-success" : "text-bg-secondary"}`}>{posting.status}</span>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {applied && <div className="alert alert-success py-2">Application submitted.</div>}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <p style={{ whiteSpace: "pre-wrap" }}>{posting.description ?? "No description provided."}</p>
          {posting.closing_date && <div className="text-secondary small">Closes {posting.closing_date}</div>}
        </div>
      </div>

      {posting.status === "open" && !applied && (
        <div className="card shadow-sm mb-4" style={{ maxWidth: 480 }}>
          <div className="card-body">
            <label className="form-label">Cover note (optional)</label>
            <textarea className="form-control mb-3" rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
            <button className="btn btn-primary" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      )}

      {canManage && posting.status === "open" && (
        <button className="btn btn-outline-secondary" onClick={close}>
          Close Posting
        </button>
      )}
    </div>
  );
}
