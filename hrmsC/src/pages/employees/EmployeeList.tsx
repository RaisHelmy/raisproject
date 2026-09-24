import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { downloadCsv } from "../../lib/csv";
import type { Employee } from "../../types";

const STATUS_CLASS: Record<string, string> = {
  active: "text-bg-success",
  on_leave: "text-bg-warning",
  resigned: "text-bg-secondary",
  terminated: "text-bg-dark",
};

export function EmployeeList() {
  const { can } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const canManage = can("employees.manage");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    api
      .get<{ employees: Employee[] }>(`/employees?${params.toString()}`)
      .then((res) => setEmployees(res.employees))
      .finally(() => setLoading(false));
  }, [q]);

  function exportCsv() {
    downloadCsv(
      "employees.csv",
      employees.map((emp) => ({
        employee_no: emp.employee_no,
        name: emp.full_name,
        email: emp.email ?? "",
        department: emp.department ?? "",
        position: emp.position_title ?? "",
        employment_type: emp.employment_type,
        status: emp.status,
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Employee Directory</h1>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={employees.length === 0}>
            <i className="bi bi-download me-1" /> Export CSV
          </button>
          {canManage && (
            <Link to="/employees/new" className="btn btn-primary">
              <i className="bi bi-plus-lg me-1" /> Add Employee
            </Link>
          )}
        </div>
      </div>

      <div className="mb-3">
        <input
          className="form-control"
          style={{ maxWidth: 360 }}
          placeholder="Search by name, employee no, or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee No</th>
                <th>Name</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.employee_no}</td>
                  <td>
                    <Link to={`/employees/${emp.id}`}>{emp.full_name}</Link>
                  </td>
                  <td>{emp.department ?? "—"}</td>
                  <td>{emp.position_title ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[emp.status]}`}>{emp.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
              {!loading && employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No employees found.
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
