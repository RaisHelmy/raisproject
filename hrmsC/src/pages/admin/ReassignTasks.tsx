import { useState } from "react";
import { api, ApiError } from "../../api/client";
import { EmployeePicker } from "../../components/EmployeePicker";
import type { ReassignableTask } from "../../types";

const MODULES = [
  { value: "", label: "All modules" },
  { value: "leave_application", label: "Leave" },
  { value: "claim", label: "Claims" },
  { value: "employee_request", label: "Requests" },
  { value: "training_enrollment", label: "Training" },
  { value: "uniform_order", label: "Uniform" },
  { value: "overtime", label: "Overtime" },
  { value: "leave_quota", label: "Leave Quota" },
  { value: "leave_encashment", label: "Leave Encashment" },
];

export function ReassignTasks() {
  const [module, setModule] = useState("");
  const [approverId, setApproverId] = useState("");
  const [applicantId, setApplicantId] = useState("");
  const [tasks, setTasks] = useState<ReassignableTask[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reassignTo, setReassignTo] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function search() {
    if (!approverId) {
      setError("Choose the current approver to search.");
      return;
    }
    setError(null);
    setSuccess(null);
    const params = new URLSearchParams({ approverEmployeeId: approverId });
    if (module) params.set("module", module);
    if (applicantId) params.set("applicantEmployeeId", applicantId);
    const res = await api.get<{ tasks: ReassignableTask[] }>(`/workflows/reassign/tasks?${params.toString()}`);
    setTasks(res.tasks);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function reassign(ids: string[]) {
    setError(null);
    setSuccess(null);
    if (!reassignTo) {
      setError("Choose who to reassign to.");
      return;
    }
    if (!comment.trim()) {
      setError("A comment is required.");
      return;
    }
    if (ids.length === 0) {
      setError("No tasks selected.");
      return;
    }
    try {
      const res = await api.post<{ reassignedCount: number }>("/workflows/reassign", {
        stepActionIds: ids,
        reassignTo,
        comment,
      });
      setSuccess(`Reassigned ${res.reassignedCount} task(s).`);
      setComment("");
      search();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Reassign Tasks</h1>
      <p className="text-secondary">
        Find everything pending with one approver — useful when they're on leave or have left — and hand it to
        someone else. Each reassignment needs a comment and is recorded in the routing trail.
      </p>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {success && <div className="alert alert-success py-2">{success}</div>}
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label small">Module</label>
              <select className="form-select" value={module} onChange={(e) => setModule(e.target.value)}>
                {MODULES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small">Current approver</label>
              <EmployeePicker value={approverId} onChange={setApproverId} placeholder="Search employee…" />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Applicant (optional)</label>
              <EmployeePicker value={applicantId} onChange={setApplicantId} placeholder="Search employee…" />
            </div>
            <div className="col-md-3">
              <button className="btn btn-primary w-100" onClick={search}>
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {tasks && (
        <>
          <div className="card shadow-sm mb-4">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Module</th>
                    <th>Applicant</th>
                    <th>Request</th>
                    <th>Step</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selected.has(t.id)}
                          onChange={() => toggle(t.id)}
                        />
                      </td>
                      <td>{t.module.replace(/_/g, " ")}</td>
                      <td>
                        {t.applicant_name} <span className="text-secondary small">({t.applicant_no})</span>
                      </td>
                      <td>{t.record_label ?? "—"}</td>
                      <td>{t.step_name}</td>
                      <td className="text-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-secondary py-4">
                        No pending tasks for this approver.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="card shadow-sm" style={{ maxWidth: 560 }}>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Reassign to</label>
                  <EmployeePicker value={reassignTo} onChange={setReassignTo} placeholder="Search employee…" />
                </div>
                <div className="mb-3">
                  <label className="form-label">Comment</label>
                  <textarea className="form-control" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-primary" onClick={() => reassign(Array.from(selected))}>
                    Reassign Selected ({selected.size})
                  </button>
                  <button className="btn btn-outline-primary" onClick={() => reassign(tasks.map((t) => t.id))}>
                    Reassign All ({tasks.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
