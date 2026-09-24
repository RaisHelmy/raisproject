import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type SessionUser } from "./lib/api";

interface AuthApi {
  user: SessionUser | null;
  loading: boolean;
  /** Set after signup in dev email mode so the UI can offer the verify link. */
  devVerifyUrl: string | null;
  signup: (name: string, email: string, password: string, ref?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setDevVerifyUrl: (url: string | null) => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get<{ user: SessionUser | null }>("/auth/me");
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signup = useCallback(async (name: string, email: string, password: string, ref?: string) => {
    const res = await api.post<{ user: SessionUser; devVerifyUrl?: string }>("/auth/signup", {
      name,
      email,
      password,
      ref,
    });
    setUser(res.user);
    setDevVerifyUrl(res.devVerifyUrl ?? null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: SessionUser }>("/auth/login", { email, password });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, devVerifyUrl, signup, login, logout, refresh, setDevVerifyUrl }),
    [user, loading, devVerifyUrl, signup, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
