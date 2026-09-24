import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!me) return <Navigate to="/login" replace />;
  if (!me.roles.includes(role)) {
    return (
      <div className="alert alert-warning">
        You don't hold the <strong>{role}</strong> role on this account. Register or switch role
        to access this area.
      </div>
    );
  }
  return <>{children}</>;
}
