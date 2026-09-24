import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { NotificationBell } from "./NotificationBell";

export function Topbar() {
  const { auth, tenant, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="d-flex justify-content-between align-items-center border-bottom bg-white px-4 py-2">
      <div className="fw-semibold text-secondary">{tenant?.name}</div>
      <div className="d-flex align-items-center gap-3">
        <NotificationBell />
        <div className="text-end">
          <div className="fw-semibold">{auth?.name}</div>
          <div className="text-secondary small text-capitalize">{auth?.role}</div>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
