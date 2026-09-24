export type ProgramStatus = "open" | "closed" | "cancelled";
export type EnrollmentStatus = "pending" | "approved" | "rejected" | "cancelled" | "completed";

export type TrainingProgram = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  capacity: number | null;
  status: ProgramStatus;
  created_at: string;
};

export type TrainingEnrollment = {
  id: string;
  tenant_id: string;
  program_id: string;
  employee_id: string;
  status: EnrollmentStatus;
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
};

export type TrainingEvaluation = {
  id: string;
  tenant_id: string;
  enrollment_id: string;
  employee_id: string;
  rating: number;
  feedback: string | null;
  submitted_at: string;
};
