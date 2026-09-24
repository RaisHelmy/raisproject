import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HEADER_ITEMS, type MenuItem } from "./menuData";
import { PanelEntry } from "./NavigationMenu";

/**
 * Phone navigation: the primary nav is hidden under 768px, so a hamburger in
 * the header opens a full-height sheet listing every top-level item, with the
 * dropdown tabs expanding to their full section lists.
 */
export function MobileMenu({ items = HEADER_ITEMS }: { items?: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="hfnav-avatar-ring hfnav-mobile-only"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="hfnav-sheet"
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="hfnav-bars" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {open && (
        <div id="hfnav-sheet" className="hfnav-sheet" role="dialog" aria-label="Menu">
          <ul className="hfnav-sheet-list">
            {items.map((item) => {
              if (item.kind === "separator") return <li key={item.id} className="hfnav-sheet-sep" role="separator" />;
              if (item.kind === "link") {
                return (
                  <li key={item.id}>
                    <Link to={item.href} className="hfnav-sheet-link">
                      <span>{item.label}</span>
                      {item.badge && <span className="hfnav-bar-badge">{item.badge}</span>}
                    </Link>
                  </li>
                );
              }
              const isOpen = expanded === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="hfnav-sheet-link"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : item.id)}
                  >
                    <span>{item.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: isOpen ? "rotate(180deg)" : undefined }}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="hfnav-sheet-sections">
                      {item.sections.map((s) => (
                        <div key={s.id} className="hfnav-section">
                          <p className="hfnav-section-heading">{s.heading}</p>
                          {s.items.map((e) => <PanelEntry key={e.id} entry={e} />)}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
