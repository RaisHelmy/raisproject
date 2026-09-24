import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Product {
  id: string;
  name: string;
  priceMinor: number;
  active: boolean;
}

export default function VendorCatalogue() {
  const [vendorId, setVendorId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [priceRinggit, setPriceRinggit] = useState("5.00");
  const [error, setError] = useState<string | null>(null);

  async function load(id: string) {
    try {
      setProducts(await api.get<Product[]>(`/products/for-vendor/${id}`));
    } catch (err) {
      console.error(err);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vendorId) {
      setError("Enter your vendor id first (see Profile tab)");
      return;
    }
    try {
      await api.post("/products", {
        vendorId,
        name,
        priceMinor: Math.round(parseFloat(priceRinggit) * 100),
      });
      setName("");
      await load(vendorId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add product");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h4>Menu / catalogue</h4>
        <div className="mb-3">
          <label className="form-label">Vendor id</label>
          <div className="input-group">
            <input className="form-control" value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
            <button className="btn btn-outline-secondary" onClick={() => load(vendorId)}>
              Load
            </button>
          </div>
        </div>
        <form onSubmit={onCreate} className="card card-body">
          <div className="mb-2">
            <label className="form-label">Item name</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="mb-2">
            <label className="form-label">Price (RM)</label>
            <input
              className="form-control"
              type="number"
              step="0.01"
              value={priceRinggit}
              onChange={(e) => setPriceRinggit(e.target.value)}
            />
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-primary">Add item</button>
        </form>
      </div>
      <div className="col-md-6">
        <h4>Items</h4>
        <ul className="list-group">
          {products.map((p) => (
            <li key={p.id} className="list-group-item d-flex justify-content-between">
              {p.name} <span>RM {(p.priceMinor / 100).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
