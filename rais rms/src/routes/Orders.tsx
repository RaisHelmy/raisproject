import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api } from "../lib/api";
import type { OrderStatus, OrderType } from "../../shared/types";

interface OrderRow {
  id: string;
  type: OrderType;
  table_id: string | null;
  status: OrderStatus;
  total_minor: number;
  currency: string;
  created_at: number;
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  open: "placed",
  placed: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  open: "text-bg-secondary",
  placed: "text-bg-primary",
  preparing: "text-bg-warning",
  ready: "text-bg-info",
  completed: "text-bg-success",
  cancelled: "text-bg-danger",
};

export function Orders() {
  const { outletId } = useOutlet();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["orders", outletId],
    queryFn: () => api.get<OrderRow[]>(`/api/outlets/${outletId}/orders`, { activeOnly: "true" }),
    enabled: !!outletId,
    refetchInterval: 10_000,
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: OrderStatus }) =>
      api.patch(`/api/outlets/${outletId}/orders/${input.id}/status`, { status: input.status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["orders", outletId] }),
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  const orders = ordersQuery.data ?? [];
  const columns: OrderStatus[] = ["placed", "preparing", "ready"];

  return (
    <div>
      <h1 className="h3 mb-4">
        Orders <small className="text-muted fw-normal">(kitchen / QR / POS)</small>
      </h1>
      <div className="row g-3">
        {columns.map((status) => (
          <div className="col-md-4" key={status}>
            <div className="card rais-card p-3 h-100">
              <h2 className="h6 text-capitalize">{status}</h2>
              {orders
                .filter((o) => o.status === status)
                .map((o) => (
                  <div key={o.id} className="border rounded p-2 mb-2">
                    <div className="d-flex justify-content-between">
                      <span className={`badge ${STATUS_BADGE[o.status]} text-capitalize`}>{o.type.replace("_", " ")}</span>
                      <strong>
                        {(o.total_minor / 100).toFixed(2)} {o.currency}
                      </strong>
                    </div>
                    <div className="text-muted small">{new Date(o.created_at).toLocaleTimeString()}</div>
                    <div className="d-flex gap-2 mt-2">
                      {STATUS_FLOW[o.status] && (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => statusMutation.mutate({ id: o.id, status: STATUS_FLOW[o.status]! })}
                        >
                          Mark {STATUS_FLOW[o.status]}
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => statusMutation.mutate({ id: o.id, status: "cancelled" })}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              {orders.filter((o) => o.status === status).length === 0 && (
                <p className="text-muted small">Nothing here.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
