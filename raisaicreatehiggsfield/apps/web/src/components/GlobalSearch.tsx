import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Hit {
  kind: string;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

const ICONS: Record<string, string> = {
  project: "folder2",
  generation: "stars",
  asset: "image",
  template: "grid-1x2",
  canvas: "diagram-3",
  movie: "camera-reels",
  character: "person",
  scene: "film",
};

/**
 * One box that finds anything (§103). Opens with the slash key, which is where
 * a keyboard-first user reaches for search, and closes with escape.
 */
/** `icon` renders the closed state as a 36px header icon button instead of the sidebar block. */
export function GlobalSearch({ variant = "block" }: { variant?: "block" | "icon" } = {}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => input.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ items: Hit[] }>(`/search?q=${encodeURIComponent(query)}`)
        .then((r) => {
          setHits(r.items);
          setActive(0);
        })
        .catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query]);

  function go(hit: Hit) {
    setOpen(false);
    setQuery("");
    navigate(hit.href);
  }

  if (!open && variant === "icon") {
    return (
      <button
        type="button"
        className="hfnav-icon-trigger hfnav-desktop-only"
        aria-label="Search (press /)"
        title="Search"
        onClick={() => {
          setOpen(true);
          setTimeout(() => input.current?.focus(), 0);
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm10.5 3-4.75-4.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary w-100 text-start text-secondary"
        onClick={() => {
          setOpen(true);
          setTimeout(() => input.current?.focus(), 0);
        }}
      >
        <i className="bi bi-search me-2" aria-hidden="true" />
        Search
        <kbd className="float-end small">/</kbd>
      </button>
    );
  }

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-label="Search" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-body p-2">
            <label className="visually-hidden" htmlFor="global-search">Search everything</label>
            <input
              id="global-search"
              ref={input}
              type="search"
              className="form-control mb-2"
              placeholder="Search projects, movies, canvases, templates, results…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, hits.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                }
                if (e.key === "Enter" && hits[active]) go(hits[active]!);
              }}
            />

            {query.trim().length >= 2 && hits.length === 0 && (
              <p className="small text-secondary px-2 mb-1">Nothing matches that yet.</p>
            )}

            <ul className="list-group list-group-flush" style={{ maxHeight: 320, overflowY: "auto" }}>
              {hits.map((hit, index) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    className={`list-group-item list-group-item-action d-flex gap-2 ${index === active ? "active" : ""}`}
                    onClick={() => go(hit)}
                    onMouseEnter={() => setActive(index)}
                  >
                    <i className={`bi bi-${ICONS[hit.kind] ?? "dot"}`} aria-hidden="true" />
                    <span className="flex-grow-1 text-truncate">
                      {hit.title}
                      {hit.subtitle && <span className="small d-block text-truncate opacity-75">{hit.subtitle}</span>}
                    </span>
                    <span className="small opacity-75">{hit.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
