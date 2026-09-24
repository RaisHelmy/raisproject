import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { UniformItem } from "../../types";

type Line = { uniformItemId: string; size: string; quantity: number };

export function UniformOrderForm() {
  const navigate = useNavigate();
  const [items, setItems] = useState<UniformItem[]>([]);
  const [lines, setLines] = useState<Line[]>([{ uniformItemId: "", size: "", quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ items: UniformItem[] }>("/uniform/items").then((res) => setItems(res.items));
  }, []);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { uniformItemId: "", size: "", quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/uniform/orders", { lines });
      navigate("/uniform/history");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Uniform Order</h1>
      <div className="card shadow-sm" style={{ maxWidth: 640 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            {lines.map((line, i) => {
              const item = items.find((it) => it.id === line.uniformItemId);
              const sizeOptions = item ? item.available_sizes.split(",") : [];
              return (
                <div className="row g-2 align-items-end mb-2" key={i}>
                  <div className="col-md-5">
                    <label className="form-label small">Item</label>
                    <select
                      className="form-select"
                      value={line.uniformItemId}
                      onChange={(e) => updateLine(i, { uniformItemId: e.target.value, size: "" })}
                      required
                    >
                      <option value="">Select…</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small">Size</label>
                    <select className="form-select" value={line.size} onChange={(e) => updateLine(i, { size: e.target.value })} required>
                      <option value="">—</option>
                      {sizeOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small">Qty</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="form-control"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-md-2">
                    <button type="button" className="btn btn-outline-danger w-100" disabled={lines.length === 1} onClick={() => removeLine(i)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="btn btn-outline-secondary btn-sm mb-4" onClick={addLine}>
              <i className="bi bi-plus-lg me-1" /> Add item
            </button>
            <div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Order"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
