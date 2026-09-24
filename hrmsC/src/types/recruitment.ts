export type PostingStatus = "open" | "closed";
export type ApplicationStage = "submitted" | "screening" | "interview" | "offered" | "rejected" | "hired" | "withdrawn";

export type JobPosting = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  status: PostingStatus;
  closing_date: string | null;
};

export type JobApplication = {
  id: string;
  posting_id: string;
  posting_title?: string;
  department?: string | null;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  cover_note: string | null;
  status: ApplicationStage;
  applied_at: string;
  updated_at: string;
};
