export type WorkSchedule = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  work_days: string;
  is_active: number;
};

export type WorkScheduleAssignment = {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_no?: string;
  work_schedule_id: string;
  schedule_name?: string;
  name?: string;
  start_time?: string;
  end_time?: string;
  work_days?: string;
  effective_from: string;
  effective_to: string | null;
};

export const DAY_LABELS: Record<string, string> = {
  "1": "Mon",
  "2": "Tue",
  "3": "Wed",
  "4": "Thu",
  "5": "Fri",
  "6": "Sat",
  "7": "Sun",
};

export function formatWorkDays(workDays: string): string {
  return workDays
    .split(",")
    .map((d) => DAY_LABELS[d.trim()] ?? d.trim())
    .join(", ");
}
