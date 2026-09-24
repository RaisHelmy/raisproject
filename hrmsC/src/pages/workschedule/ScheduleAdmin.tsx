import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api/client";
import { DAY_LABELS, formatWorkDays } from "../../types";
import type { WorkSchedule } from "../../types";

const DAY_KEYS = Object.keys(DAY_LABELS);

export function ScheduleAdmin() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [workDays, setWorkDays] = useState<string[]>(["1", "2", "3", "4", "5"]);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ schedules: WorkSchedule[] }>("/workschedule").then((res) => setSchedules(res.schedules));
  }

  useEffect(load, []);

  function toggleDay(day: string) {
    setWorkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (workDays.length === 0) return;
    setSubmitting(true);
    try {
      await api.post("/workschedule", { name, startTime, endTime, workDays: workDays.join(",") });
      setName("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(ws: WorkSchedule) {
    await api.put(`/workschedule/${ws.id}`, { isActive: !ws.is_active });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Work Schedules</h1>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={handleCreate}>
            <div className="col-md-4">
              <label className="form-label">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label">Start</label>
              <input
                type="time"
                className="form-control"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">End</label>
              <input
                type="time"
                className="form-control"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label d-block">Work days</label>
              <div className="btn-group" role="group">
                {DAY_KEYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`btn btn-sm ${workDays.includes(day) ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => toggleDay(day)}
                  >
                    {DAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={submitting || workDays.length === 0}>
                Add Schedule
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
                <th>Name</th>
                <th>Hours</th>
                <th>Work days</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((ws) => (
                <tr key={ws.id}>
                  <td>{ws.name}</td>
                  <td>
                    {ws.start_time} – {ws.end_time}
                  </td>
                  <td>{formatWorkDays(ws.work_days)}</td>
                  <td>
                    <span className={`badge ${ws.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {ws.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(ws)}>
                      {ws.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
