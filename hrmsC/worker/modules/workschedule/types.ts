export type WorkSchedule = {
  id: string;
  tenant_id: string;
  name: string;
  start_time: string;
  end_time: string;
  work_days: string;
  is_active: number;
  created_at: string;
};

export type WorkScheduleAssignment = {
  id: string;
  tenant_id: string;
  employee_id: string;
  work_schedule_id: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};
