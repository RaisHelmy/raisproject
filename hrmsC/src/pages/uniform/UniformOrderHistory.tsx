import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { StatusBadge } from "../../components/StatusBadge";
import type { UniformOrder } from "../../types";

export function UniformOrderHistory() {
  const [orders, setOrders] = useState<UniformOrder[]>([]);

  function load() {
    api.get<{ orders: UniformOrder[] }>("/uniform/orders/me").then((res) => setOrders(res.orders));
  }
  useEffect(load, []);

  async function cancel(id: string) {
    if (!confirm("Cancel this order?")) return;
    await api.post(`/uniform/orders/${id}/cancel`);
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">My Uniform Orders</h1>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Items</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.lines.map((l) => `${l.item_name} (${l.size} x${l.quantity})`).join(", ")}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="d-flex gap-2">
                    {o.workflow_instance_id && (
                      <Link className="btn btn-sm btn-outline-secondary" to={`/workflows/${o.workflow_instance_id}`}>
                        Routing
                      </Link>
                    )}
                    {o.status === "pending" && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => cancel(o.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-secondary py-4">
                    No orders yet.
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
