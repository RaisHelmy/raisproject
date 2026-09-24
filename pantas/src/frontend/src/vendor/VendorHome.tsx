import { NavLink, Outlet } from "react-router-dom";

export default function VendorHome() {
  return (
    <div>
      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <NavLink className="nav-link" to="/vendor" end>
            Profile
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/vendor/catalogue">
            Catalogue
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/vendor/contracts">
            Corporate contracts
          </NavLink>
        </li>
        <li className="nav-item">
          <NavLink className="nav-link" to="/vendor/list-vehicle">
            List a vehicle for rent
          </NavLink>
        </li>
      </ul>
      <Outlet />
    </div>
  );
}
