import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { AttachmentPanel } from "../../components/AttachmentPanel";
import type { Payslip } from "../../types";

export function MyPayslips() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ payslips: Payslip[] }>("/payroll/me").then((res) => setPayslips(res.payslips));
  }, []);

  return (
    <div>
      <h1 className="h3 mb-4">My Payslips</h1>
      <div className="row g-3">
        {payslips.map((p) => (
          <div key={p.id} className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h2 className="h6">{p.pay_period}</h2>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary small">Gross</span>
                  <span>
                    {p.currency} {p.gross_amount.toFixed(2)}
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary small">Deductions</span>
                  <span>
                    {p.currency} {p.deductions.toFixed(2)}
                  </span>
                </div>
                <hr />
                <div className="d-flex justify-content-between fw-bold">
                  <span>Net</span>
                  <span>
                    {p.currency} {p.net_amount.toFixed(2)}
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary mt-3 w-100"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <i className="bi bi-paperclip me-1" /> Documents
                </button>
                {expandedId === p.id && (
                  <div className="mt-2">
                    <AttachmentPanel module="payslip" recordId={p.id} canUpload={false} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {payslips.length === 0 && <div className="text-secondary">No payslips yet.</div>}
      </div>
    </div>
  );
}
