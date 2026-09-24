import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { downloadCsv } from "../../lib/csv";
import type { AuditLogEntry } from "../../types";

const MODULES = [
  "",
  "tenant",
  "employee",
  "user",
  "leave_application",
  "claim",
  "timesheet",
  "employee_request",
  "asset",
  "vendor",
  "training_enrollment",
  "payslip",
  "job_application",
  "uniform_order",
  "equity_grant",
  "overtime",
  "work_schedule",
  "work_schedule_assignment",
  "leave_quota",
  "leave_encashment",
];

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [module, setModule] = useState("");

  useEffect(() => {
    const qs = module ? `?module=${module}` : "";
    api.get<{ auditLogs: AuditLogEntry[] }>(`/admin/audit-logs${qs}`).then((res) => setLogs(res.auditLogs));
  }, [module]);

  function exportCsv() {
    downloadCsv(
      "audit-log.csv",
      logs.map((log) => ({
        when: log.created_at,
        module: log.module,
        action: log.action,
        actor: log.actor_name ?? "system",
        remarks: log.remarks ?? "",
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Audit Log</h1>
        <div className="d-flex gap-2">
          <select className="form-select" style={{ width: 220 }} value={module} onChange={(e) => setModule(e.target.value)}>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m === "" ? "All modules" : m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={logs.length === 0}>
            <i className="bi bi-download me-1" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>When</th>
                <th>Module</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.module.replace(/_/g, " ")}</td>
                  <td>{log.action}</td>
                  <td>{log.actor_name ?? "system"}</td>
                  <td>{log.remarks ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No audit entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
