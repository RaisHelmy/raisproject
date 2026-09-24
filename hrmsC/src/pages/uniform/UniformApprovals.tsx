import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import type { UniformOrder } from "../../types";

export function UniformApprovals() {
  const [orders, setOrders] = useState<UniformOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ orders: UniformOrder[] }>("/uniform/orders/approvals").then((res) => setOrders(res.orders));
  }
  useEffect(load, []);

  async function decide(id: string, action: "approve" | "reject") {
    const remarks = action === "reject" ? prompt("Remarks (optional):") ?? "" : "";
    setError(null);
    try {
      await api.post(`/uniform/orders/${id}/decide`, { action, remarks: remarks || null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Uniform Order Approvals</h1>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Employee</th>
                <th>Items</th>
                <th>Step</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.employee_name} <span className="text-secondary small">({o.employee_no})</span>
                  </td>
                  <td>{o.lines.map((l) => `${l.item_name} (${l.size} x${l.quantity})`).join(", ")}</td>
                  <td className="text-secondary small">{o.step_name ?? "—"}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-success" onClick={() => decide(o.id, "approve")}>
                        Approve
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => decide(o.id, "reject")}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    Nothing pending approval.
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
