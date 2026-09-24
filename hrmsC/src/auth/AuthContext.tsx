import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type { AuthUser, PermissionGrants, PermissionKey, Tenant } from "../types";

type RegisterInput = {
  tenantName: string;
  adminName: string;
  email: string;
  password: string;
};

type AuthState = {
  auth: AuthUser | null;
  tenant: Tenant | null;
  loading: boolean;
  /** Resolved permission grants for the current session's role — see
   * worker/core/permissions.ts. `admin` always returns true regardless of
   * this map (checked separately), matching the backend's fixed-superuser
   * rule. */
  can: (key: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<void>;
  registerTenant: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [permissions, setPermissions] = useState<PermissionGrants | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ auth: AuthUser; tenant: Tenant; permissions: PermissionGrants }>("/auth/me");
      setAuth(res.auth);
      setTenant(res.tenant);
      setPermissions(res.permissions);
    } catch {
      setAuth(null);
      setTenant(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post("/auth/login", { email, password });
      await refresh();
    },
    [refresh],
  );

  const registerTenant = useCallback(
    async (data: RegisterInput) => {
      await api.post("/auth/register-tenant", data);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setAuth(null);
    setTenant(null);
    setPermissions(null);
  }, []);

  const can = useCallback(
    (key: PermissionKey) => auth?.role === "admin" || !!permissions?.[key],
    [auth, permissions],
  );

  return (
    <AuthContext.Provider value={{ auth, tenant, loading, can, login, registerTenant, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
