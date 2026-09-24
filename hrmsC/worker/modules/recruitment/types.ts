export type PostingStatus = "open" | "closed";
export type ApplicationStage = "submitted" | "screening" | "interview" | "offered" | "rejected" | "hired" | "withdrawn";

export type JobPosting = {
  id: string;
  tenant_id: string;
  title: string;
  department: string | null;
  description: string | null;
  status: PostingStatus;
  closing_date: string | null;
  created_at: string;
};

export type JobApplication = {
  id: string;
  tenant_id: string;
  posting_id: string;
  employee_id: string;
  cover_note: string | null;
  status: ApplicationStage;
  applied_at: string;
  updated_at: string;
};
