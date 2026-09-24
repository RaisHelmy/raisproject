import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function SimulationBanner() {
  const { auth, refresh } = useAuth();
  const navigate = useNavigate();

  if (!auth?.simulatedByUserId) return null;

  async function returnToAdmin() {
    await api.post("/simulate/stop");
    await refresh();
    navigate("/", { replace: true });
  }

  return (
    <div className="bg-warning text-dark text-center py-1 small d-flex justify-content-center align-items-center gap-2">
      <i className="bi bi-person-badge" />
      <span>
        Viewing as <strong>{auth.name}</strong> — simulated by {auth.simulatedByName}
      </span>
      <button className="btn btn-dark btn-sm py-0" onClick={returnToAdmin}>
        Return to admin
      </button>
    </div>
  );
}
