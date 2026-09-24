import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { CreateCredential } from "./pages/CreateCredential";
import { CredentialPage } from "./pages/Credential";
import { ModelsPage } from "./pages/Models";
import { SettingsPage } from "./pages/Settings";

export function App() {
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api("/auth/me").then(() => setAuth("in")).catch(() => setAuth("out"));
  }, [location.pathname]);

  if (auth === "loading") return <div className="container py-5 text-secondary">Loading…</div>;
  if (auth === "out") {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={() => { setAuth("in"); navigate("/"); }} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const logout = async () => { await api("/auth/logout", { method: "POST" }); setAuth("out"); navigate("/login"); };

  return (
    <>
      <nav className="navbar navbar-expand-lg border-bottom border-secondary-subtle mb-4">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/"><span className="dot" />AI Gateway <span className="text-secondary fw-normal small ms-1">ai.raishelmy.uk</span></Link>
          <div className="navbar-nav me-auto">
            <NavLink className="nav-link" to="/" end>Dashboard</NavLink>
            <NavLink className="nav-link" to="/models">Models</NavLink>
            <NavLink className="nav-link" to="/settings">Settings</NavLink>
          </div>
          <div className="d-flex gap-2">
            <Link className="btn btn-primary btn-sm" to="/credentials/new">+ Create credential</Link>
            <button className="btn btn-outline-secondary btn-sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </nav>
      <div className="container pb-5">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/credentials/new" element={<CreateCredential />} />
          <Route path="/credentials/:id" element={<CredentialPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<div className="text-secondary">Not found. <Link to="/">Back to dashboard</Link></div>} />
        </Routes>
      </div>
    </>
  );
}
