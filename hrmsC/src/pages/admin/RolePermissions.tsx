import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { PermissionDef, PermissionKey } from "../../types";

type Grants = Record<"hr" | "manager" | "employee", Record<string, boolean>>;
const ROLES: Array<"hr" | "manager" | "employee"> = ["hr", "manager", "employee"];

export function RolePermissions() {
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [grants, setGrants] = useState<Grants | null>(null);

  function load() {
    api.get<{ catalog: PermissionDef[]; grants: Grants }>("/admin/permissions").then((res) => {
      setCatalog(res.catalog);
      setGrants(res.grants);
    });
  }
  useEffect(load, []);

  async function toggle(role: "hr" | "manager" | "employee", key: PermissionKey, granted: boolean) {
    setGrants((prev) => (prev ? { ...prev, [role]: { ...prev[role], [key]: granted } } : prev));
    await api.put("/admin/permissions", { role, permissionKey: key, granted });
  }

  async function resetRow(key: PermissionKey) {
    for (const role of ROLES) {
      await api.delete(`/admin/permissions/${role}/${key}`);
    }
    load();
  }

  if (!grants) return <div className="text-secondary">Loading…</div>;

  const modules = Array.from(new Set(catalog.map((p) => p.module)));

  return (
    <div>
      <h1 className="h3 mb-2">Role Permissions</h1>
      <p className="text-secondary">
        Admin always has full access and isn't shown here. Toggle what HR, Manager, and Employee can each do —
        changes apply immediately, tenant-wide. Unchanged rows use the sensible defaults every new workspace starts
        with.
      </p>

      {modules.map((moduleName) => (
        <div key={moduleName} className="card shadow-sm mb-3">
          <div className="card-header bg-white fw-semibold">{moduleName}</div>
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Permission</th>
                  <th className="text-center" style={{ width: 90 }}>
                    HR
                  </th>
                  <th className="text-center" style={{ width: 90 }}>
                    Manager
                  </th>
                  <th className="text-center" style={{ width: 90 }}>
                    Employee
                  </th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {catalog
                  .filter((p) => p.module === moduleName)
                  .map((p) => (
                    <tr key={p.key}>
                      <td>{p.label}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={!!grants[role][p.key]}
                            onChange={(e) => toggle(role, p.key, e.target.checked)}
                          />
                        </td>
                      ))}
                      <td>
                        <button className="btn btn-sm btn-link text-secondary" onClick={() => resetRow(p.key)}>
                          Reset
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
