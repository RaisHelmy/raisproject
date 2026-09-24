import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/Panels";
import { DataTable, FilterBar } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { timeAgo } from "@/utils/format";

const VIEWS = [{ k: "all", l: "All" }, { k: "mine", l: "My Changes" }, { k: "active", l: "Active" }, { k: "blocked", l: "Blocked" }, { k: "awaiting", l: "Awaiting Approval" }, { k: "completed", l: "Completed" }];

export default function ChangesList() {
  const { api } = useApp();
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") ?? "all") as "all" | "mine" | "blocked" | "awaiting" | "completed" | "active";
  const [search, setSearch] = useState("");
  const nav = useNavigate();
  const { data, loading, error } = useAsync(() => api.changes.list({ view, search }), [view, search]);
  return <div>
    <PageHeader title="Changes" subtitle="A Change is the central object: intent → plan → Jira → git → CI → test → policy → approval → deploy → validate → UAT → close." actions={<Link to="/changes/new" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />Start a Change</Link>} />
    <div className="tabs-smcp">{VIEWS.map((v) => <button key={v.k} className={view === v.k ? "active" : ""} onClick={() => setParams(v.k === "all" ? {} : { view: v.k })}>{v.l}</button>)}</div>
    <FilterBar><input className="form-control" placeholder="Search key, title, intent…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search changes" /></FilterBar>
    {loading ? <Loading /> : error ? <ErrorState message={error} /> : <div className="panel"><DataTable rows={data ?? []} rowKey={(c) => c.id} onRowClick={(c) => nav(`/changes/${c.id}`)} empty={<EmptyState icon="bi-arrow-left-right" title={view === "blocked" ? "Nothing is blocked" : view === "awaiting" ? "No approvals pending" : "No changes yet"} body="Describe what you want to change. Super MCP plans it, creates Jira issues, tracks git and CI, and governs the deployment." action={<Link to="/changes/new" className="btn btn-primary btn-sm">Start a Change</Link>} />} columns={[
      { key: "key", header: "Change", render: (c) => <div><span className="mono text-secondary me-2">{c.key}</span><span className="fw-semibold">{c.title}</span><div className="small text-secondary text-truncate" style={{ maxWidth: 420 }}>{c.intent}</div></div> },
      { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
      { key: "stage", header: "Stage", render: (c) => <span>{c.stageName}</span> },
      { key: "progress", header: "Progress", width: "160px", render: (c) => <div className="d-flex align-items-center gap-2"><div className="progress flex-grow-1"><div className="progress-bar" style={{ width: `${c.progress}%` }} /></div><span className="small">{c.progress}%</span></div> },
      { key: "risk", header: "Risk", render: (c) => <StatusBadge status={c.risk} /> },
      { key: "blocker", header: "Pending / Blocking", render: (c) => { const b = c.blockers.find((x) => !x.resolvedAt); return b ? <span className="text-danger small"><i className="bi bi-x-octagon me-1" />{b.missing[0] ?? b.title}</span> : <span className="text-secondary small">—</span>; } },
      { key: "updated", header: "Updated", render: (c) => <span className="text-secondary small">{timeAgo(c.updatedAt)}</span> },
    ]} /></div>}
  </div>;
}
