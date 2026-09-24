import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AccountPage() {
  const { user, advancedMode, setAdvancedMode, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <section className="workspace-page" style={{ maxWidth: 760 }}>
      <p className="lp-eyebrow mb-2">Workspace identity</p><h1 className="display-6 fw-bold mb-2">Account</h1><p className="text-secondary mb-4">Manage your identity, security and creative workspace preferences.</p>
      <div className="card mb-3">
        <div className="card-body">
          <h2 className="h6">Signed in</h2>
          <p className="text-secondary small mb-0">User ID: {user?.userId}</p>
        </div>
      </div>
      <div className="card mb-3">
        <div className="card-body d-flex align-items-center justify-content-between">
          <div>
            <h2 className="h6 mb-1">Advanced mode</h2>
            <p className="text-secondary small mb-0">
              Shows Canvas, Assets, Usage and Developer tools in the sidebar.
            </p>
          </div>
          <div className="form-check form-switch">
            <input
              id="advanced-mode"
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={advancedMode}
              onChange={(e) => setAdvancedMode(e.target.checked)}
            />
            <label className="visually-hidden" htmlFor="advanced-mode">Toggle advanced mode</label>
          </div>
        </div>
      </div>
      <button type="button" className="btn btn-outline-danger" onClick={onLogout}>
        <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />Log out
      </button>
    </section>
  );
}
