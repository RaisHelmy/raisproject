export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeStatus = "active" | "on_leave" | "resigned" | "terminated";

export type Employee = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  employee_no: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  division: string | null;
  position_title: string | null;
  grade: string | null;
  employment_type: EmploymentType;
  join_date: string | null;
  status: EmployeeStatus;
  manager_id: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
};
