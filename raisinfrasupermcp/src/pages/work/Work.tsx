import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState, ComingSoon, MetricCard } from "@/components/Panels";
import { StatusBadge, ModeBadge } from "@/components/StatusBadge";
import { downloadFile, toCsv, timeAgo, minutes } from "@/utils/format";

export function Jira() {
  const { api } = useApp();
  const { data, loading, error } = useAsync(async () => ({ jira: (await api.platform.integrations()).find((i) => i.kind === "JIRA"), changes: await api.changes.list() }), []);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const issues = data.changes.flatMap((c) => c.jira.map((j) => ({ ...j, change: c })));
  return <div><PageHeader title="Jira" badge={<ModeBadge mode={data.jira?.status ?? "NOT_CONNECTED"} />} subtitle={data.jira ? `${data.jira.name} · project ${String(data.jira.config.project)} · credential: ${data.jira.credentialRef}` : "Connect Jira to sync Epics, Stories and Tasks from Changes."} />
    {data.jira?.status === "DEMO" && <div className="alert alert-warning py-2 small"><i className="bi bi-flask me-1" />MockJira: issues below are simulated by the Task Engine. Live Jira Cloud / Data Center adapter is Phase 3.</div>}
    <div className="panel">{issues.length === 0 ? <EmptyState icon="bi-kanban" title="No Jira issues" body="Confirm requirements on a Change to create its Epic, Stories and Tasks." /> : <div className="table-wrap"><table className="table-smcp"><thead><tr><th>Key</th><th>Type</th><th>Title</th><th>Status</th><th>Change</th></tr></thead><tbody>{issues.map((j) => <tr key={j.key + j.change.id}><td className="mono">{j.url ? <a href={j.url} target="_blank" rel="noreferrer">{j.key}</a> : j.key}</td><td><span className="status tone-neutral">{j.type}</span></td><td>{j.title}</td><td>{j.status}</td><td><Link to={`/changes/${j.change.id}`}>{j.change.key}</Link></td></tr>)}</tbody></table></div>}</div></div>;
}

export function Worklogs() { return <div><PageHeader title="Worklogs" subtitle="Time logged against Jira issues from tasks and changes." /><ComingSoon title="Worklogs" body="super.jira.worklog is defined in the MCP tool catalog and returns NOT_CONNECTED until Jira is connected (Phase 3)." /></div>; }

export function Testing() {
  const { api } = useApp();
  const { data, loading, error } = useAsync(() => api.changes.list({ view: "active" }), []);
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  const rows = (data ?? []).map((c) => ({ c, items: c.checklist.filter((i) => i.stageKey === "TESTING" || i.stageKey === "REVIEW") })).filter((r) => r.items.length);
  const pass = rows.reduce((a, r) => a + r.items.filter((i) => i.state === "DONE").length, 0); const fail = rows.reduce((a, r) => a + r.items.filter((i) => i.state === "FAILED").length, 0); const total = rows.reduce((a, r) => a + r.items.length, 0);
  return <div><PageHeader title="Testing" subtitle="Testing queue, test plans and pass/fail from change checklists and CI." />
    <div className="row g-3 mb-3"><div className="col-4"><MetricCard label="Passed" value={pass} tone="success" /></div><div className="col-4"><MetricCard label="Failed" value={fail} tone={fail ? "danger" : undefined} /></div><div className="col-4"><MetricCard label="Pending" value={total - pass - fail} /></div></div>
    <div className="panel">{rows.map(({ c, items }) => <div key={c.id} className="list-row align-items-start"><div className="flex-grow-1"><div className="title"><Link to={`/changes/${c.id}`}>{c.key}</Link> {c.title} <StatusBadge status={c.git.ciStatus ?? "PENDING"} label={`CI ${c.git.ciStatus?.toLowerCase() ?? "not run"}`} /></div><div className="d-flex flex-wrap gap-1 mt-1">{items.map((i) => <span key={i.id} className={`status ${i.state === "DONE" ? "tone-success" : i.state === "FAILED" ? "tone-danger" : "tone-neutral outline"}`}>{i.title}</span>)}</div></div><span className="small text-secondary">{c.stageName}</span></div>)}{rows.length === 0 && <EmptyState icon="bi-clipboard-check" title="Testing queue is empty" />}</div></div>;
}

export function Uat() {
  const { api, toast } = useApp();
  const { data, loading, error, reload } = useAsync(() => api.changes.list({ view: "active" }), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  const rows = (data ?? []).filter((c) => c.currentStageKey === "UAT");
  const record = async (id: string, result: "PASSED" | "FAILED") => { try { await api.changes.recordUat(id, result, notes[id] ?? ""); toast(`UAT ${result.toLowerCase()} recorded`, "success"); reload(true); } catch (e) { toast(errorMessage(e), "error"); } };
  return <div><PageHeader title="UAT" subtitle="User acceptance testing in production. UAT passed → Change ready to close." />
    <div className="panel">{rows.length === 0 ? <EmptyState icon="bi-people" title="Nothing awaiting UAT" body="Changes arrive here after live validation passes." /> : rows.map((c) => <div key={c.id} className="list-row align-items-start"><div className="flex-grow-1"><div className="title"><Link to={`/changes/${c.id}`}>{c.key}</Link> {c.title} <span className="mono small">{c.version}</span></div><div className="meta">Deployed {timeAgo(c.updatedAt)}</div><input className="form-control form-control-sm mt-2" placeholder="Validation note" value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} /></div><div className="d-flex gap-1"><button className="btn btn-sm btn-success" onClick={() => record(c.id, "PASSED")}>Pass</button><button className="btn btn-sm btn-outline-danger" onClick={() => record(c.id, "FAILED")}>Fail</button></div></div>)}</div></div>;
}

