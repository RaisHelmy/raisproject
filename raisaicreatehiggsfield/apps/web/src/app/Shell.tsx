import { NavLink, Outlet } from "react-router-dom";
import { MOBILE_NAV } from "./nav";
import { HfHeader } from "./header/HfHeader";
import { LowBalanceBanner } from "../components/LowBalanceBanner";

/**
 * Signed-in layout: the header bar with its mega menu on top, the page
 * underneath, and the four-item bottom bar on phones (where the primary nav
 * is hidden). Admin and advanced-mode gating still happen on the routes and
 * the server; hiding a link is presentation, never a permission (§109).
 */
export function Shell(props: { advanced: boolean; admin: boolean; balanceSen: number | null }) {
  return (
    <div className="rais-shell">
      <a className="visually-hidden-focusable position-absolute top-0 start-0 m-2 btn btn-sm btn-primary" href="#main">
        Skip to content
      </a>
      <HfHeader balanceSen={props.balanceSen} />
      <main className="rais-main" id="main">
        <LowBalanceBanner availableSen={props.balanceSen} />
        <Outlet />
      </main>
      <nav className="rais-bottom-nav" aria-label="Mobile">
        {MOBILE_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/create"}>
            <i className={`bi bi-${n.icon} d-block fs-5`} aria-hidden="true" />{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
