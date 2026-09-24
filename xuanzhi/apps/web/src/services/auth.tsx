import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { EntitlementsDTO, UserDTO, PlanCode } from "@xuanzhi/shared-types";
import { api } from "./api";
import { usePrefs } from "./prefs";

export interface Me { user: UserDTO; entitlements: EntitlementsDTO; organizations: { id: string; name: string; slug: string; role: string; plan_code: PlanCode | null }[]; features: { oauth: string[]; stripe: boolean; email: boolean; auth_method: string } }
interface AuthCtx { me: Me | null; user: UserDTO | null; loading: boolean; refresh: () => Promise<void>; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string, locale: string) => Promise<{ verification_sent: boolean }>; logout: () => Promise<void>; isAdmin: boolean }
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const { setLocale, setTheme } = usePrefs();
  const refresh = useCallback(async () => {
    try { const r = await api<Me>("/auth/me"); setMe(r.data); setLocale(r.data.user.locale); setTheme(r.data.user.theme); } catch { setMe(null); } finally { setLoading(false); }
  }, [setLocale, setTheme]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const h = () => setMe(null); window.addEventListener("xz:unauthorized", h); return () => window.removeEventListener("xz:unauthorized", h); }, []);
  const value = useMemo<AuthCtx>(() => ({
    me, user: me?.user ?? null, loading, refresh,
    login: async (email, password) => { await api("/auth/login", { body: { email, password } }); await refresh(); },
    register: async (name, email, password, locale) => { const r = await api<{ verification_sent: boolean }>("/auth/register", { body: { name, email, password, locale } }); await refresh(); return r.data; },
    logout: async () => { await api("/auth/logout", { method: "POST", body: {} }); setMe(null); },
    isAdmin: me?.user.role === "admin" || me?.user.role === "super_admin",
  }), [me, loading, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth(): AuthCtx { const v = useContext(Ctx); if (!v) throw new Error("useAuth outside AuthProvider"); return v; }
