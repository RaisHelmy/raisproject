import { Link } from "react-router-dom";
import { useApp } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { NextActionPanel, Panel, MetricCard, Loading, ErrorState, EmptyState } from "@/components/Panels";
import { StatusBadge } from "@/components/StatusBadge";
import { timeAgo } from "@/utils/format";

export default function Dashboard() {
  const { api } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.dashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} action={<button className="btn btn-sm btn-outline-secondary" onClick={() => reload()}>Retry</button>} />;
  const d = data;
  return <div>
    <div className="page-header"><div><h1>{d.greeting}</h1><div className="subtitle">{d.organization.name} · {d.roleView === "MANAGER" ? "Manager view" : d.roleView === "SECURITY" ? "Security view" : d.roleView === "DEVOPS" ? "DevOps view" : d.roleView === "QA" ? "QA view" : "Developer view"} · {d.metrics.changesInFlight} changes in flight</div></div><div className="d-flex gap-2"><Link to="/changes/new" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />Start a Change</Link></div></div>
    {d.suggestions.length > 0 && <div className="alert alert-info py-2 d-flex align-items-center gap-2 small"><i className="bi bi-lightbulb" /><span>{d.suggestions[0].message}</span><Link className="ms-auto btn btn-sm btn-outline-primary" to={`/changes/${d.suggestions[0].changeId}`}>Review</Link></div>}
    <div className="row g-3">
      <div className="col-lg-7"><NextActionPanel action={d.nextAction} />
        {d.nextActions.length > 1 && <div className="panel mt-3"><div className="panel-header"><h2 className="panel-title">Also needing attention</h2></div>{d.nextActions.slice(1, 5).map((a, i) => <Link key={i} to={a.href} className="list-row text-body" style={{ textDecoration: "none" }}><span>{a.severity === "HIGH" || a.severity === "CRITICAL" ? "🔴" : a.severity === "MEDIUM" ? "🟠" : "🔵"}</span><div className="flex-grow-1"><div className="title">{a.title}</div><div className="meta">{a.description}</div></div><span className="btn btn-sm btn-outline-secondary">{a.actionLabel}</span></Link>)}</div>}
      </div>
      <div className="col-lg-5">
        <Panel title="My actions"><div className="row g-2 text-center">
          {[{ n: d.myActions.approvals, l: "approvals", h: "/approvals?mine=true" }, { n: d.myActions.blockedChanges, l: "blocked changes", h: "/changes?view=blocked" }, { n: d.myActions.escalatedTasks, l: "escalated tasks", h: "/tasks?status=failed" }, { n: d.myActions.uatTasks, l: "UAT tasks", h: "/work/uat" }].map((m) => <div className="col-6" key={m.l}><Link to={m.h} className="d-block p-2 rounded text-body" style={{ background: "var(--smcp-surface-2)", textDecoration: "none" }}><div className="fs-4 fw-semibold">{m.n}</div><div className="small text-secondary">{m.l}</div></Link></div>)}
        </div></Panel>
        <div className="mt-3"><Panel title="Waiting for others">{d.waitingForOthers.length ? d.waitingForOthers.map((w, i) => <div key={i} className="d-flex justify-content-between gap-2 py-1 small"><Link to={w.href} className="text-truncate">{w.label}</Link><span className="text-secondary text-nowrap">{w.detail}</span></div>) : <span className="text-secondary small">Nothing is waiting on other people.</span>}</Panel></div>
      </div>
      <div className="col-lg-7"><div className="panel"><div className="panel-header"><h2 className="panel-title">Your active changes</h2><Link to="/changes?view=mine" className="small">View all</Link></div>
        {d.activeChanges.length === 0 ? <EmptyState icon="bi-arrow-left-right" title="No active changes" body="Describe what you want to change and Super MCP will plan it." action={<Link to="/changes/new" className="btn btn-primary btn-sm">Start a Change</Link>} /> : d.activeChanges.map((c) => <Link key={c.id} to={`/changes/${c.id}`} className="list-row text-body" style={{ textDecoration: "none" }}>
          <div className="flex-grow-1"><div className="d-flex align-items-center gap-2"><span className="mono text-secondary">{c.key}</span><span className="title">{c.title}</span><StatusBadge status={c.status} /></div><div className="d-flex align-items-center gap-3 mt-1"><div className="progress flex-grow-1" style={{ maxWidth: 220 }} role="progressbar" aria-valuenow={c.progress} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar" style={{ width: `${c.progress}%` }} /></div><span className="small">{c.progress}%</span><span className="meta">Current: {c.stage}</span>{c.pending && <span className="meta text-warning">Pending: {c.pending}</span>}</div></div>
          <span className="btn btn-sm btn-outline-secondary">Continue</span></Link>)}
      </div></div>
      <div className="col-lg-5">
        <Panel title="Agent health" actions={<Link to="/agents/health" className="small">Details</Link>}><div className="d-flex gap-3 flex-wrap"><div><span className="fs-4 fw-semibold text-success">{d.agentHealth.online}</span> <span className="text-secondary small">Online</span></div><div><span className="fs-4 fw-semibold" style={{ color: "var(--smcp-warning)" }}>{d.agentHealth.degraded}</span> <span className="text-secondary small">Degraded</span></div><div><span className="fs-4 fw-semibold text-danger">{d.agentHealth.quarantined}</span> <span className="text-secondary small">Quarantined</span></div>{d.agentHealth.pending > 0 && <div><span className="fs-4 fw-semibold">{d.agentHealth.pending}</span> <span className="text-secondary small">Pending</span></div>}</div></Panel>
        <div className="mt-3 panel"><div className="panel-header"><h2 className="panel-title">Active deployments</h2><Link to="/infrastructure/deployments" className="small">All</Link></div>{d.activeDeployments.length === 0 ? <div className="panel-body text-secondary small">No deployments in the last 12 hours.</div> : d.activeDeployments.map((x) => <Link key={x.id} to={`/deployments/${x.id}`} className="list-row text-body" style={{ textDecoration: "none" }}><i className="bi bi-rocket-takeoff text-secondary" /><div className="flex-grow-1"><div className="title">{x.applicationName} <span className="mono">{x.version}</span></div><div className="meta">{x.environmentName} · {timeAgo(x.startedAt)}</div></div><StatusBadge status={x.status} /></Link>)}</div>
      </div>
      <div className="col-md-3 col-6"><MetricCard label="AI requests avoided (month)" value={d.metrics.aiRequestsAvoided.toLocaleString()} hint="Task Engine handled deterministically" tone="success" /></div>
      <div className="col-md-3 col-6"><MetricCard label="Self-healed failures" value={d.metrics.selfHealed} hint="No human or AI needed" /></div>
      <div className="col-md-3 col-6"><MetricCard label="Deployments this month" value={d.metrics.deploymentsThisMonth} /></div>
      <div className="col-md-3 col-6"><MetricCard label="Open incidents" value={d.incidents.length} tone={d.incidents.length ? "danger" : undefined} hint={d.incidents[0] ? <Link to={`/incidents/${d.incidents[0].id}`}>{d.incidents[0].key}: {d.incidents[0].title}</Link> : "All clear"} /></div>
    </div>
  </div>;
}
