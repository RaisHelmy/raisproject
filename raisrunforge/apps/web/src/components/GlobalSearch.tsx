import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchResult } from "@runforge/shared";
import { api } from "../api/client";
import { StatusBadge } from "./StatusBadge";

const TYPE_ICON: Record<string, string> = {
  project: "bi-folder2", application: "bi-grid-1x2", server: "bi-hdd-rack", container: "bi-box-seam",
  database: "bi-database", domain: "bi-globe2", deployment: "bi-rocket-takeoff", event: "bi-clock-history",
  incident: "bi-exclamation-diamond",
};

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); return; }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const id = setTimeout(() => {
      api.get<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`).then(setResults).catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(id);
  }, [query]);

  if (!open) return null;

  return (
    <>
      <div className="rf-backdrop" onClick={onClose} />
      <div className="rf-modal" style={{ top: "12%" }}>
        <input
          autoFocus
          className="rf-palette-input"
          placeholder="Search projects, applications, servers, containers, databases…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
        <div className="py-2" style={{ maxHeight: 360, overflowY: "auto" }}>
          {query && results.length === 0 && <div className="rf-palette-item">No results</div>}
          {results.map((r) => (
            <div key={`${r.type}:${r.id}`} className="rf-palette-item" onClick={() => { navigate(r.href); onClose(); }}>
              <i className={`bi ${TYPE_ICON[r.type] ?? "bi-box"}`} />
              <div className="flex-grow-1">
                <div>{r.title}</div>
                {r.subtitle && <div className="rf-faint" style={{ fontSize: 11 }}>{r.subtitle}</div>}
              </div>
              {r.status && <StatusBadge status={r.status} />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
