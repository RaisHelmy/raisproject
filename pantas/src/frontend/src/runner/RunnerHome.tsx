import { NavLink, Outlet } from "react-router-dom";

export default function RunnerHome() {
  return (
    <div>
      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <NavLink className="nav-link" to="/runner" end>
            Job feed
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/runner/vehicles">
            Vehicles
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/runner/payouts">
            Payouts
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/runner/rentals">
            Rent a vehicle
          </NavLink>
        </li>
      </ul>
      <Outlet />
    </div>
  );
}
