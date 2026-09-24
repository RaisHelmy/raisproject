import { Fragment, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import type { Employee, Payslip } from "../../types";

export function PayslipAdmin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [payPeriod, setPayPeriod] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ employees: Employee[] }>("/employees").then((res) => setEmployees(res.employees));
  }, []);

  function loadPayslips(forEmployeeId: string) {
    if (!forEmployeeId) {
      setPayslips([]);
      return;
    }
    api.get<{ payslips: Payslip[] }>(`/payroll?employeeId=${forEmployeeId}`).then((res) => setPayslips(res.payslips));
  }

  useEffect(() => loadPayslips(employeeId), [employeeId]);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/payroll", {
        employeeId,
        payPeriod,
        grossAmount: Number(grossAmount),
        deductions: Number(deductions),
      });
      setPayPeriod("");
      setGrossAmount("");
      setDeductions("0");
      loadPayslips(employeeId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Payroll — Generate Payslip</h1>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form className="row g-2 align-items-end" onSubmit={handleGenerate}>
            <div className="col-md-4">
              <label className="form-label small">Employee</label>
              <select className="form-select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                <option value="">Select…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_no})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">Pay period</label>
              <input type="month" className="form-control" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Gross</label>
              <input type="number" min={0} step="0.01" className="form-control" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Deductions</label>
              <input type="number" min={0} step="0.01" className="form-control" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting || !employeeId}>
                Generate
              </button>
            </div>
          </form>
        </div>
      </div>

      {employeeId && (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Period</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td>{p.pay_period}</td>
                      <td>{p.gross_amount.toFixed(2)}</td>
                      <td>{p.deductions.toFixed(2)}</td>
                      <td>{p.net_amount.toFixed(2)}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                          <i className="bi bi-paperclip" />
                        </button>
                      </td>
                    </tr>
                    {expandedId === p.id && (
                      <tr>
                        <td colSpan={5} className="bg-light">
                          <AttachmentPanel module="payslip" recordId={p.id} canUpload={true} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      No payslips for this employee yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
