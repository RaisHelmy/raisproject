import { NavLink, Outlet } from "react-router-dom";

export default function AdminHome() {
  return (
    <div>
      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <NavLink className="nav-link" to="/admin" end>
            Users
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/admin/rules">
            Perk &amp; commission rules
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/admin/payouts">
            Payouts
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/admin/sos">
            SOS incidents
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/admin/audit-log">
            Audit log
          </NavLink>
        </li>
      </ul>
      <Outlet />
    </div>
  );
}
