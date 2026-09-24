import { useState } from "react";
import { getDemoRole, setDemoRole } from "../api/client";

export function Topbar({ onOpenSearch, onOpenPalette }: { onOpenSearch: () => void; onOpenPalette: () => void }) {
  const [role, setRole] = useState(getDemoRole() ?? "owner");

  return (
    <header className="rf-topbar">
      <div className="rf-search-trigger" onClick={onOpenSearch}>
        <i className="bi bi-search" />
        <span>Search projects, applications, servers…</span>
        <span className="rf-kbd ms-auto">⌘K</span>
      </div>
      <button className="btn-rf" onClick={onOpenPalette} title="Command palette">
        <i className="bi bi-lightning-charge" /> Commands
      </button>
      <div className="ms-auto d-flex align-items-center gap-2">
        <select
          className="form-select form-select-sm"
          style={{ width: 150 }}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setDemoRole(e.target.value === "owner" ? null : e.target.value);
            window.location.reload();
          }}
          title="Simulate role (demo)"
        >
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
          <option value="operator">Operator</option>
          <option value="viewer">Viewer</option>
        </select>
        <div className="d-flex align-items-center gap-2 ps-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 28, height: 28, background: "var(--rf-accent-soft)", color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}
          >
            DO
          </div>
        </div>
      </div>
    </header>
  );
}
