export type Attachment = {
  id: string;
  tenant_id: string;
  module: string;
  record_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  uploaded_by_user_id: string | null;
  created_at: string;
};
