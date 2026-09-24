export type Timesheet = {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours: number | null;
  remarks: string | null;
};
