import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { JobPosting } from "../../types";

export function PostingList() {
  const { can } = useAuth();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const canManage = can("recruitment.manage");

  useEffect(() => {
    api.get<{ postings: JobPosting[] }>("/recruitment/postings").then((res) => setPostings(res.postings));
  }, []);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Internal Job Postings</h1>
        {canManage && (
          <Link to="/recruitment/postings/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-1" /> New Posting
          </Link>
        )}
      </div>
      <div className="row g-3">
        {postings.map((p) => (
          <div key={p.id} className="col-md-4">
            <Link to={`/recruitment/postings/${p.id}`} className="text-decoration-none">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <h2 className="h6">{p.title}</h2>
                    <span className={`badge ${p.status === "open" ? "text-bg-success" : "text-bg-secondary"}`}>{p.status}</span>
                  </div>
                  <div className="text-secondary small">{p.department ?? "—"}</div>
                </div>
              </div>
            </Link>
          </div>
        ))}
        {postings.length === 0 && <div className="text-secondary">No open postings.</div>}
      </div>
    </div>
  );
}
