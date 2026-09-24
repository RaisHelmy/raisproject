import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { downloadCsv } from "../../lib/csv";
import type { WorkflowInstanceListItem, WorkflowStatus } from "../../types";

const STATUS_CLASS: Record<WorkflowStatus, string> = {
  in_progress: "text-bg-warning",
  approved: "text-bg-success",
  rejected: "text-bg-danger",
  cancelled: "text-bg-secondary",
};

const MODULES = [
  "",
  "leave_application",
  "claim",
  "employee_request",
  "training_enrollment",
  "uniform_order",
  "overtime",
  "leave_quota",
  "leave_encashment",
];

export function RoutingLogs() {
  const [instances, setInstances] = useState<WorkflowInstanceListItem[]>([]);
  const [module, setModule] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (module) params.set("module", module);
    if (status) params.set("status", status);
    api
      .get<{ instances: WorkflowInstanceListItem[] }>(`/workflows/routing-logs?${params.toString()}`)
      .then((res) => setInstances(res.instances));
  }, [module, status]);

  function exportCsv() {
    downloadCsv(
      "routing-logs.csv",
      instances.map((inst) => ({
        submitted: inst.created_at,
        module: inst.module,
        employee: inst.employee_name ?? "",
        employee_no: inst.employee_no ?? "",
        request: inst.record_label ?? "",
        status: inst.status,
        step: inst.status === "in_progress" ? inst.current_step_order : "",
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Routing Logs</h1>
        <div className="d-flex gap-2">
          <select className="form-select" value={module} onChange={(e) => setModule(e.target.value)}>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m === "" ? "All modules" : m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="in_progress">In progress</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={instances.length === 0}>
            <i className="bi bi-download me-1" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Submitted</th>
                <th>Module</th>
                <th>Employee</th>
                <th>Request</th>
                <th>Step</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <tr key={inst.id}>
                  <td className="text-nowrap">{new Date(inst.created_at).toLocaleString()}</td>
                  <td>{inst.module.replace(/_/g, " ")}</td>
                  <td>
                    {inst.employee_name} <span className="text-secondary small">({inst.employee_no})</span>
                  </td>
                  <td>{inst.record_label ?? "—"}</td>
                  <td>{inst.status === "in_progress" ? `Step ${inst.current_step_order}` : "—"}</td>
                  <td>
                    <Link to={`/workflows/${inst.id}`} className={`badge text-decoration-none ${STATUS_CLASS[inst.status]}`}>
                      {inst.status.replace("_", " ")}
                    </Link>
                  </td>
                </tr>
              ))}
              {instances.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-secondary py-4">
                    No routing activity yet.
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
