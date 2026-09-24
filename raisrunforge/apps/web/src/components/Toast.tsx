import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface ToastItem {
  id: number;
  title: string;
  message?: string;
  demo?: boolean;
  variant?: "success" | "error" | "info";
}

const ToastContext = createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="rf-toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="rf-toast">
            <div className="rf-toast-title">
              <i className={`bi ${t.variant === "error" ? "bi-x-circle-fill text-danger" : t.variant === "info" ? "bi-info-circle-fill text-info" : "bi-check-circle-fill text-success"} me-1`} />
              {t.title}
            </div>
            {t.message && <div className="rf-muted">{t.message}</div>}
            {t.demo && <div className="rf-toast-demo">Demo Provider — simulated</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
