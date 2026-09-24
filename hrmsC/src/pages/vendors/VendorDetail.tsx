import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Vendor } from "../../types";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="col-md-6">
      <div className="text-secondary small">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

export function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can("vendors.manage");
  const [vendor, setVendor] = useState<Vendor | null>(null);

  function load() {
    api.get<{ vendor: Vendor }>(`/vendors/${id}`).then((res) => setVendor(res.vendor));
  }
  useEffect(load, [id]);

  async function toggleStatus() {
    if (!vendor) return;
    await api.put(`/vendors/${id}`, { status: vendor.status === "active" ? "inactive" : "active" });
    load();
  }

  if (!vendor) return <div className="text-secondary">Loading…</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="h3 mb-1">{vendor.name}</h1>
          <div className="text-secondary">{vendor.category ?? "Uncategorized"}</div>
        </div>
        {canManage && (
          <button className="btn btn-outline-secondary" onClick={toggleStatus}>
            {vendor.status === "active" ? "Deactivate" : "Activate"}
          </button>
        )}
      </div>
      <div className="card shadow-sm">
        <div className="card-body row g-3">
          <Field label="Contact person" value={vendor.contact_person} />
          <Field label="Phone" value={vendor.phone} />
          <Field label="Email" value={vendor.email} />
          <Field label="Address" value={vendor.address} />
          <Field label="Notes" value={vendor.notes} />
        </div>
      </div>
    </div>
  );
}
