import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AccessDenied } from "../pages/AccessDenied";
import type { PermissionKey, Role } from "../types";

export function ProtectedRoute({
  roles,
  permission,
  children,
}: {
  /** Fixed role gate — reserve for admin-only pages (Users, Audit Log) that
   * stay admin-only no matter what a tenant configures. */
  roles?: Role[];
  /** Tenant-configurable gate — use this for anything covered by
   * worker/core/permissions.ts instead of hardcoding roles, so a page's
   * access follows the same customization the API already enforces. */
  permission?: PermissionKey;
  children: ReactNode;
}) {
  const { auth, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  if (!auth) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(auth.role)) return <AccessDenied />;
  if (permission && !can(permission)) return <AccessDenied />;

  return <>{children}</>;
}
