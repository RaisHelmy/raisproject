import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { downloadCsv } from "../../lib/csv";
import { formatWorkDays } from "../../types";
import type { Timesheet, WorkScheduleAssignment } from "../../types";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function Attendance() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mySchedule, setMySchedule] = useState<WorkScheduleAssignment | null>(null);

  function load() {
    api.get<{ timesheets: Timesheet[] }>(`/attendance/me?month=${month}`).then((res) =>
      setTimesheets(res.timesheets),
    );
  }

  useEffect(load, [month]);
  useEffect(() => {
    api.get<{ assignment: WorkScheduleAssignment | null }>("/workschedule/mine").then((res) => setMySchedule(res.assignment));
  }, []);

  function exportCsv() {
    downloadCsv(
      "my-timesheet.csv",
      timesheets.map((t) => ({
        date: t.work_date,
        clock_in: t.clock_in ?? "",
        clock_out: t.clock_out ?? "",
        hours: t.hours ?? "",
      })),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = timesheets.find((t) => t.work_date === today);

  async function clockIn() {
    setError(null);
    setBusy(true);
    try {
      await api.post("/attendance/clock-in");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    setError(null);
    setBusy(true);
    try {
      await api.post("/attendance/clock-out");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Attendance</h1>
        <Link to="/overtime/apply" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-alarm me-1" /> Request Overtime
        </Link>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body d-flex align-items-center gap-3">
          <button className="btn btn-success" disabled={busy || !!todayRow?.clock_in} onClick={clockIn}>
            <i className="bi bi-box-arrow-in-right me-1" /> Clock In
          </button>
          <button
            className="btn btn-outline-danger"
            disabled={busy || !todayRow?.clock_in || !!todayRow?.clock_out}
            onClick={clockOut}
          >
            <i className="bi bi-box-arrow-right me-1" /> Clock Out
          </button>
          {todayRow && (
            <div className="text-secondary small">
              Today: in {todayRow.clock_in ? new Date(todayRow.clock_in).toLocaleTimeString() : "—"}, out{" "}
              {todayRow.clock_out ? new Date(todayRow.clock_out).toLocaleTimeString() : "—"}
            </div>
          )}
          {mySchedule && (
            <div className="text-secondary small ms-auto">
              <i className="bi bi-calendar-week me-1" />
              {mySchedule.name} ({mySchedule.start_time}–{mySchedule.end_time}, {formatWorkDays(mySchedule.work_days ?? "")})
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">My Timesheet</h2>
        <div className="d-flex gap-2">
          <input
            type="month"
            className="form-control"
            style={{ width: 180 }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={timesheets.length === 0}>
            <i className="bi bi-download me-1" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {timesheets.map((t) => (
                <tr key={t.id}>
                  <td>{t.work_date}</td>
                  <td>{t.clock_in ? new Date(t.clock_in).toLocaleTimeString() : "—"}</td>
                  <td>{t.clock_out ? new Date(t.clock_out).toLocaleTimeString() : "—"}</td>
                  <td>{t.hours ?? "—"}</td>
                </tr>
              ))}
              {timesheets.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No records for this month.
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
