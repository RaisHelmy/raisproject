import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">Pantas</Link>
          <div className="d-flex gap-3">
            {me && (
              <>
                <Link className="nav-link text-white-50" to="/client">Client</Link>
                <Link className="nav-link text-white-50" to="/runner">Runner</Link>
                <Link className="nav-link text-white-50" to="/vendor">Vendor</Link>
                {me.activeRole === "admin" && (
                  <Link className="nav-link text-white-50" to="/admin">Admin</Link>
                )}
              </>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            {me ? (
              <>
                <span className="text-white-50 small">
                  {me.activeRole} · {me.userId.slice(0, 8)}
                </span>
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={async () => {
                    await logout();
                    navigate("/");
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link className="btn btn-outline-light btn-sm" to="/login">
                Log in
              </Link>
            )}
          </div>
        </div>
      </nav>
      <div className="container py-4">
        <Outlet />
      </div>
    </div>
  );
}
