import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createApiClient, type ApiClient, type Session, ApiError } from "@/services/api";

interface AppContextValue {
  api: ApiClient; session: Session | null; loading: boolean;
  setSession: (s: Session | null) => void; refreshSession: () => Promise<void>;
  toast: (message: string, tone?: "info" | "success" | "error") => void;
  can: (permission: import("@/domain/types").Permission) => boolean;
}
const AppContext = createContext<AppContextValue | null>(null);

interface Toast { id: number; message: string; tone: "info" | "success" | "error" }

export function AppProviders({ children }: { children: ReactNode }) {
  const api = useMemo(() => createApiClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const refreshSession = useCallback(async () => { try { setSession(await api.auth.session()); } finally { setLoading(false); } }, [api]);
  useEffect(() => { refreshSession(); }, [refreshSession]);
  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => { const id = Date.now() + Math.random(); setToasts((t) => [...t, { id, message, tone }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4000); }, []);
  const can = useCallback((p: import("@/domain/types").Permission) => Boolean(session?.actor.permissions.includes(p)), [session]);
  const value = useMemo(() => ({ api, session, loading, setSession, refreshSession, toast, can }), [api, session, loading, refreshSession, toast, can]);
  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast-smcp ${t.tone}`}><i className={`bi ${t.tone === "error" ? "bi-exclamation-octagon" : t.tone === "success" ? "bi-check-circle" : "bi-info-circle"}`} /><span>{t.message}</span></div>)}</div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue { const v = useContext(AppContext); if (!v) throw new Error("AppProviders missing"); return v; }
export function useApi(): ApiClient { return useApp().api; }
export function useSession(): Session { const s = useApp().session; if (!s) throw new Error("No session"); return s; }
export function errorMessage(e: unknown): string { if (e instanceof ApiError) return e.message; if (e instanceof Error) return e.message; return String(e); }
