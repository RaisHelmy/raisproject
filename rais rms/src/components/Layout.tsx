import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOutlet } from "../lib/outlet";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/reservations", label: "Reservations" },
  { to: "/floor", label: "Floor Plan" },
  { to: "/waitlist", label: "Waitlist" },
  { to: "/guests", label: "Guests" },
  { to: "/menu", label: "Menu" },
  { to: "/orders", label: "Orders" },
  { to: "/events", label: "Events" },
  { to: "/inventory", label: "Inventory" },
  { to: "/schedule", label: "Staff Schedule" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/feedback", label: "Feedback" },
  { to: "/staff", label: "Staff & Roles" },
];

export function Layout() {
  const { session, logout } = useAuth();
  const { outlets, outletId, setOutletId } = useOutlet();

  return (
    <div className="d-flex">
      <nav className="rais-sidebar p-3" style={{ width: 240 }}>
        <div className="fs-4 fw-bold text-white mb-4">Rais RMS</div>
        <ul className="nav nav-pills flex-column gap-1">
          {navItems.map((item) => (
            <li className="nav-item" key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-grow-1">
        <header className="border-bottom bg-white px-4 py-2 d-flex justify-content-between align-items-center">
          <div>
            {outlets.length > 0 && (
              <select
                className="form-select form-select-sm"
                value={outletId ?? ""}
                onChange={(e) => setOutletId(e.target.value)}
                style={{ width: 220 }}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small">{session?.email}</span>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </header>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
