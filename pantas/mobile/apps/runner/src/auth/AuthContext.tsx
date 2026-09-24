import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  api,
  ApiError,
  getStoredSessionId,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type Me,
  type RegisterInput,
  type Role,
} from "@pantas/api-client";

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (phone: string, password: string, role?: Role) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sessionId = await getStoredSessionId();
    if (!sessionId) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setMe(await api.get<Me>("/auth/me"));
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) console.error(err);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (phone: string, password: string, role?: Role) => {
    await apiLogin(phone, password, role);
    await refresh();
  }, [refresh]);

  const register = useCallback(async (input: RegisterInput) => {
    await apiRegister(input);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiLogout();
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
