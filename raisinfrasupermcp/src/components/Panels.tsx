import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { NextAction, ChangeBlocker } from "@/domain/types";
import { StatusBadge } from "./StatusBadge";

export function Panel({ title, actions, children, className = "", dense }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; dense?: boolean }) {
  return <section className={`panel ${className}`}>{title !== undefined && <header className="panel-header"><h2 className="panel-title">{title}</h2>{actions && <div className="d-flex gap-2 align-items-center">{actions}</div>}</header>}<div className={`panel-body${dense ? " dense" : ""}`}>{children}</div></section>;
}

export function PageHeader({ title, subtitle, actions, badge }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; badge?: ReactNode }) {
  return <div className="page-header"><div><div className="d-flex align-items-center gap-2 flex-wrap"><h1>{title}</h1>{badge}</div>{subtitle && <div className="subtitle">{subtitle}</div>}</div>{actions && <div className="d-flex gap-2 flex-wrap align-items-center">{actions}</div>}</div>;
}

export function MetricCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warning" | "success" | "info" }) {
  return <div className="panel"><div className="panel-body metric"><span className="label">{label}</span><span className="value" style={tone ? { color: `var(--smcp-${tone})` } : undefined}>{value}</span>{hint && <span className="hint">{hint}</span>}</div></div>;
}

export function EmptyState({ icon = "bi-inbox", title, body, action }: { icon?: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><i className={`bi ${icon}`} aria-hidden /><h4>{title}</h4>{body && <p className="mb-3">{body}</p>}{action}</div>;
}

export function ErrorState({ title = "Something could not be loaded", message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return <div className="error-state" role="alert"><h4><i className="bi bi-exclamation-octagon me-2" />{title}</h4>{message && <div className="mb-2">{message}</div>}{action}</div>;
}

export function Loading({ label = "Loading…" }: { label?: string }) { return <div className="text-secondary py-4 text-center" role="status"><i className="bi bi-arrow-repeat spin me-2" />{label}</div>; }

export function NextActionPanel({ action, compact }: { action: NextAction; compact?: boolean }) {
  const sevIcon = action.severity === "CRITICAL" || action.severity === "HIGH" ? "🔴" : action.severity === "MEDIUM" ? "🟠" : action.severity === "LOW" ? "🔵" : "🟢";
  return (
    <section className={`panel next-action sev-${action.severity}`} aria-label="Your next action">
      <div className="panel-body">
        <div className="panel-title">Your next action</div>
        <h3>{sevIcon} {action.title}</h3>
        <div className="text-secondary mb-2">{action.description}</div>
        {!compact && <dl className="kv mb-3">
          {action.requestedBy && <><dt>Requested by</dt><dd>{action.requestedBy}</dd></>}
          {action.environment && <><dt>Environment</dt><dd>{action.environment}</dd></>}
          {action.risk && <><dt>Risk</dt><dd><StatusBadge status={action.risk} /></dd></>}
          {action.waitingFor && <><dt>Waiting for</dt><dd>{action.waitingFor}</dd></>}
          <dt>Safe?</dt><dd>{action.safe ? <span className="text-success"><i className="bi bi-shield-check me-1" />Low-impact action</span> : <span className="text-warning"><i className="bi bi-shield-exclamation me-1" />Governed — policy and approval apply</span>}</dd>
        </dl>}
        <Link className={`btn ${action.severity === "NONE" ? "btn-outline-secondary" : "btn-primary"}`} to={action.href}>{action.actionLabel}</Link>
      </div>
    </section>
  );
}

export function BlockerPanel({ blockers }: { blockers: ChangeBlocker[] }) {
  const open = blockers.filter((b) => !b.resolvedAt);
  if (!open.length) return null;
  return <section className="panel" style={{ borderColor: "var(--smcp-danger)" }}><div className="panel-body">
    <div className="panel-title text-danger"><i className="bi bi-x-octagon-fill me-1" />Blocked</div>
    {open.map((b) => <div key={b.id} className="mt-2">
      <div className="fw-semibold">{b.title}</div><div className="text-secondary small">{b.reason}</div>
      {b.missing.length > 0 && <div className="mt-2 small"><span className="text-secondary">Missing:</span><ul className="mb-1 ps-3">{b.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
      {b.waitingFor && <div className="small"><span className="text-secondary">Waiting for:</span> {b.waitingFor.label}</div>}
      {b.approvalRequestId && <Link className="btn btn-sm btn-outline-secondary mt-2" to={`/approvals/${b.approvalRequestId}`}>View Approval</Link>}
    </div>)}
  </div></section>;
}

export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: ReactNode }[]; active: string; onChange: (k: string) => void }) {
  return <div className="tabs-smcp" role="tablist">{tabs.map((t) => <button key={t.key} role="tab" aria-selected={active === t.key} className={active === t.key ? "active" : ""} onClick={() => onChange(t.key)}>{t.label}</button>)}</div>;
}

export function ComingSoon({ title, body, demo }: { title: string; body?: string; demo?: ReactNode }) {
  return <Panel><EmptyState icon="bi-stars" title={`${title} — coming soon`} body={body ?? "This capability is planned for a later phase. The provider interface and configuration placeholders already exist so nothing is faked here."} action={demo} /></Panel>;
}
