import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { TrainingProgram } from "../../types";

export function ProgramList() {
  const { can } = useAuth();
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const canManage = can("training.manage");

  useEffect(() => {
    api.get<{ programs: TrainingProgram[] }>("/training/programs").then((res) => setPrograms(res.programs));
  }, []);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Training Calendar</h1>
        {canManage && (
          <Link to="/training/programs/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-1" /> New Program
          </Link>
        )}
      </div>
      <div className="row g-3">
        {programs.map((p) => (
          <div key={p.id} className="col-md-4">
            <Link to={`/training/programs/${p.id}`} className="text-decoration-none">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <h2 className="h6">{p.title}</h2>
                    <span className={`badge ${p.status === "open" ? "text-bg-success" : "text-bg-secondary"}`}>{p.status}</span>
                  </div>
                  <div className="text-secondary small">{p.category ?? "General"}</div>
                  <div className="text-secondary small mt-2">
                    {p.start_date ?? "TBD"} {p.end_date ? `→ ${p.end_date}` : ""}
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}
        {programs.length === 0 && <div className="text-secondary">No training programs yet.</div>}
      </div>
    </div>
  );
}
