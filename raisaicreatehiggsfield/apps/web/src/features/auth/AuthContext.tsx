import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../../lib/api";

export interface CurrentUser {
  userId: string;
  orgId: string;
  isAdmin: boolean;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  advancedMode: boolean;
  setAdvancedMode: (v: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

const ADVANCED_MODE_KEY = "rais.advancedMode";

export function AuthProvider(props: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancedMode, setAdvancedModeState] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(ADVANCED_MODE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setAdvancedMode = useCallback((v: boolean) => {
    setAdvancedModeState(v);
    try {
      window.localStorage.setItem(ADVANCED_MODE_KEY, v ? "1" : "0");
    } catch {
      // ignore: private browsing / storage blocked, toggle still works for this session
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    await refresh();
  }, [refresh]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    await api("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, name }) });
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, advancedMode, setAdvancedMode, login, signup, logout, refresh }}>
      {props.children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
