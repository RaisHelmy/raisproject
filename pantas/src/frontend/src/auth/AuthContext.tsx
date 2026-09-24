import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../api";

export type Role = "purchaser" | "runner" | "vendor" | "admin";

export interface Me {
  userId: string;
  activeRole: Role;
  roles: Role[];
}

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (phone: string, password: string, role?: Role) => Promise<void>;
  register: (input: {
    realName: string;
    phone: string;
    password: string;
    role: "purchaser" | "runner" | "vendor";
    anonymousMode?: boolean;
    consentVersion?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api.get<Me>("/auth/me");
      setMe(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
      else console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (phone: string, password: string, role?: Role) => {
      await api.post("/auth/login", { phone, password, role });
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (input: Parameters<AuthState["register"]>[0]) => {
      await api.post("/auth/register", input);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
