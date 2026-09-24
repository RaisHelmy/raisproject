import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { TrainingProgram } from "../../types";

export function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can("training.manage");
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  function load() {
    api.get<{ program: TrainingProgram }>(`/training/programs/${id}`).then((res) => setProgram(res.program));
  }
  useEffect(load, [id]);

  async function enroll() {
    setError(null);
    try {
      await api.post("/training/enrollments", { programId: id });
      setEnrolled(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function closeProgram() {
    await api.put(`/training/programs/${id}`, { status: "closed" });
    load();
  }

  if (!program) return <div className="text-secondary">Loading…</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="h3 mb-1">{program.title}</h1>
          <div className="text-secondary">
            {program.category ?? "General"} · {program.location ?? "TBD"}
          </div>
        </div>
        <span className={`badge ${program.status === "open" ? "text-bg-success" : "text-bg-secondary"}`}>{program.status}</span>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {enrolled && <div className="alert alert-success py-2">Enrollment submitted — check My Enrollments for status.</div>}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <p>{program.description ?? "No description provided."}</p>
          <div className="text-secondary small">
            {program.start_date ?? "TBD"} {program.end_date ? `→ ${program.end_date}` : ""}
            {program.capacity != null && ` · Capacity: ${program.capacity}`}
          </div>
        </div>
      </div>

      <div className="d-flex gap-2">
        {program.status === "open" && !enrolled && (
          <button className="btn btn-primary" onClick={enroll}>
            Enroll
          </button>
        )}
        {canManage && program.status === "open" && (
          <button className="btn btn-outline-secondary" onClick={closeProgram}>
            Close Enrollment
          </button>
        )}
      </div>
    </div>
  );
}
