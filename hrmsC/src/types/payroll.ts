export type Payslip = {
  id: string;
  employee_id: string;
  pay_period: string;
  gross_amount: number;
  deductions: number;
  net_amount: number;
  currency: string;
  notes: string | null;
  generated_at: string;
};
