import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

/** Clickable breadcrumb trail. The last crumb is the current location. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="row" style={{ gap: 6 }}>
            {last || !c.to ? (
              <span className={last ? "current" : undefined} aria-current={last ? "page" : undefined}>
                {c.label}
              </span>
            ) : (
              <Link to={c.to}>{c.label}</Link>
            )}
            {!last && <span className="sep">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
