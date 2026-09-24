import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Employee } from "../../types";
import { EMPTY_EMPLOYEE_FORM, EmployeeFormFields, type EmployeeFormData } from "./EmployeeFormFields";

export function EmployeeForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_EMPLOYEE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function patch(p: Partial<EmployeeFormData>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ employee: Employee }>("/employees", {
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
      navigate(`/employees/${res.employee.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Add Employee</h1>
      <div className="card shadow-sm" style={{ maxWidth: 760 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <EmployeeFormFields value={form} onChange={patch} />
            <div className="mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving…" : "Create Employee"}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
