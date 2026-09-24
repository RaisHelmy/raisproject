import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import type { Employee, Role, UserAccount } from "../../types";

export function Users() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ users: UserAccount[] }>("/admin/users").then((res) => setUsers(res.users));
    api.get<{ employees: Employee[] }>("/employees").then((res) => setEmployees(res.employees));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/admin/users", {
        name,
        email,
        password,
        role,
        employeeId: employeeId || null,
      });
      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");
      setEmployeeId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u: UserAccount) {
    await api.put(`/admin/users/${u.id}`, { isActive: !u.is_active });
    load();
  }

  async function changeRole(u: UserAccount, newRole: Role) {
    await api.put(`/admin/users/${u.id}`, { role: newRole });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Users</h1>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h6 text-secondary mb-3">Create user account</h2>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form className="row g-2 align-items-end" onSubmit={handleCreate}>
            <div className="col-md-3">
              <label className="form-label">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Password</label>
              <input
                type="password"
                minLength={8}
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Role</label>
              <select className="form-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                Create
              </button>
            </div>
            <div className="col-12">
              <label className="form-label">Link to employee record (optional)</label>
              <select className="form-select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">— None —</option>
                {employees
                  .filter((emp) => !emp.user_id)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_no})
                    </option>
                  ))}
              </select>
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
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 130 }}
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr">HR</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {u.is_active ? "active" : "disabled"}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(u)}>
                      {u.is_active ? "Disable" : "Enable"}
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
