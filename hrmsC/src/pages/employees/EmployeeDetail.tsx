import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Employee, EmployeeStatus } from "../../types";
import { employeeToFormData, EmployeeFormFields, type EmployeeFormData } from "./EmployeeFormFields";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="col-md-6">
      <div className="text-secondary small">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { auth, can, refresh } = useAuth();
  const canManage = can("employees.manage");

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EmployeeFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ employee: Employee }>(`/employees/${id}`).then((res) => {
      setEmployee(res.employee);
      setForm(employeeToFormData(res.employee));
      if (res.employee.manager_id) {
        api.get<{ employee: Employee }>(`/employees/${res.employee.manager_id}`).then((mgr) =>
          setManagerName(mgr.employee.full_name),
        );
      } else {
        setManagerName(null);
      }
    });
  }

  useEffect(load, [id]);

  function patch(p: Partial<EmployeeFormData>) {
    setForm((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form || !id) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.put(`/employees/${id}`, {
        fullName: form.fullName,
        email: form.email || null,
        phone: form.phone || null,
        department: form.department || null,
        division: form.division || null,
        positionTitle: form.positionTitle || null,
        grade: form.grade || null,
        employmentType: form.employmentType,
        joinDate: form.joinDate || null,
        managerId: form.managerId || null,
        address: form.address || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
      });
      setEditing(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(status: EmployeeStatus) {
    if (!id) return;
    await api.patch(`/employees/${id}/status`, { status });
    load();
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm("Delete this employee record? This cannot be undone.")) return;
    await api.delete(`/employees/${id}`);
    navigate("/employees", { replace: true });
  }

  async function loginAs() {
    if (!id) return;
    setError(null);
    try {
      await api.post(`/simulate/${id}/start`);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (!employee || !form) {
    return <div className="text-secondary">Loading…</div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="h3 mb-1">{employee.full_name}</h1>
          <div className="text-secondary">
            {employee.employee_no} · {employee.position_title ?? "—"}
          </div>
        </div>
        {canManage && !editing && (
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={() => setEditing(true)}>
              Edit
            </button>
            {auth?.role === "admin" && employee.user_id && employee.id !== auth.employeeId && (
              <button className="btn btn-outline-secondary" onClick={loginAs}>
                <i className="bi bi-person-badge me-1" /> Login As
              </button>
            )}
            {auth?.role === "admin" && (
              <button className="btn btn-outline-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {canManage && (
        <div className="mb-4 d-flex align-items-center gap-2">
          <span className="text-secondary small">Status:</span>
          {(["active", "on_leave", "resigned", "terminated"] as EmployeeStatus[]).map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${employee.status === s ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => changeStatus(s)}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {editing ? (
            <form onSubmit={handleSave}>
              <EmployeeFormFields value={form} onChange={patch} excludeId={employee.id} />
              <div className="mt-4 d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setEditing(false);
                    setForm(employeeToFormData(employee));
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="row g-3">
              <Field label="Email" value={employee.email} />
              <Field label="Phone" value={employee.phone} />
              <Field label="Department" value={employee.department} />
              <Field label="Division" value={employee.division} />
              <Field label="Grade" value={employee.grade} />
              <Field label="Employment type" value={employee.employment_type.replace("_", " ")} />
              <Field label="Join date" value={employee.join_date} />
              <Field label="Manager" value={managerName} />
              <Field label="Address" value={employee.address} />
              <Field label="Emergency contact" value={employee.emergency_contact_name} />
              <Field label="Emergency contact phone" value={employee.emergency_contact_phone} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