export function Reports() {
  const { api, toast } = useApp();
  const { data, loading, error } = useAsync(async () => ({ changes: await api.changes.list(), deployments: await api.platform.deployments(), incidents: await api.platform.incidents(), agents: await api.platform.agents(), summary: await api.telemetry.summary(30), recs: await api.telemetry.recommendations(), audit: await api.platform.auditLogs({ limit: 100 }) }), []);
  const [schedule, setSchedule] = useState("Weekly");
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const d = data;
  const reports = [
    { key: "delivery", title: "Delivery", rows: d.changes.map((c) => ({ key: c.key, title: c.title, status: c.status, stage: c.stageName, progress: c.progress, risk: c.risk, aiRuns: c.analytics.aiRunCount, tasks: c.analytics.taskCount, recoveries: c.analytics.recoveries })) },
    { key: "deployments", title: "Deployments", rows: d.deployments.map((x) => ({ application: x.applicationName, version: x.version, environment: x.environmentName, status: x.status, health: x.health, startedAt: x.startedAt })) },
    { key: "incidents", title: "Incidents", rows: d.incidents.map((i) => ({ key: i.key, title: i.title, severity: i.severity, status: i.status, rootCause: i.rootCause, selfHealed: i.selfHealed })) },
    { key: "agents", title: "Agent Health", rows: d.agents.map((a) => ({ name: a.name, status: a.status, version: a.version, cpu: a.health.cpu, memory: a.health.memory, latencyMs: a.health.latencyMs })) },
    { key: "ai", title: "AI Efficiency", rows: [{ aiRequests: d.summary.aiRequests, mcpCalls: d.summary.mcpCalls, aiCallsAvoided: d.summary.aiCallsAvoided, efficiencyScore: d.summary.efficiency.score, estimatedCostMyr: d.summary.aiCostMyr, redundantCalls: d.summary.redundantCalls }] },
    { key: "mcp", title: "MCP Usage", rows: d.summary.byPurpose },
    { key: "optimization", title: "Optimization Opportunities", rows: d.recs.map((r) => ({ title: r.title, evidence: r.evidence, reductionPct: r.estimatedReductionPct, status: r.status })) },
    { key: "security", title: "Security", rows: d.audit.filter((a) => a.risk === "HIGH" || a.risk === "CRITICAL" || a.result === "DENIED").map((a) => ({ at: a.timestamp, actor: a.actorName, action: a.action, resource: a.resourceLabel, result: a.result, risk: a.risk })) },
    { key: "jira", title: "Jira / Commitments", rows: d.changes.flatMap((c) => c.jira.map((j) => ({ change: c.key, key: j.key, type: j.type, title: j.title, status: j.status }))) },
    { key: "automation", title: "Automation", rows: d.changes.map((c) => ({ change: c.key, agentOperations: c.analytics.agentOperationCount, humanInterventions: c.analytics.humanInterventions, blocked: minutes(c.analytics.blockedMinutes) })) },
  ];
  const exp = (r: (typeof reports)[number], fmt: "csv" | "json") => { downloadFile(`supermcp-${r.key}-${new Date().toISOString().slice(0, 10)}.${fmt}`, fmt === "csv" ? toCsv(r.rows as Record<string, unknown>[]) : JSON.stringify(r.rows, null, 2), fmt === "csv" ? "text/csv" : "application/json"); toast(`${r.title} exported (${fmt.toUpperCase()})`, "success"); };
  return <div><PageHeader title="Reports" subtitle="Engineering reports with CSV / JSON export. PDF and Excel rendering plus scheduled email delivery arrive with the email adapter (Phase 3)." actions={<div className="d-flex gap-2 align-items-center"><select className="form-select form-select-sm w-auto" value={schedule} onChange={(e) => setSchedule(e.target.value)}>{["Daily", "Weekly", "Monthly", "Custom"].map((s) => <option key={s}>{s}</option>)}</select><button className="btn btn-sm btn-outline-secondary" onClick={() => toast(`${schedule} schedule needs the email adapter — coming soon`, "info")}>Schedule <StatusBadge status="COMING_SOON" label="soon" /></button></div>} />
    <div className="row g-3">{reports.map((r) => <div className="col-md-6 col-xl-4" key={r.key}><div className="panel h-100"><div className="panel-body"><div className="d-flex justify-content-between align-items-start"><div><div className="fw-semibold">{r.title}</div><div className="small text-secondary">{r.rows.length} rows · last 30 days</div></div><i className="bi bi-file-earmark-bar-graph text-secondary fs-5" /></div><div className="d-flex gap-1 mt-3"><button className="btn btn-sm btn-outline-secondary" onClick={() => exp(r, "csv")}>CSV</button><button className="btn btn-sm btn-outline-secondary" onClick={() => exp(r, "json")}>JSON</button><button className="btn btn-sm btn-outline-secondary" disabled title="Coming soon">PDF</button><button className="btn btn-sm btn-outline-secondary" disabled title="Coming soon">Excel</button></div></div></div></div>)}</div></div>;
}
