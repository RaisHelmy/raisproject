import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Command { label: string; icon: string; run: (nav: ReturnType<typeof useNavigate>) => void; }

const COMMANDS: Command[] = [
  { label: "Create project", icon: "bi-folder-plus", run: (nav) => nav("/projects?new=1") },
  { label: "Create application", icon: "bi-plus-square", run: (nav) => nav("/applications?new=1") },
  { label: "Connect server", icon: "bi-hdd-rack", run: (nav) => nav("/servers?connect=1") },
  { label: "Create database", icon: "bi-database-add", run: (nav) => nav("/databases?new=1") },
  { label: "Create domain", icon: "bi-globe2", run: (nav) => nav("/domains?new=1") },
  { label: "Open production logs", icon: "bi-terminal", run: (nav) => nav("/logs?environment=production") },
  { label: "Rollback deployment", icon: "bi-arrow-counterclockwise", run: (nav) => nav("/deployments") },
  { label: "Open MCP", icon: "bi-cpu", run: (nav) => nav("/mcp") },
  { label: "View infrastructure graph", icon: "bi-share", run: (nav) => nav("/graph") },
  { label: "Open incidents", icon: "bi-exclamation-diamond", run: (nav) => nav("/incidents") },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const filtered = useMemo(
    () => COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(0); }
  }, [open]);

  if (!open) return null;

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) { filtered[selected].run(navigate); onClose(); }
    if (e.key === "Escape") onClose();
  }

  return (
    <>
      <div className="rf-backdrop" onClick={onClose} />
      <div className="rf-modal" style={{ top: "16%" }}>
        <input
          autoFocus
          className="rf-palette-input"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
          onKeyDown={handleKey}
        />
        <div className="py-2">
          {filtered.length === 0 && <div className="rf-palette-item">No matching commands</div>}
          {filtered.map((c, i) => (
            <div
              key={c.label}
              className={`rf-palette-item ${i === selected ? "selected" : ""}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => { c.run(navigate); onClose(); }}
            >
              <i className={`bi ${c.icon}`} />
              {c.label}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
