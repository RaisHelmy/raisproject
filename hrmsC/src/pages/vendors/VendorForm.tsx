import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Vendor } from "../../types";

export function VendorForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ vendor: Vendor }>("/vendors", {
        name,
        category: category || null,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
      });
      navigate(`/vendors/${res.vendor.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="h3 mb-4">Add Vendor</h1>
      <div className="card shadow-sm" style={{ maxWidth: 560 }}>
        <div className="card-body p-4">
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Category</label>
                <input className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Contact person</label>
                <input className="form-control" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Phone</label>
                <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Address</label>
                <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={submitting}>
              {submitting ? "Saving…" : "Create Vendor"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
