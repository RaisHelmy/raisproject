import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState, MetricCard, ComingSoon } from "@/components/Panels";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, ModeBadge } from "@/components/StatusBadge";
import { Chart } from "@/components/Charts";
import { timeAgo, fmtDate } from "@/utils/format";

export function Monitoring() {
  const { api } = useApp();
  const { data, loading, error } = useAsync(async () => ({ envs: await api.platform.environments(), servers: await api.platform.servers(), agents: await api.platform.agents(), deployments: await api.platform.deployments(), incidents: await api.platform.incidents() }), []);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  return <div><PageHeader title="Monitoring" subtitle="Environment, server and agent health from Agent heartbeats. Metrics ingestion from Prometheus/Datadog is a Phase 2 adapter." badge={<ModeBadge mode="DEMO" />} />
    <div className="row g-3 mb-3">{data.envs.map((e) => <div className="col-md-4" key={e.id}><MetricCard label={e.name} value={<StatusBadge status={e.health} />} hint={`${data.servers.filter((s) => s.environmentId === e.id).length} servers · agent ${data.agents.find((a) => a.id === e.agentId)?.status.toLowerCase() ?? "none"}`} /></div>)}</div>
    <div className="row g-3"><div className="col-lg-7"><Panel title="Agent resource pressure"><Chart options={{ chart: { type: "column" }, xAxis: { categories: data.agents.map((a) => a.name) }, yAxis: { max: 100, title: { text: "%" } }, series: [{ type: "column", name: "CPU", data: data.agents.map((a) => a.health.cpu) }, { type: "column", name: "Memory", data: data.agents.map((a) => a.health.memory) }, { type: "column", name: "Disk", data: data.agents.map((a) => a.health.disk) }] }} /></Panel></div>
      <div className="col-lg-5"><Panel title="Open incidents">{data.incidents.filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED").map((i) => <Link key={i.id} to={`/incidents/${i.id}`} className="list-row px-0 text-body" style={{ textDecoration: "none" }}><StatusBadge status={i.severity} /><div className="flex-grow-1"><div className="title">{i.key} {i.title}</div><div className="meta">{i.rootCause} · {timeAgo(i.createdAt)}</div></div><StatusBadge status={i.status} /></Link>)}{!data.incidents.some((i) => i.status !== "RESOLVED" && i.status !== "CLOSED") && <span className="text-secondary small">No open incidents.</span>}</Panel></div></div></div>;
}

export function Incidents() {
  const { api } = useApp();
  const nav = useNavigate();
  const { data, loading, error } = useAsync(() => api.platform.incidents(), []);
  if (loading) return <Loading />; if (error) return <ErrorState message={error} />;
  return <div><PageHeader title="Incidents" subtitle="Deployment → health check failed → paused → self-healing → retry → still failing → rollback → incident → Jira → owner notified." />
    <div className="panel"><DataTable rows={data ?? []} rowKey={(i) => i.id} onRowClick={(i) => nav(`/incidents/${i.id}`)} empty={<EmptyState icon="bi-exclamation-triangle" title="No incidents" body="Failures that self-healing cannot resolve become incidents here." />} columns={[{ key: "k", header: "Incident", render: (i) => <div><span className="mono text-secondary me-2">{i.key}</span><span className="fw-semibold">{i.title}</span><div className="small text-secondary">{i.summary}</div></div> }, { key: "s", header: "Severity", render: (i) => <StatusBadge status={i.severity} /> }, { key: "st", header: "Status", render: (i) => <StatusBadge status={i.status} /> }, { key: "rc", header: "Root cause", render: (i) => i.rootCause }, { key: "sh", header: "Self-healed", render: (i) => i.selfHealed ? <span className="text-success"><i className="bi bi-bandaid me-1" />yes</span> : <span className="text-secondary">no</span> }, { key: "j", header: "Jira", render: (i) => i.jiraKey ? <span className="mono">{i.jiraKey}</span> : "—" }, { key: "t", header: "Created", render: (i) => <span className="small text-secondary">{timeAgo(i.createdAt)}</span> }]} /></div></div>;
}

export function IncidentDetail() {
  const { id = "" } = useParams();
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.platform.incident(id), [id]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const { incident: i, task, change } = data;
  const diagnose = async () => { setBusy(true); try { const r = await api.tasks.create({ definitionId: "diagnose-incident", inputs: { incidentId: i.id }, name: `Diagnose ${i.key}`, environmentId: i.environmentId }); toast(`${r.task.key} created`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } };
  return <div><PageHeader title={`${i.key} ${i.title}`} badge={<><StatusBadge status={i.severity} /><StatusBadge status={i.status} />{i.selfHealed && <StatusBadge status="RECOVERED" label="self-healed" />}</>} subtitle={`Root cause: ${i.rootCause} · ${fmtDate(i.createdAt)}${i.resolvedAt ? ` · resolved ${fmtDate(i.resolvedAt)}` : ""}`} actions={<>{i.status !== "RESOLVED" && i.status !== "CLOSED" && can("task.create") && <button className="btn btn-primary" onClick={diagnose} disabled={busy}><i className="bi bi-search me-1" />Diagnose (deterministic first)</button>}{task && task.status === "ESCALATED" && <Link to={`/tasks/${task.id}`} className="btn btn-outline-secondary">Retry task</Link>}</>} />
    <div className="row g-3"><div className="col-lg-7"><Panel title="Summary"><p style={{ whiteSpace: "pre-wrap" }}>{i.summary}</p><div className="pipeline mt-3">{["Deployment", "Health check failed", "Workflow paused", "Self-healing", "Retry", i.selfHealed ? "Success" : "Still failing", ...(i.selfHealed ? [] : ["Rollback", "Incident created", "Jira updated", "Owner notified"])].map((s, k) => <div key={s}>{k > 0 && <div className="arrow">↓</div>}<span className={`node ${s === "Success" ? "good" : s.includes("failed") || s === "Still failing" ? "bad" : s === "Self-healing" ? "hot" : ""}`}>{s}</span></div>)}</div></Panel></div>
      <div className="col-lg-5"><Panel title="Links"><dl className="kv">{task && <><dt>Task</dt><dd><Link to={`/tasks/${task.id}`}>{task.key}</Link> <StatusBadge status={task.status} /></dd></>}{change && <><dt>Change</dt><dd><Link to={`/changes/${change.id}`}>{change.key} {change.title}</Link></dd></>}{i.deploymentId && <><dt>Deployment</dt><dd><Link to={`/deployments/${i.deploymentId}`}>view</Link></dd></>}{i.jiraKey && <><dt>Jira</dt><dd className="mono">{i.jiraKey} <ModeBadge mode="DEMO" /></dd></>}</dl></Panel>
        {i.status !== "RESOLVED" && i.status !== "CLOSED" && can("change.manage") && <div className="mt-3"><Panel title="Resolve"><textarea className="form-control mb-2" rows={2} placeholder="Resolution note" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn btn-success" disabled={busy || !note.trim()} onClick={async () => { setBusy(true); try { await api.platform.resolveIncident(i.id, note); toast("Incident resolved", "success"); reload(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } }}>Mark resolved</button></Panel></div>}</div></div></div>;
}

export function SelfHealing() {
  const { api } = useApp();
  const { data, loading, error } = useAsync(async () => ({ tasks: await api.tasks.list(), learning: await api.telemetry.learning(), incidents: await api.platform.incidents() }), []);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const healed = data.tasks.filter((t) => t.recoveryCount > 0);
  const byKind = { known: 0, retry: 0, alt: 0, rollback: 0, ai: 0 };
  for (const t of healed) for (const l of t.log) { const m = l.message.toLowerCase(); if (m.startsWith("recovery (known")) byKind.known++; else if (m.startsWith("recovery (retry")) byKind.retry++; else if (m.startsWith("recovery (alternative")) byKind.alt++; else if (m.includes("rolling back")) byKind.rollback++; else if (l.executionMode === "AI") byKind.ai++; }
  return <div><PageHeader title="Self-Healing" subtitle="Hierarchy: 1 known deterministic recovery → 2 retry → 3 alternative → 4 rollback → 5 AI diagnosis → 6 AI plan → 7 human approval → 8 escalation. AI is never called for known failures." />
    <div className="row g-3 mb-3">{[["Tasks with recoveries", healed.length], ["Self-healed incidents", data.incidents.filter((i) => i.selfHealed).length], ["Known recoveries applied", data.learning.knowledge.reduce((a, k) => a + k.applications, 0)], ["Escalated", data.tasks.filter((t) => t.status === "ESCALATED").length]].map(([l, v]) => <div className="col-6 col-md-3" key={String(l)}><MetricCard label={String(l)} value={v as number} /></div>)}</div>
    <div className="row g-3"><div className="col-lg-6"><Panel title="Recovery ladder usage"><Chart options={{ chart: { type: "bar" }, xAxis: { categories: ["Known recovery", "Retry", "Alternative", "Rollback", "AI diagnosis"] }, series: [{ type: "bar", name: "Recoveries", data: [byKind.known, byKind.retry, byKind.alt, byKind.rollback, byKind.ai] }] }} /></Panel></div>
      <div className="col-lg-6"><Panel title="Known recoveries (knowledge)">{data.learning.knowledge.filter((k) => k.type === "KNOWN_RECOVERY").map((k) => <div key={k.id} className="py-2 border-bottom"><div className="fw-semibold">{k.title}</div><div className="small text-secondary">{k.condition} → {k.resolution}</div><div className="small">Success rate <strong>{Math.round(k.successRate * 100)}%</strong> · applied {k.applications}×</div></div>)}</Panel></div>
      <div className="col-12"><Panel title="Recent healed tasks">{healed.slice(0, 10).map((t) => <Link key={t.id} to={`/tasks/${t.id}`} className="list-row px-0 text-body" style={{ textDecoration: "none" }}><i className="bi bi-bandaid text-warning" /><div className="flex-grow-1"><div className="title">{t.key} {t.name}</div><div className="meta">{t.recoveryCount} recovery action(s) · {t.rolledBack ? "rolled back" : "recovered"} · {timeAgo(t.createdAt)}</div></div><StatusBadge status={t.status} /></Link>)}</Panel></div></div></div>;
}

export function Diagnostics() {
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  const envs = useAsync(() => api.platform.environments(), []);
  const [busy, setBusy] = useState(false);
  const run = async (envId?: string) => { setBusy(true); try { const r = await api.tasks.create({ definitionId: "health-check", inputs: envId ? { environmentId: envId } : {}, environmentId: envId }); toast(`${r.task.key} queued`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } };
  return <div><PageHeader title="Diagnostics" subtitle="Server Doctor and Environment Doctor: check servers, containers and application endpoints via the Agent." actions={can("task.create") && <button className="btn btn-primary" onClick={() => run()} disabled={busy}><i className="bi bi-heart-pulse me-1" />Check all servers</button>} />
    <div className="row g-3">{(envs.data ?? []).map((e) => <div className="col-md-4" key={e.id}><Panel title={e.name}><StatusBadge status={e.health} /><div className="mt-3"><button className="btn btn-sm btn-outline-secondary" onClick={() => run(e.id)} disabled={busy}>Run health check</button></div></Panel></div>)}</div></div>;
}

export function Backups() {
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  const { data, loading, error } = useAsync(async () => ({ automations: (await api.platform.automations()).filter((a) => a.taskDefinitionId === "backup-database"), tasks: (await api.tasks.list()).filter((t) => t.type === "BACKUP"), envs: await api.platform.environments() }), []);
  if (loading) return <Loading />; if (error || !data) return <ErrorState message={error} />;
  const run = async (envId: string) => { try { const r = await api.tasks.create({ definitionId: "backup-database", inputs: { environmentId: envId }, environmentId: envId }); toast(`${r.task.key} queued`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } };
  return <div><PageHeader title="Backups" subtitle="Scheduled and on-demand database backups with integrity verification." />
    <div className="row g-3"><div className="col-lg-6"><Panel title="Schedules">{data.automations.length === 0 ? <ComingSoon title="Scheduled backups" body="Install PostgreSQL Backup from the marketplace to schedule backups." /> : data.automations.map((a) => <div key={a.id} className="list-row px-0"><i className="bi bi-clock-history text-secondary" /><div className="flex-grow-1"><div className="title">{a.name}</div><div className="meta">cron <code>{a.schedule}</code> · {a.runs} runs · last {a.lastRunAt ? timeAgo(a.lastRunAt) : "never"}</div></div><StatusBadge status={a.lastResult ?? "PENDING"} /></div>)}</Panel></div><div className="col-lg-6"><Panel title="Run now">{data.envs.map((e) => <div key={e.id} className="d-flex justify-content-between align-items-center py-2 border-bottom"><span>{e.name}</span>{can("database.backup") && <button className="btn btn-sm btn-outline-secondary" onClick={() => run(e.id)}>Backup</button>}</div>)}</Panel></div>
      <div className="col-12"><Panel title="Recent backup tasks">{data.tasks.length === 0 ? <span className="text-secondary small">No backups yet.</span> : data.tasks.map((t) => <Link key={t.id} to={`/tasks/${t.id}`} className="list-row px-0 text-body" style={{ textDecoration: "none" }}><div className="flex-grow-1"><div className="title">{t.key} {t.name}</div><div className="meta">{t.scheduledFor ? `scheduled ${fmtDate(t.scheduledFor)}` : timeAgo(t.createdAt)}</div></div><StatusBadge status={t.status} /></Link>)}</Panel></div></div></div>;
}
