import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiClientError } from "./api";
import type { Role } from "../../shared/types";

export interface AuthSession {
  userId: string;
  tenantId: string;
  email: string;
  roles: Record<string, Role>;
  isSuperadmin?: boolean;
}

interface AuthState {
  session: AuthSession | null;
  loading: boolean;
  login: (input: { tenantSlug: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<AuthSession>("/api/auth/me");
      setSession(data);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setSession(null);
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (input: { tenantSlug: string; email: string; password: string }) => {
      await api.post("/api/auth/login", input);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
