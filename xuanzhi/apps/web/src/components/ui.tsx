import { useEffect, type ReactNode } from "react";
import { useT } from "@/i18n";

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal d-block" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable modal-${size}`}>
          <div className="modal-content">
            <div className="modal-header py-2"><h6 className="modal-title mb-0">{title}</h6><button type="button" className="btn-close" aria-label="Close" onClick={onClose} /></div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer py-2">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export function Confirm({ open, onClose, onConfirm, title, body, danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; danger?: boolean }) {
  const { t } = useT();
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><button className="btn btn-ghost btn-sm" onClick={onClose}>{t("common.cancel")}</button><button className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => { onConfirm(); onClose(); }}>{t("common.confirm")}</button></>}>
      <p className="mb-0">{body}</p>
    </Modal>
  );
}

export function Skeleton({ h = 14, w = "100%", className = "" }: { h?: number; w?: string | number; className?: string }) { return <div className={`xz-skel ${className}`} style={{ height: h, width: w }} />; }
export function Spinner({ small }: { small?: boolean }) { return <span className={`spinner-border ${small ? "spinner-border-sm" : ""}`} role="status" aria-hidden="true" />; }
export function Empty({ icon = "bi-inbox", title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return <div className="xz-empty"><i className={`bi ${icon} fs-1 text-faint`} /><h5 className="mt-3 mb-1">{title}</h5>{body && <p className="text-muted mb-3">{body}</p>}{action}</div>;
}
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useT(); const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return <div className="d-flex align-items-center gap-2 mt-3"><button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("common.previous")}</button><span className="text-muted fs-13">{t("common.page", { page, pages })}</span><button className="btn btn-sm btn-outline-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t("common.next")}</button></div>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <div className="mb-3"><label className="form-label fs-14 fw-medium">{label}</label>{children}{hint && <div className="form-text">{hint}</div>}</div>; }
export const fmtDate = (s: string | null | undefined, locale = "en") => (s ? new Date(s).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : "—");
export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Intl.NumberFormat().format(Math.round(n)));
export const fmtMoney = (n: number | null | undefined, currency = "USD") => (n === null || n === undefined ? "—" : Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: n < 10 ? 2 : 0 }).format(n));
export const fmtBytes = (b: number) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
