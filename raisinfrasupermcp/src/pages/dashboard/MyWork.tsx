import { Link } from "react-router-dom";
import { useApp } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState } from "@/components/Panels";
import { StatusBadge } from "@/components/StatusBadge";
import { timeAgo } from "@/utils/format";

export function MyActions() {
  const { api } = useApp();
  const { data, loading, error } = useAsync(async () => ({ dash: await api.dashboard(), approvals: await api.approvals.list({ status: "PENDING", mine: true }), tasks: await api.tasks.list({ status: "failed" }) }), []);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  return <div><PageHeader title="My Actions" subtitle="Everything that needs you, ordered by urgency." />
    <div className="row g-3"><div className="col-lg-8">
      <Panel title="Next actions">{data.dash.nextActions.length === 0 ? <EmptyState icon="bi-check2-circle" title="All caught up" /> : data.dash.nextActions.map((a, i) => <Link key={i} to={a.href} className="list-row text-body" style={{ textDecoration: "none" }}><span>{a.severity === "HIGH" || a.severity === "CRITICAL" ? "🔴" : a.severity === "MEDIUM" ? "🟠" : "🔵"}</span><div className="flex-grow-1"><div className="title">{a.title}</div><div className="meta">{a.description}</div></div>{a.risk && <StatusBadge status={a.risk} />}<span className="btn btn-sm btn-primary">{a.actionLabel}</span></Link>)}</Panel>
      <div className="mt-3"><Panel title={`Approvals for me (${data.approvals.length})`}>{data.approvals.length === 0 ? <span className="text-secondary small">No approvals waiting for you.</span> : data.approvals.map((a) => <Link key={a.id} to={`/approvals/${a.id}`} className="list-row text-body" style={{ textDecoration: "none" }}><div className="flex-grow-1"><div className="title">{a.key} {a.title}</div><div className="meta">Requested by {a.requestedByName} · {timeAgo(a.createdAt)}</div></div><StatusBadge status={a.risk} /></Link>)}</Panel></div>
    </div><div className="col-lg-4">
      <Panel title="Escalated / healing tasks">{data.tasks.length === 0 ? <span className="text-secondary small">No tasks need attention.</span> : data.tasks.slice(0, 8).map((t) => <Link key={t.id} to={`/tasks/${t.id}`} className="list-row text-body px-0" style={{ textDecoration: "none" }}><div className="flex-grow-1"><div className="title small">{t.name}</div><div className="meta">{t.key}</div></div><StatusBadge status={t.status} /></Link>)}</Panel>
    </div></div></div>;
}

export function WaitingForOthers() {
  const { api } = useApp();
  const { data, loading, error } = useAsync(() => api.dashboard(), []);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  return <div><PageHeader title="Waiting for Others" subtitle="Approvals and validations owned by someone else." />
    <Panel>{data.waitingForOthers.length === 0 ? <EmptyState icon="bi-hourglass" title="Nothing is waiting on others" body="When you request an approval or hand off UAT, it appears here with who needs to act." /> : data.waitingForOthers.map((w, i) => <Link key={i} to={w.href} className="list-row text-body" style={{ textDecoration: "none" }}><i className="bi bi-hourglass-split text-warning" /><div className="flex-grow-1"><div className="title">{w.label}</div><div className="meta">{w.detail}</div></div><i className="bi bi-chevron-right text-secondary" /></Link>)}</Panel></div>;
}
