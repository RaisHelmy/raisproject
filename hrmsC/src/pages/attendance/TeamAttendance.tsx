import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { Employee, Timesheet } from "../../types";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function TeamAttendance() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  useEffect(() => {
    api.get<{ employees: Employee[] }>("/employees").then((res) => setEmployees(res.employees));
  }, []);

  useEffect(() => {
    if (!employeeId) {
      setTimesheets([]);
      return;
    }
    api
      .get<{ timesheets: Timesheet[] }>(`/attendance?employeeId=${employeeId}&month=${month}`)
      .then((res) => setTimesheets(res.timesheets));
  }, [employeeId, month]);

  return (
    <div>
      <h1 className="h3 mb-4">Team Timesheet</h1>

      <div className="row g-2 mb-4">
        <div className="col-md-5">
          <select className="form-select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_no})
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <input
            type="month"
            className="form-control"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
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
              {employeeId && timesheets.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No records for this month.
                  </td>
                </tr>
              )}
              {!employeeId && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    Select an employee to view their timesheet.
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
