import type { ChangeStage, ChangeImpact, Readiness, TimelineEvent } from "@/domain/types";
import { timeAgo, fmtDate } from "@/utils/format";
import { ExecMode } from "./StatusBadge";

export function JourneyStepper({ stages, vertical }: { stages: ChangeStage[]; vertical?: boolean }) {
  return <div className={`journey${vertical ? " vertical" : ""}`} role="list" aria-label="Change journey">
    {stages.map((s) => <div key={s.key} className={`step ${s.state}`} role="listitem" aria-current={s.state === "ACTIVE" ? "step" : undefined} title={`${s.name}: ${s.state.toLowerCase()}${s.completedAt ? " " + fmtDate(s.completedAt) : ""}`}>
      <div className="dot">{s.state === "COMPLETED" ? <i className="bi bi-check-lg" /> : s.state === "SKIPPED" ? <i className="bi bi-skip-forward-fill" /> : s.state === "BLOCKED" || s.state === "FAILED" ? <i className="bi bi-x-lg" /> : s.state === "ACTIVE" ? <i className="bi bi-circle-fill" style={{ fontSize: 7 }} /> : null}</div>
      <div className="name">{s.name}</div>
      {vertical && <span className="ms-auto small text-secondary">{s.state === "ACTIVE" ? `${s.progress}%` : s.state.toLowerCase()}</span>}
    </div>)}
  </div>;
}

export function ImpactMap({ impacts, editable, onChange }: { impacts: ChangeImpact[]; editable?: boolean; onChange?: (i: ChangeImpact[]) => void }) {
  const icon = (s: ChangeImpact["status"]) => s === "AFFECTED" ? "🔵" : s === "REVIEW" ? "🟠" : "⚪";
  const label = (s: ChangeImpact["status"]) => s === "AFFECTED" ? "Affected" : s === "REVIEW" ? "Needs review" : "No change";
  return <div>{impacts.map((i) => <div key={i.component} className="impact-row">
    <span>{i.component}{i.note && <span className="text-secondary small ms-2">{i.note}</span>}</span>
    {editable ? <select className="form-select form-select-sm w-auto" value={i.status} aria-label={`${i.component} impact`} onChange={(e) => onChange?.(impacts.map((x) => x.component === i.component ? { ...x, status: e.target.value as ChangeImpact["status"] } : x))}><option value="AFFECTED">🔵 Affected</option><option value="REVIEW">🟠 Needs review</option><option value="NO_CHANGE">⚪ No change</option></select> : <span>{icon(i.status)} {label(i.status)}</span>}
  </div>)}</div>;
}

export function ReadinessScore({ readiness }: { readiness: Readiness }) {
  const ico = (s: string) => s === "PASS" ? "bi-check-lg" : s === "WARN" ? "bi-exclamation-triangle-fill" : s === "FAIL" ? "bi-x-lg" : "bi-circle";
  const sym = (s: string) => s === "PASS" ? "✓" : s === "WARN" ? "⚠" : s === "FAIL" ? "✕" : "○";
  return <div>
    <div className="d-flex align-items-baseline gap-3 mb-2"><span className="readiness-score" style={{ color: readiness.deployable ? "var(--smcp-success)" : readiness.score > 60 ? "var(--smcp-warning)" : "var(--smcp-danger)" }}>{readiness.score}%</span><span className="text-secondary">{readiness.deployable ? "Ready for production" : "Not deployable yet"}</span></div>
    {readiness.checks.map((c) => <div key={c.key} className="check-row" title={c.detail}><span>{c.label}{!c.required && <span className="text-secondary small ms-1">(optional)</span>}{c.detail && <span className="text-secondary small ms-2">{c.detail}</span>}</span><span aria-label={c.state}><i className={`bi ${ico(c.state)} me-1`} />{sym(c.state)}</span></div>)}
  </div>;
}

export function Timeline({ events, limit }: { events: TimelineEvent[]; limit?: number }) {
  const icons: Record<string, string> = { STAGE: "bi-flag", TASK: "bi-gear", APPROVAL: "bi-person-check", DEPLOYMENT: "bi-rocket-takeoff", INCIDENT: "bi-exclamation-triangle", COMMENT: "bi-chat", SYSTEM: "bi-cpu", AI: "bi-robot" };
  const list = limit ? events.slice(0, limit) : events;
  if (!list.length) return <div className="text-secondary small">No events yet.</div>;
  return <ul className="timeline">{list.map((e) => <li key={e.id} className={`k-${e.kind}`}><span className="marker"><i className={`bi ${icons[e.kind] ?? "bi-dot"}`} /></span><div>{e.message}</div><div className="d-flex gap-2 align-items-center"><span className="who">{e.actor}</span><ExecMode mode={e.executionMode} /><span className="when" title={fmtDate(e.at)}>{timeAgo(e.at)}</span></div></li>)}</ul>;
}
