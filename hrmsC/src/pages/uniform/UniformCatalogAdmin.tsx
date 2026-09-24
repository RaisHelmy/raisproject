import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api/client";
import type { UniformItem } from "../../types";

export function UniformCatalogAdmin() {
  const [items, setItems] = useState<UniformItem[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [sizes, setSizes] = useState("S,M,L,XL");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ items: UniformItem[] }>("/uniform/items").then((res) => setItems(res.items));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/uniform/items", {
        name,
        category: category || null,
        availableSizes: sizes.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setName("");
      setCategory("");
      setSizes("S,M,L,XL");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(item: UniformItem) {
    await api.put(`/uniform/items/${item.id}`, { isActive: !item.is_active });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Uniform Catalog</h1>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={handleCreate}>
            <div className="col-md-4">
              <label className="form-label small">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Category</label>
              <input className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Sizes (comma-separated)</label>
              <input className="form-control" value={sizes} onChange={(e) => setSizes(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                Add
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Sizes</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{i.category ?? "—"}</td>
                  <td>{i.available_sizes}</td>
                  <td>
                    <span className={`badge ${i.is_active ? "text-bg-success" : "text-bg-secondary"}`}>{i.is_active ? "active" : "inactive"}</span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(i)}>
                      {i.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
