import { useEffect, useState, type ReactNode } from "react";

export function Drawer({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;
  return <><div className="drawer-backdrop" onClick={onClose} /><aside className={`drawer${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Dialog"}><div className="drawer-header"><strong>{title}</strong><button className="icon-btn" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg" /></button></div><div className="drawer-body">{children}</div>{footer && <div className="drawer-header border-top border-bottom-0">{footer}</div>}</aside></>;
}

export function ConfirmationDialog({ open, title, body, confirmLabel = "Confirm", tone = "primary", onConfirm, onCancel, busy }: { open: boolean; title: string; body: ReactNode; confirmLabel?: string; tone?: "primary" | "danger"; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return <Drawer open={open} onClose={onCancel} title={title} footer={<div className="d-flex gap-2 w-100 justify-content-end"><button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy}>{busy && <i className="bi bi-arrow-repeat spin me-1" />}{confirmLabel}</button></div>}>{body}</Drawer>;
}

/** Section 116 — dangerous actions require typed confirmation and show what will happen. */
export function DangerConfirmation({ open, title, phrase, facts, onConfirm, onCancel, busy, confirmLabel = "I understand, proceed" }: { open: boolean; title: string; phrase: string; facts: { label: string; value: ReactNode }[]; onConfirm: (typed: string) => void; onCancel: () => void; busy?: boolean; confirmLabel?: string }) {
  const [typed, setTyped] = useState("");
  useEffect(() => { if (!open) setTyped(""); }, [open]);
  return <Drawer open={open} onClose={onCancel} title={<span className="text-danger"><i className="bi bi-exclamation-octagon-fill me-2" />{title}</span>} footer={<div className="d-flex gap-2 w-100 justify-content-end"><button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className="btn btn-danger" onClick={() => onConfirm(typed)} disabled={busy || typed !== phrase}>{busy && <i className="bi bi-arrow-repeat spin me-1" />}{confirmLabel}</button></div>}>
    <dl className="kv mb-3">{facts.map((f) => <div key={f.label} style={{ display: "contents" }}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
    <label className="form-label">Type <code>{phrase}</code> to confirm</label>
    <input className="form-control" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
  </Drawer>;
}
