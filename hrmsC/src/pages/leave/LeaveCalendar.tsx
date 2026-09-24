import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { LeaveCalendarEntry } from "../../types";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function LeaveCalendar() {
  const { auth } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [entries, setEntries] = useState<LeaveCalendarEntry[]>([]);

  useEffect(() => {
    api.get<{ entries: LeaveCalendarEntry[] }>(`/leave/calendar?month=${month}`).then((res) => setEntries(res.entries));
  }, [month]);

  const mine = entries.filter((e) => e.employee_id === auth?.employeeId);
  const team = entries.filter((e) => e.employee_id !== auth?.employeeId);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Leave Calendar</h1>
        <input
          type="month"
          className="form-control"
          style={{ width: 180 }}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <h2 className="h5 mb-3">My Leave</h2>
      <div className="card shadow-sm mb-4">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((e) => (
                <tr key={e.id}>
                  <td>{e.leave_type_name}</td>
                  <td>{e.start_date}</td>
                  <td>{e.end_date}</td>
                  <td>{e.days}</td>
                </tr>
              ))}
              {mine.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-3">
                    No approved leave this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {team.length > 0 && (
        <>
          <h2 className="h5 mb-3">Unit Calendar</h2>
          <div className="card shadow-sm">
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((e) => (
                    <tr key={e.id}>
                      <td>{e.employee_name}</td>
                      <td>{e.leave_type_name}</td>
                      <td>{e.start_date}</td>
                      <td>{e.end_date}</td>
                      <td>{e.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
