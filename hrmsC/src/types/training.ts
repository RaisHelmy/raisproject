import type { ApplicationStatus } from "./common";

export type ProgramStatus = "open" | "closed" | "cancelled";

export type TrainingProgram = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  capacity: number | null;
  status: ProgramStatus;
};

export type TrainingEnrollment = {
  id: string;
  program_id: string;
  program_title?: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  status: ApplicationStatus | "completed";
  decided_at: string | null;
  decision_remarks: string | null;
  applied_at: string;
  workflow_instance_id: string | null;
  step_name?: string;
};

export type TrainingEvaluation = {
  id: string;
  enrollment_id: string;
  rating: number;
  feedback: string | null;
};
