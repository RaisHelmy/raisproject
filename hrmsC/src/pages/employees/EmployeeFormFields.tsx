import type { Employee, EmploymentType } from "../../types";
import { EmployeePicker } from "../../components/EmployeePicker";

export type EmployeeFormData = {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  division: string;
  positionTitle: string;
  grade: string;
  employmentType: EmploymentType;
  joinDate: string;
  managerId: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export const EMPTY_EMPLOYEE_FORM: EmployeeFormData = {
  fullName: "",
  email: "",
  phone: "",
  department: "",
  division: "",
  positionTitle: "",
  grade: "",
  employmentType: "full_time",
  joinDate: "",
  managerId: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
};

export function employeeToFormData(emp: Employee): EmployeeFormData {
  return {
    fullName: emp.full_name,
    email: emp.email ?? "",
    phone: emp.phone ?? "",
    department: emp.department ?? "",
    division: emp.division ?? "",
    positionTitle: emp.position_title ?? "",
    grade: emp.grade ?? "",
    employmentType: emp.employment_type,
    joinDate: emp.join_date ?? "",
    managerId: emp.manager_id ?? "",
    address: emp.address ?? "",
    emergencyContactName: emp.emergency_contact_name ?? "",
    emergencyContactPhone: emp.emergency_contact_phone ?? "",
  };
}

export function EmployeeFormFields({
  value,
  onChange,
  excludeId,
}: {
  value: EmployeeFormData;
  onChange: (patch: Partial<EmployeeFormData>) => void;
  excludeId?: string;
}) {
  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label">Full name</label>
        <input
          className="form-control"
          value={value.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          required
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Email</label>
        <input
          type="email"
          className="form-control"
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Phone</label>
        <input className="form-control" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Department</label>
        <input
          className="form-control"
          value={value.department}
          onChange={(e) => onChange({ department: e.target.value })}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Division</label>
        <input
          className="form-control"
          value={value.division}
          onChange={(e) => onChange({ division: e.target.value })}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Position title</label>
        <input
          className="form-control"
          value={value.positionTitle}
          onChange={(e) => onChange({ positionTitle: e.target.value })}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Grade</label>
        <input className="form-control" value={value.grade} onChange={(e) => onChange({ grade: e.target.value })} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Employment type</label>
        <select
          className="form-select"
          value={value.employmentType}
          onChange={(e) => onChange({ employmentType: e.target.value as EmploymentType })}
        >
          <option value="full_time">Full time</option>
          <option value="part_time">Part time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </select>
      </div>
      <div className="col-md-6">
        <label className="form-label">Join date</label>
        <input
          type="date"
          className="form-control"
          value={value.joinDate}
          onChange={(e) => onChange({ joinDate: e.target.value })}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Manager</label>
        <EmployeePicker
          value={value.managerId}
          onChange={(managerId) => onChange({ managerId })}
          excludeId={excludeId}
          placeholder="Search for a manager…"
        />
      </div>
      <div className="col-12">
        <label className="form-label">Address</label>
        <input
          className="form-control"
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Emergency contact name</label>
        <input
          className="form-control"
          value={value.emergencyContactName}
          onChange={(e) => onChange({ emergencyContactName: e.target.value })}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Emergency contact phone</label>
        <input
          className="form-control"
          value={value.emergencyContactPhone}
          onChange={(e) => onChange({ emergencyContactPhone: e.target.value })}
        />
      </div>
    </div>
  );
}
