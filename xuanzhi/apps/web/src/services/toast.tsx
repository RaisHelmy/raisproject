import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface Toast { id: number; kind: "success" | "error" | "info"; message: string }
interface ToastCtx { toasts: Toast[]; push: (kind: Toast["kind"], message: string) => void; success: (m: string) => void; error: (m: string) => void; info: (m: string) => void; dismiss: (id: number) => void }
const Ctx = createContext<ToastCtx | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Toast["kind"], message: string) => { const id = seq++; setToasts((t) => [...t, { id, kind, message }]); setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000); }, [dismiss]);
  const value = useMemo<ToastCtx>(() => ({ toasts, push, success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m), dismiss }), [toasts, push, dismiss]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="xz-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`xz-toast xz-toast-${t.kind}`} role="status">
            <i className={`bi ${t.kind === "success" ? "bi-check-circle" : t.kind === "error" ? "bi-exclamation-circle" : "bi-info-circle"}`} />
            <span>{t.message}</span>
            <button className="btn btn-sm btn-link text-reset" aria-label="Dismiss" onClick={() => dismiss(t.id)}><i className="bi bi-x" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export function useToast(): ToastCtx { const v = useContext(Ctx); if (!v) throw new Error("useToast outside ToastProvider"); return v; }
