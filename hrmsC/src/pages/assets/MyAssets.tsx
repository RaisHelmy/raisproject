import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Asset } from "../../types";

export function MyAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    api.get<{ assets: Asset[] }>("/assets/me").then((res) => setAssets(res.assets));
  }, []);

  return (
    <div>
      <h1 className="h3 mb-4">My Assets</h1>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Tag</th>
                <th>Name</th>
                <th>Category</th>
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
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-secondary py-4">
                    No assets assigned to you.
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
