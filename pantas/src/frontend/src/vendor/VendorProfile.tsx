import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

interface Vendor {
  id: string;
  businessName: string;
  status: string;
}

export default function VendorProfile() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setVendors(await api.get<Vendor[]>("/vendors"));
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/vendors", { businessName });
      setBusinessName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create vendor profile");
    }
  }

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <h4>Register your business</h4>
        <form onSubmit={onCreate} className="card card-body">
          <div className="mb-2">
            <label className="form-label">Business name</label>
            <input
              className="form-control"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </div>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button className="btn btn-primary">Create</button>
        </form>
      </div>
      <div className="col-md-6">
        <h4>Your vendor profiles</h4>
        <ul className="list-group">
          {vendors.map((v) => (
            <li key={v.id} className="list-group-item">
              {v.businessName} — <span className="badge text-bg-secondary">{v.status}</span>
              <div className="text-muted small">id: {v.id}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
