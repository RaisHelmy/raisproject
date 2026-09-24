export type Notification = {
  id: string;
  tenant_id: string;
  user_id: string;
  message: string;
  link: string | null;
  is_read: number;
  created_at: string;
};
