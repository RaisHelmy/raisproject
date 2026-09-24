import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ApiError } from "@/services/api";
import { formatMinutes, humanize, pct } from "@/services/format";

// ---------- Page scaffolding ----------

export function PageHeader({ title, subtitle, actions, breadcrumb }: { title: string; subtitle?: ReactNode; actions?: ReactNode; breadcrumb?: { label: string; to?: string }[] }) {
  return (
    <div className="page-header d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        {breadcrumb && (
          <nav aria-label="breadcrumb"><ol className="breadcrumb mb-1 small">{breadcrumb.map((b, i) => <li key={i} className={`breadcrumb-item${b.to ? "" : " active"}`}>{b.to ? <Link to={b.to}>{b.label}</Link> : b.label}</li>)}</ol></nav>
        )}
        <h1 className="h3 mb-1">{title}</h1>
        {subtitle && <div className="text-secondary">{subtitle}</div>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions, footer }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; footer?: ReactNode }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && <div className="card-header d-flex align-items-center justify-content-between gap-2"><div className="fw-semibold">{title}</div>{actions}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, to, tone = "default", icon }: { label: string; value: ReactNode; hint?: ReactNode; to?: string; tone?: "default" | "warning" | "danger" | "success" | "info"; icon?: string }) {
  const inner = (
    <div className={`stat-card stat-${tone} h-100`}>
      <div className="d-flex justify-content-between align-items-start">
        <div className="stat-label">{label}</div>
        {icon && <i className={`bi bi-${icon} stat-icon`} aria-hidden="true" />}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="text-decoration-none text-reset d-block h-100">{inner}</Link> : inner;
}

export function EmptyState({ icon = "check2-circle", title, body, action }: { icon?: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state text-center py-5">
      <i className={`bi bi-${icon} empty-icon`} aria-hidden="true" />
      <h2 className="h5 mt-3 mb-1">{title}</h2>
      {body && <p className="text-secondary mb-3">{body}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="d-flex align-items-center gap-2 text-secondary py-4" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> <span>{label}</span></div>;
}

export function ErrorAlert({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-start gap-3" role="alert">
      <div>
        <div className="fw-semibold">{error.message}</div>
        {error.reference && <div className="small">Reference: <code>{error.reference}</code></div>}
      </div>
      {onRetry && <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <div className="alert alert-warning py-2 small mb-3"><ul className="mb-0 ps-3">{items.map((w, i) => <li key={i}>{w}</li>)}</ul></div>;
}

// ---------- Status ----------

const TONES: Record<string, string> = {
  DRAFT: "secondary", SUBMITTED: "primary", APPROVED: "success", REJECTED: "danger",
  COMPLETED: "success", IN_PROGRESS: "info", BLOCKED: "danger", UNKNOWN: "secondary",
  NOT_LINKED: "warning", MATCH_SUGGESTED: "info", LINKED: "primary", READY_TO_PUSH: "primary", PUSHING: "primary", SYNCED: "success", SYNC_FAILED: "danger",
  ON_TIME: "success", DELAYED: "danger", AT_RISK: "warning", NO_DUE_DATE: "secondary", OPEN: "secondary",
  UPLOADED: "secondary", QUEUED: "secondary", PARSING: "info", ANALYSING: "info", READY_FOR_REVIEW: "warning", FAILED: "danger",
  PENDING: "warning", ACCEPTED: "success", IGNORED: "secondary", MERGED: "secondary",
  EXACT_MATCH: "success", SUGGESTED_MATCH: "info", NO_MATCH: "warning", POTENTIAL_DUPLICATE: "danger",
  HEALTHY: "success", DEGRADED: "warning", DISCONNECTED: "secondary", DEMO: "info",
  "To Do": "secondary", "In Progress": "info", Done: "success",
};
const LABELS: Record<string, string> = { NOT_LINKED: "No Jira", MATCH_SUGGESTED: "Match suggested", READY_TO_PUSH: "Ready to sync", PUSHING: "Syncing", SYNC_FAILED: "Sync failed", READY_FOR_REVIEW: "Ready for review", NO_DUE_DATE: "No due date", AT_RISK: "At risk", EXACT_MATCH: "Exact match", SUGGESTED_MATCH: "Suggested", NO_MATCH: "No match", POTENTIAL_DUPLICATE: "Possible duplicate" };

export function StatusBadge({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-secondary">—</span>;
  const tone = TONES[value] ?? "secondary";
  return <span className={`badge rounded-pill text-bg-${tone} badge-status ${className}`}>{LABELS[value] ?? humanize(value)}</span>;
}

export function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-secondary">—</span>;
  const level = value >= 0.8 ? "High" : value >= 0.55 ? "Medium" : "Low";
  const tone = value >= 0.8 ? "success" : value >= 0.55 ? "warning" : "danger";
  return <span className={`badge rounded-pill text-bg-${tone} badge-status`} title={`${pct(value)} confidence`}>{level} · {pct(value)}</span>;
}

export function SourceBadge({ source }: { source: string }) {
  if (source === "explicit") return <span className="badge text-bg-success-subtle text-success-emphasis"><i className="bi bi-check2 me-1" />Confirmed</span>;
  if (source === "inferred") return <span className="badge text-bg-warning-subtle text-warning-emphasis"><i className="bi bi-exclamation-triangle me-1" />Inferred</span>;
  if (source === "assumed") return <span className="badge text-bg-danger-subtle text-danger-emphasis"><i className="bi bi-question-circle me-1" />Assumed</span>;
  return <span className="badge text-bg-secondary-subtle text-secondary-emphasis">Unknown</span>;
}

export function Duration({ minutes }: { minutes: number | null | undefined }) { return <span className="text-nowrap">{formatMinutes(minutes)}</span>; }

export function DemoTag({ show, what }: { show: boolean; what: string }) {
  if (!show) return null;
  return <span className="badge text-bg-info-subtle text-info-emphasis border border-info-subtle ms-2" title={`${what} is running in demo mode`}>DEMO</span>;
}

// ---------- Tables ----------

export interface Column<T> { key: string; header: ReactNode; render: (row: T) => ReactNode; className?: string; priority?: 1 | 2 | 3; width?: string }

/** Responsive table: full table on md+, stacked cards on small screens. */
export function DataTable<T>({ columns, rows, keyOf, empty, selectable, selected, onToggle, onToggleAll, rowLink }: { columns: Column<T>[]; rows: T[]; keyOf: (r: T) => string; empty?: ReactNode; selectable?: boolean; selected?: Set<string>; onToggle?: (id: string) => void; onToggleAll?: () => void; rowLink?: (r: T) => string }) {
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing here yet." />}</>;
  const allSelected = selectable && selected && rows.every((r) => selected.has(keyOf(r)));
  return (
    <>
      <div className="table-responsive d-none d-md-block">
        <table className="table table-hover align-middle mb-0 data-table">
          <thead>
            <tr>
              {selectable && <th style={{ width: 36 }}><input type="checkbox" className="form-check-input" aria-label="Select all" checked={!!allSelected} onChange={onToggleAll} /></th>}
              {columns.map((c) => <th key={c.key} className={c.className} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = keyOf(r);
              return (
                <tr key={id} className={selected?.has(id) ? "table-active" : undefined}>
                  {selectable && <td><input type="checkbox" className="form-check-input" aria-label="Select row" checked={!!selected?.has(id)} onChange={() => onToggle?.(id)} /></td>}
                  {columns.map((c) => <td key={c.key} className={c.className}>{c.render(r)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="d-md-none row-cards">
        {rows.map((r) => {
          const id = keyOf(r);
          const primary = columns.filter((c) => (c.priority ?? 2) <= 2);
          return (
            <div key={id} className="row-card">
              {selectable && <div className="mb-2"><input type="checkbox" className="form-check-input me-2" checked={!!selected?.has(id)} onChange={() => onToggle?.(id)} aria-label="Select" /></div>}
              {primary.map((c) => <div key={c.key} className="row-card-field"><div className="row-card-label">{c.header}</div><div>{c.render(r)}</div></div>)}
              {rowLink && <Link to={rowLink(r)} className="btn btn-sm btn-outline-primary mt-2">Open</Link>}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <div className="small text-secondary mt-2">{total} record{total === 1 ? "" : "s"}</div>;
  return (
    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
      <div className="small text-secondary">Showing {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}</div>
      <div className="btn-group btn-group-sm" role="group" aria-label="Pagination">
        <button className="btn btn-outline-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span className="btn btn-outline-secondary disabled">Page {page} of {pages}</span>
        <button className="btn btn-outline-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

// ---------- Modal / confirm ----------

export function Modal({ open, title, children, footer, onClose, size = "md" }: { open: boolean; title: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void; size?: "md" | "lg" | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.classList.add("modal-open");
    return () => { document.removeEventListener("keydown", h); document.body.classList.remove("modal-open"); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={`modal-dialog modal-${size} modal-dialog-centered modal-dialog-scrollable`}>
          <div className="modal-content">
            <div className="modal-header"><h2 className="modal-title h5" id="modal-title">{title}</h2><button type="button" className="btn-close" aria-label="Close" onClick={onClose} /></div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export function ConfirmModal({ open, title, body, confirmLabel, tone = "primary", onConfirm, onClose, busy, requireReason, reasonLabel = "Reason" }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; tone?: "primary" | "danger" | "success"; onConfirm: (reason?: string) => void; onClose: () => void; busy?: boolean; requireReason?: boolean; reasonLabel?: string }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) setReason(""); }, [open]);
  return (
    <Modal open={open} title={title} onClose={onClose} footer={<>
      <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
      <button className={`btn btn-${tone}`} onClick={() => onConfirm(requireReason ? reason : undefined)} disabled={busy || (requireReason && reason.trim().length < 3)}>{busy && <span className="spinner-border spinner-border-sm me-2" />}{confirmLabel}</button>
    </>}>
      {body}
      {requireReason && <div className="mt-3"><label className="form-label" htmlFor="confirm-reason">{reasonLabel}</label><textarea id="confirm-reason" className="form-control" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain briefly so the author knows what to change." /></div>}
    </Modal>
  );
}

// ---------- Misc ----------

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="kv mb-0">{items.map((i) => <div key={i.label} className="kv-row"><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>;
}

export function Toast({ message, tone = "success", onDone }: { message: string | null; tone?: "success" | "danger" | "info"; onDone: () => void }) {
  useEffect(() => { if (!message) return; const id = setTimeout(onDone, 4000); return () => clearTimeout(id); }, [message, onDone]);
  if (!message) return null;
  return <div className="toast-container position-fixed bottom-0 end-0 p-3"><div className={`toast show text-bg-${tone}`} role="status"><div className="toast-body d-flex justify-content-between align-items-center gap-3">{message}<button className="btn-close btn-close-white" aria-label="Close" onClick={onDone} /></div></div></div>;
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; tone: "success" | "danger" | "info" } | null>(null);
  return { toast, show: (message: string, tone: "success" | "danger" | "info" = "success") => setToast({ message, tone }), node: <Toast message={toast?.message ?? null} tone={toast?.tone} onDone={() => setToast(null)} /> };
}

export function Steps({ steps, active }: { steps: string[]; active: number }) {
  return <ol className="workflow-steps">{steps.map((s, i) => <li key={s} className={i < active ? "done" : i === active ? "active" : ""}><span className="step-index">{i < active ? <i className="bi bi-check" /> : i + 1}</span><span className="step-label">{s}</span></li>)}</ol>;
}
