import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role, UserDTO } from "@rais/shared-types";
import { api } from "./api";

interface Me { user: UserDTO; auth_method: string; demo: { ai: boolean; jira: boolean } }

interface AuthContextValue {
  user: UserDTO | null;
  demo: { ai: boolean; jira: boolean };
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isApprover: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { const r = await api<Me>("/auth/me"); setMe(r.data); } catch { setMe(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => setMe(null);
    window.addEventListener("rais:unauthorized", h);
    return () => window.removeEventListener("rais:unauthorized", h);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const roles = me?.user.roles ?? [];
    return {
      user: me?.user ?? null,
      demo: me?.demo ?? { ai: true, jira: true },
      loading,
      login: async (email, password) => { await api("/auth/login", { body: { email, password } }); await refresh(); },
      logout: async () => { await api("/auth/logout", { method: "POST", body: {} }); setMe(null); },
      refresh,
      hasRole: (...r) => r.some((x) => roles.includes(x)),
      isApprover: roles.includes("ADMIN") || roles.includes("APPROVER"),
      isAdmin: roles.includes("ADMIN"),
    };
  }, [me, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
