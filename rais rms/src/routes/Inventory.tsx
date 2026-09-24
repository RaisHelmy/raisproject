import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";

interface InventoryItemRow {
  id: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  par_level: number;
}

export function Inventory() {
  const { outletId } = useOutlet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", unit: "unit", qtyOnHand: 0, parLevel: 0 });
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  const itemsQuery = useQuery({
    queryKey: ["inventory", outletId],
    queryFn: () => api.get<InventoryItemRow[]>(`/api/outlets/${outletId}/inventory`),
    enabled: !!outletId,
  });

  const createItem = useMutation({
    mutationFn: () => api.post(`/api/outlets/${outletId}/inventory`, form),
    onSuccess: () => {
      setForm((f) => ({ ...f, name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["inventory", outletId] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const adjustItem = useMutation({
    mutationFn: (input: { itemId: string; delta: number }) =>
      api.post(`/api/outlets/${outletId}/inventory/${input.itemId}/adjust`, {
        delta: input.delta,
        reason: "manual adjustment",
      }),
    onSuccess: (_d, vars) => {
      setAdjustments((a) => ({ ...a, [vars.itemId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["inventory", outletId] });
    },
  });

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.name.trim()) createItem.mutate();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Inventory</h1>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">New item</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <form onSubmit={onSubmit}>
              <div className="mb-2">
                <label className="form-label small">Name</label>
                <input
                  className="form-control form-control-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="row g-2 mb-2">
                <div className="col">
                  <label className="form-label small">Unit</label>
                  <input
                    className="form-control form-control-sm"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </div>
                <div className="col">
                  <label className="form-label small">Qty on hand</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={form.qtyOnHand}
                    onChange={(e) => setForm((f) => ({ ...f, qtyOnHand: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small">Par level (low-stock threshold)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={form.parLevel}
                  onChange={(e) => setForm((f) => ({ ...f, parLevel: Number(e.target.value) }))}
                />
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit">
                Add item
              </button>
            </form>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">Stock</h2>
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On hand</th>
                  <th>Par</th>
                  <th>Adjust</th>
                </tr>
              </thead>
              <tbody>
                {(itemsQuery.data ?? []).map((item) => {
                  const low = item.qty_on_hand <= item.par_level;
                  return (
                    <tr key={item.id} className={low ? "table-warning" : undefined}>
                      <td>{item.name}</td>
                      <td>
                        {item.qty_on_hand} {item.unit}
                        {low && <span className="badge text-bg-warning text-dark ms-2">low</span>}
                      </td>
                      <td>{item.par_level}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            style={{ width: 80 }}
                            placeholder="±qty"
                            value={adjustments[item.id] ?? ""}
                            onChange={(e) => setAdjustments((a) => ({ ...a, [item.id]: e.target.value }))}
                          />
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              const delta = Number(adjustments[item.id]);
                              if (delta) adjustItem.mutate({ itemId: item.id, delta });
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {itemsQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-muted text-center py-3">
                      No inventory items yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
