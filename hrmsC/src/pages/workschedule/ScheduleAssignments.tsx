import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { EmployeePicker } from "../../components/EmployeePicker";
import type { WorkSchedule, WorkScheduleAssignment } from "../../types";

export function ScheduleAssignments() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [assignments, setAssignments] = useState<WorkScheduleAssignment[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [workScheduleId, setWorkScheduleId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ assignments: WorkScheduleAssignment[] }>("/workschedule/assignments").then((res) => setAssignments(res.assignments));
  }

  useEffect(() => {
    api.get<{ schedules: WorkSchedule[] }>("/workschedule").then((res) => {
      const active = res.schedules.filter((s) => s.is_active);
      setSchedules(active);
      if (active.length > 0) setWorkScheduleId(active[0].id);
    });
    load();
  }, []);

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/workschedule/assignments", {
        employeeId,
        workScheduleId,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      });
      setEmployeeId("");
      setEffectiveFrom("");
      setEffectiveTo("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Schedule Assignments</h1>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form className="row g-2 align-items-end" onSubmit={handleAssign}>
            <div className="col-md-4">
              <label className="form-label">Employee</label>
              <EmployeePicker value={employeeId} onChange={setEmployeeId} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Schedule</label>
              <select className="form-select" value={workScheduleId} onChange={(e) => setWorkScheduleId(e.target.value)} required>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">From</label>
              <input
                type="date"
                className="form-control"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">To (optional)</label>
              <input type="date" className="form-control" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </div>
            <div className="col-md-1">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting || !employeeId}>
                Assign
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Schedule</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.employee_name} <span className="text-secondary small">({a.employee_no})</span>
                  </td>
                  <td>{a.schedule_name}</td>
                  <td>{a.effective_from}</td>
                  <td>{a.effective_to ?? "—"}</td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No assignments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
