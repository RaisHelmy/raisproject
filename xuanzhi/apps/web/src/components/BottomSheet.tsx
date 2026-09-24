import { useEffect, type ReactNode } from "react";

/** Right drawer on desktop, bottom sheet on mobile (same component; CSS switches). */
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="xz-overlay" onClick={onClose} />
      <aside className="xz-drawer" role="dialog" aria-modal="true">
        <div className="head"><div className="fw-semibold">{title}</div><button className="btn btn-ghost btn-sm" aria-label="Close" onClick={onClose}><i className="bi bi-x-lg" /></button></div>
        <div className="body flex-grow-1">{children}</div>
        {footer && <div className="p-3 border-top">{footer}</div>}
      </aside>
    </>
  );
}
