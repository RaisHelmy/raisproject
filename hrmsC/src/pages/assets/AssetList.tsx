import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { downloadCsv } from "../../lib/csv";
import type { Asset } from "../../types";

const STATUS_CLASS: Record<string, string> = {
  available: "text-bg-success",
  assigned: "text-bg-primary",
  maintenance: "text-bg-warning",
  retired: "text-bg-secondary",
};

export function AssetList() {
  const { can } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [q, setQ] = useState("");
  const canManage = can("assets.manage");

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    api.get<{ assets: Asset[] }>(`/assets?${params.toString()}`).then((res) => setAssets(res.assets));
  }, [q]);

  function exportCsv() {
    downloadCsv(
      "assets.csv",
      assets.map((a) => ({
        tag: a.asset_tag,
        name: a.name,
        category: a.category ?? "",
        serial_number: a.serial_number ?? "",
        status: a.status,
      })),
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Asset Registry</h1>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={exportCsv} disabled={assets.length === 0}>
            <i className="bi bi-download me-1" /> Export CSV
          </button>
          {canManage && (
            <Link to="/assets/new" className="btn btn-primary">
              <i className="bi bi-plus-lg me-1" /> Add Asset
            </Link>
          )}
        </div>
      </div>
      <input
        className="form-control mb-3"
        style={{ maxWidth: 360 }}
        placeholder="Search by name, tag, or serial number…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Tag</th>
                <th>Name</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td>{a.asset_tag}</td>
                  <td>
                    <Link to={`/assets/${a.id}`}>{a.name}</Link>
                  </td>
                  <td>{a.category ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_CLASS[a.status]}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No assets found.
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
