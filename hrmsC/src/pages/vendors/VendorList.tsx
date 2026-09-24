import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Vendor } from "../../types";

export function VendorList() {
  const { can } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState("");
  const canManage = can("vendors.manage");

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    api.get<{ vendors: Vendor[] }>(`/vendors?${params.toString()}`).then((res) => setVendors(res.vendors));
  }, [q]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Vendors</h1>
        {canManage && (
          <Link to="/vendors/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-1" /> Add Vendor
          </Link>
        )}
      </div>
      <input
        className="form-control mb-3"
        style={{ maxWidth: 360 }}
        placeholder="Search by name or category…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link to={`/vendors/${v.id}`}>{v.name}</Link>
                  </td>
                  <td>{v.category ?? "—"}</td>
                  <td>{v.contact_person ?? v.phone ?? "—"}</td>
                  <td>
                    <span className={`badge ${v.status === "active" ? "text-bg-success" : "text-bg-secondary"}`}>{v.status}</span>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No vendors found.
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
