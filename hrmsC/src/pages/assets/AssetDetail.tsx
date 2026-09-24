import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { EmployeePicker } from "../../components/EmployeePicker";
import type { Asset, AssetAssignmentLog, Employee } from "../../types";

export function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can("assets.manage");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [logs, setLogs] = useState<AssetAssignmentLog[]>([]);
  const [assignedEmployee, setAssignedEmployee] = useState<Employee | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ asset: Asset }>(`/assets/${id}`).then((res) => {
      setAsset(res.asset);
      if (res.asset.assigned_employee_id) {
        api.get<{ employee: Employee }>(`/employees/${res.asset.assigned_employee_id}`).then((r) => setAssignedEmployee(r.employee));
      } else {
        setAssignedEmployee(null);
      }
    });
    api.get<{ logs: AssetAssignmentLog[] }>(`/assets/${id}/logs`).then((res) => setLogs(res.logs));
  }

  useEffect(load, [id]);

  async function assign() {
    setError(null);
    try {
      await api.post(`/assets/${id}/assign`, { employeeId: assignTo });
      setAssignTo("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function returnAsset() {
    setError(null);
    try {
      await api.post(`/assets/${id}/return`, {});
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function setStatus(status: "maintenance" | "retired" | "available") {
    setError(null);
    try {
      await api.patch(`/assets/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (!asset) return <div className="text-secondary">Loading…</div>;

  return (
    <div>
      <h1 className="h3 mb-1">{asset.name}</h1>
      <div className="text-secondary mb-4">
        {asset.asset_tag} · {asset.category ?? "Uncategorized"}
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <div className="text-secondary small">Status</div>
              <div className="text-capitalize">{asset.status}</div>
            </div>
            <div className="col-md-4">
              <div className="text-secondary small">Serial number</div>
              <div>{asset.serial_number ?? "—"}</div>
            </div>
            <div className="col-md-4">
              <div className="text-secondary small">Assigned to</div>
              <div>{assignedEmployee ? `${assignedEmployee.full_name} (${assignedEmployee.employee_no})` : "—"}</div>
            </div>
          </div>

          {canManage && (
            <div className="mt-4 d-flex gap-2 align-items-end flex-wrap">
              {asset.status === "available" && (
                <>
                  <div style={{ minWidth: 260 }}>
                    <label className="form-label small">Assign to</label>
                    <EmployeePicker value={assignTo} onChange={setAssignTo} placeholder="Search employee…" />
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={!assignTo} onClick={assign}>
                    Assign
                  </button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setStatus("maintenance")}>
                    Send to Maintenance
                  </button>
                  <button className="btn btn-outline-danger btn-sm" onClick={() => setStatus("retired")}>
                    Retire
                  </button>
                </>
              )}
              {asset.status === "assigned" && (
                <button className="btn btn-outline-secondary btn-sm" onClick={returnAsset}>
                  Mark Returned
                </button>
              )}
              {asset.status === "maintenance" && (
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setStatus("available")}>
                  Return to Service
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <h2 className="h6 text-secondary mb-3">History</h2>
      <div className="card shadow-sm">
        <ul className="list-group list-group-flush">
          {logs.map((l) => (
            <li key={l.id} className="list-group-item d-flex justify-content-between">
              <span className="text-capitalize">{l.action}</span>
              <span className="text-secondary small">{new Date(l.created_at).toLocaleString()}</span>
            </li>
          ))}
          {logs.length === 0 && <li className="list-group-item text-secondary small">No history yet.</li>}
        </ul>
      </div>
    </div>
  );
}
