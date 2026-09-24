import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState, MetricCard } from "@/components/Panels";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, ExecMode } from "@/components/StatusBadge";
import { ConfirmationDialog } from "@/components/Dialogs";
import { timeAgo, fmtTime, ms } from "@/utils/format";
import type { Task, TaskDefinition } from "@/domain/types";

const STATES: { k: string; l: string }[] = [{ k: "active", l: "Active" }, { k: "scheduled", l: "Scheduled" }, { k: "completed", l: "Completed" }, { k: "failed", l: "Failed / Healing" }, { k: "all", l: "All" }];

export function TasksList() {
  const { api, can } = useApp();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "active";
  const nav = useNavigate();
  const { data, loading, error } = useAsync(() => api.tasks.list(status === "all" ? {} : { status: status as never }), [status]);
  return <div><PageHeader title="Tasks" subtitle="AI creates high-level tasks. The Task Engine performs deterministic execution with validation, retries, recovery and rollback." actions={can("task.create") && <Link to="/tasks/templates" className="btn btn-outline-secondary"><i className="bi bi-collection me-1" />Templates</Link>} />
    <div className="tabs-smcp">{STATES.map((s) => <button key={s.k} className={status === s.k ? "active" : ""} onClick={() => setParams({ status: s.k })}>{s.l}</button>)}</div>
    {loading ? <Loading /> : error ? <ErrorState message={error} /> : <div className="panel"><DataTable rows={data ?? []} rowKey={(t) => t.id} onRowClick={(t) => nav(`/tasks/${t.id}`)} empty={<EmptyState icon="bi-gear" title={status === "failed" ? "No failed or healing tasks" : status === "scheduled" ? "No scheduled tasks" : "No tasks"} body="Tasks are created from Changes, the command center, automations, or MCP tools." action={<Link to="/tasks/templates" className="btn btn-sm btn-outline-secondary">Browse templates</Link>} />} columns={[
      { key: "key", header: "Task", render: (t) => <div><span className="mono text-secondary me-2">{t.key}</span><span className="fw-semibold">{t.name}</span><div className="small text-secondary">{t.definitionId} v{t.definitionVersion}{t.changeId && <Link className="ms-2" to={`/changes/${t.changeId}`} onClick={(e) => e.stopPropagation()}>change</Link>}</div></div> },
      { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
      { key: "risk", header: "Risk", render: (t) => <StatusBadge status={t.risk} /> },
      { key: "mode", header: "Origin", render: (t) => <ExecMode mode={t.executionMode} /> },
      { key: "steps", header: "Steps", render: (t) => <span className="small">{t.steps.filter((s) => s.status === "COMPLETED" || s.status === "RECOVERED").length}/{t.steps.length}{t.recoveryCount > 0 && <span className="text-warning ms-2" title="Recovery actions"><i className="bi bi-bandaid" /> {t.recoveryCount}</span>}{t.rolledBack && <span className="text-danger ms-2"><i className="bi bi-arrow-counterclockwise" /> rolled back</span>}</span> },
      { key: "when", header: "When", render: (t) => <span className="small text-secondary">{t.scheduledFor ? `scheduled ${timeAgo(t.scheduledFor)}` : timeAgo(t.createdAt)}</span> },
    ]} /></div>}
  </div>;
}

export function TaskDetail() {
  const { id = "" } = useParams();
  const { api, toast, can } = useApp();
  const { data, loading, error, reload, setData } = useAsync(() => api.tasks.get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} action={<Link to="/tasks" className="btn btn-sm btn-outline-secondary">Back to tasks</Link>} />;
  const { task: t, definition: def, deployment } = data;
  const execute = async () => { setBusy(true); try { await api.tasks.execute(t.id, (u) => setData((d) => d && { ...d, task: u })); const done = await api.tasks.get(id); setData(done); toast(done.task.status === "COMPLETED" ? done.task.summary ?? "Completed" : `Task ${done.task.status.toLowerCase()}: ${done.task.summary ?? done.task.error ?? ""}`, done.task.status === "COMPLETED" ? "success" : "error"); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); reload(true); } };
  const canRun = ["QUEUED", "ESCALATED"].includes(t.status) || (t.status === "WAITING_APPROVAL" && false);
  const pendingApproval = t.status === "WAITING_APPROVAL";
  return <div>
    <PageHeader title={<span><span className="mono text-secondary fw-normal me-2">{t.key}</span>{t.name}</span>} badge={<><StatusBadge status={t.status} /><StatusBadge status={t.risk} /><ExecMode mode={t.executionMode} /></>} subtitle={<span>{def?.name} v{t.definitionVersion} · created {timeAgo(t.createdAt)}{t.changeId && <> · <Link to={`/changes/${t.changeId}`}>View change</Link></>}{t.aiRunId && <> · <Link to={`/ai/usage/${t.aiRunId}`}>AI trace</Link></>}</span>}
      actions={<>{pendingApproval && t.approvalRequestId && <Link to={`/approvals/${t.approvalRequestId}`} className="btn btn-warning"><i className="bi bi-hourglass-split me-1" />Waiting for approval</Link>}{canRun && can("task.execute") && <button className="btn btn-primary" onClick={execute} disabled={busy}>{busy ? <><i className="bi bi-arrow-repeat spin me-1" />Running…</> : t.status === "ESCALATED" ? "Retry task" : "Execute"}</button>}{["QUEUED", "WAITING_APPROVAL", "ESCALATED"].includes(t.status) && can("task.cancel") && <button className="btn btn-outline-secondary" onClick={() => setConfirmCancel(true)} disabled={busy}>Cancel</button>}</>} />
    {t.status === "ESCALATED" && <div className="error-state mb-3"><h4>Escalated — a human decision is needed</h4><div>{t.summary ?? t.error}</div><div className="small mt-1 text-secondary">Self-healing hierarchy exhausted: known recovery → retry → alternative → rollback{t.log.some((l) => l.executionMode === "AI") ? " → AI diagnosis" : ""}. Fix the root cause and retry, or cancel.</div></div>}
    {t.policyDecision && t.status === "WAITING_APPROVAL" && <div className="alert alert-warning py-2 small"><i className="bi bi-shield-lock me-1" />{t.policyDecision.explanation.slice(-1)[0]} Execution is locked until the approval is granted — it cannot be bypassed from here or from MCP.</div>}
    <div className="row g-3">
      <div className="col-lg-8">
        <Panel title={`Steps (${t.steps.filter((s) => s.status !== "SKIPPED").length})`}>{t.steps.length === 0 ? <div className="text-secondary small">Not started. Planned steps: {def?.steps.map((s) => s.name).join(" → ")}</div> : t.steps.map((s) => <div key={s.id} className={`step-row ${s.status}`}><span className="seq">{s.sequence}</span><span className="ico"><i className={`bi ${s.status === "RUNNING" ? "bi-arrow-repeat spin" : s.status === "COMPLETED" ? "bi-check-circle-fill" : s.status === "FAILED" ? "bi-x-circle-fill" : s.status === "RECOVERED" ? "bi-bandaid-fill" : s.status === "SKIPPED" ? "bi-dash-circle" : "bi-circle"}`} /></span><span className="flex-grow-1">{s.name}{s.error && <div className="small text-danger">{s.error}</div>}{s.recoveryAction && <div className="small text-warning">Recovery: {s.recoveryAction}</div>}{s.output && <div className="small text-secondary mono">{s.output}</div>}</span><ExecMode mode={s.executionMode} /><span className="small text-secondary" style={{ minWidth: 60, textAlign: "right" }}>{s.status === "SKIPPED" ? "skipped" : ms(s.durationMs)}</span></div>)}</Panel>
        <div className="mt-3"><Panel title="Execution log"><div className="task-log">{t.log.length === 0 ? <span className="mode">No log entries.</span> : t.log.map((l, i) => <div key={i} className={`l-${l.level}`}><span className="mode">{fmtTime(l.at)} [{l.executionMode}]</span> {l.message}</div>)}</div></Panel></div>
      </div>
      <div className="col-lg-4">
        <div className="row g-2 mb-3"><div className="col-6"><MetricCard label="Recovery actions" value={t.recoveryCount} hint={t.rolledBack ? "Rolled back" : undefined} tone={t.recoveryCount ? "warning" : undefined} /></div><div className="col-6"><MetricCard label="AI requests avoided" value={data.aiRequestsAvoided} hint={def ? `${def.aiDecisionsWithoutEngine} without Task Engine` : undefined} tone="success" /></div></div>
        {t.policyDecision && <Panel title="Policy decision"><dl className="kv"><dt>Result</dt><dd><StatusBadge status={t.policyDecision.result === "AUTO" ? "APPROVED" : t.policyDecision.result} label={t.policyDecision.result} /></dd><dt>Risk</dt><dd><StatusBadge status={t.policyDecision.risk} /></dd>{t.policyDecision.requiredApprovals > 0 && <><dt>Approvals</dt><dd>{t.policyDecision.requiredApprovals} ({t.policyDecision.strategy}) from {t.policyDecision.approvers.map((a) => a.label).join(", ")}</dd></>}<dt>Matched</dt><dd>{t.policyDecision.matchedPolicies.map((p) => <div key={p.id} className="small">{p.name} <span className="text-secondary">v{p.version}</span></div>)}</dd></dl></Panel>}
        <div className="mt-3"><Panel title="Inputs"><dl className="kv">{Object.entries(t.inputs).map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd className="mono">{String(v)}</dd></div>)}{t.environmentId && <><dt>Environment</dt><dd><Link to="/infrastructure/environments">{t.environmentId}</Link></dd></>}{t.agentId && <><dt>Agent</dt><dd><Link to={`/agents/${t.agentId}`}>{t.agentId}</Link></dd></>}</dl></Panel></div>
        {deployment && <div className="mt-3"><Panel title="Deployment"><dl className="kv"><dt>Version</dt><dd className="mono">{deployment.version} <span className="text-secondary">(was {deployment.previousVersion ?? "—"})</span></dd><dt>Status</dt><dd><StatusBadge status={deployment.status} /></dd><dt>Health</dt><dd><StatusBadge status={deployment.health} /></dd></dl>{deployment.healthChecks.map((h, i) => <div key={i} className="small d-flex justify-content-between"><span>{h.name}</span><StatusBadge status={h.status} /></div>)}<Link to={`/deployments/${deployment.id}`} className="btn btn-sm btn-outline-secondary mt-2">View deployment</Link></Panel></div>}
        {def && <div className="mt-3"><Panel title="Definition"><div className="small text-secondary mb-2">{def.description}</div><dl className="kv small"><dt>Preconditions</dt><dd>{def.preconditions.join("; ")}</dd><dt>Validators</dt><dd>{def.validators.join("; ")}</dd><dt>Recovery</dt><dd>{def.recoveryStrategies.map((r) => `${r.kind.toLowerCase().replace("_", " ")}: ${r.name}`).join("; ")}</dd><dt>Rollback</dt><dd>{def.rollback.join(" → ") || "—"}</dd><dt>Permissions</dt><dd className="mono">{def.permissions.join(", ")}</dd></dl></Panel></div>}
      </div>
    </div>
    <ConfirmationDialog open={confirmCancel} title="Cancel task?" body="The task and any pending approval will be cancelled. This is audited." confirmLabel="Cancel task" tone="danger" busy={busy} onCancel={() => setConfirmCancel(false)} onConfirm={async () => { setBusy(true); try { await api.tasks.cancel(t.id); toast("Task cancelled", "success"); setConfirmCancel(false); reload(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } }} />
  </div>;
}

export function TaskTemplates() {
  const { api, toast, can } = useApp();
  const nav = useNavigate();
  const defs = useAsync(() => api.tasks.definitions(), []);
  const refs = useAsync(async () => ({ envs: await api.platform.environments(), apps: await api.platform.applications() }), []);
  const [sel, setSel] = useState<TaskDefinition | null>(null);
  const [inputs, setInputs] = useState<Record<string, string | number | boolean>>({});
  const [envId, setEnvId] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => { if (!sel) return; setBusy(true); try { const app = refs.data?.apps.find((a) => a.id === inputs.applicationId); const r = await api.tasks.create({ definitionId: sel.id, inputs: { ...inputs, ...(envId ? { environmentId: envId } : {}) }, environmentId: envId || (inputs.environmentId as string) || undefined, applicationId: app?.id }); toast(r.approvalRequestId ? `${r.task.key} created — approval required` : `${r.task.key} created`, "success"); nav(`/tasks/${r.task.id}`); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } };
  if (defs.loading) return <Loading />;
  return <div><PageHeader title="Task templates" subtitle="Versioned deterministic task definitions. Every execution retains the exact version used." />
    <div className="row g-3"><div className="col-lg-7"><div className="panel">{(defs.data ?? []).map((d) => <button key={d.id} className={`list-row w-100 text-start border-0 bg-transparent${sel?.id === d.id ? " fw-semibold" : ""}`} style={sel?.id === d.id ? { background: "var(--smcp-accent-soft)" } : undefined} onClick={() => { setSel(d); setInputs({}); setEnvId(""); }}><i className="bi bi-gear text-secondary" /><div className="flex-grow-1"><div className="title">{d.name} <span className="text-secondary fw-normal small">v{d.version}</span></div><div className="meta">{d.description}</div></div><StatusBadge status={d.riskLevel} /><span className="small text-secondary text-nowrap" title="AI decisions without / with Task Engine">{d.aiDecisionsWithoutEngine} → {d.aiDecisionsWithEngine} AI</span></button>)}</div></div>
      <div className="col-lg-5">{sel ? <Panel title={`Run ${sel.name}`}><div className="small text-secondary mb-3">{sel.approvalRequirements}. Permissions: <code>{sel.permissions.join(", ")}</code></div>
        {sel.inputs.map((i) => <div className="mb-2" key={i.name}><label className="form-label">{i.name}{i.required && " *"}</label>{i.name === "environmentId" ? <select className="form-select" value={envId} onChange={(e) => { setEnvId(e.target.value); setInputs({ ...inputs, environmentId: e.target.value }); }}><option value="">Select…</option>{refs.data?.envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select> : i.name === "applicationId" ? <select className="form-select" value={String(inputs.applicationId ?? "")} onChange={(e) => setInputs({ ...inputs, applicationId: e.target.value })}><option value="">Select…</option>{refs.data?.apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select> : i.type === "select" ? <select className="form-select" value={String(inputs[i.name] ?? "")} onChange={(e) => setInputs({ ...inputs, [i.name]: e.target.value })}><option value="">Select…</option>{i.options?.map((o) => <option key={o}>{o}</option>)}</select> : i.type === "boolean" ? <div className="form-check"><input type="checkbox" className="form-check-input" id={i.name} checked={Boolean(inputs[i.name])} onChange={(e) => setInputs({ ...inputs, [i.name]: e.target.checked })} /><label htmlFor={i.name} className="form-check-label">Yes</label></div> : <input className="form-control" type={i.type === "number" ? "number" : "text"} value={String(inputs[i.name] ?? "")} onChange={(e) => setInputs({ ...inputs, [i.name]: i.type === "number" ? Number(e.target.value) : e.target.value })} />}</div>)}
        {!sel.inputs.some((i) => i.name === "environmentId") && <div className="mb-2"><label className="form-label">Environment (for policy evaluation)</label><select className="form-select" value={envId} onChange={(e) => setEnvId(e.target.value)}><option value="">— none —</option>{refs.data?.envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
        <div className="panel-title mt-3 mb-1">Steps</div><ol className="small ps-3">{sel.steps.map((s) => <li key={s.id}>{s.name}{s.capability && <span className="text-secondary"> · {s.capability}</span>}</li>)}</ol>
        <button className="btn btn-primary mt-2" onClick={create} disabled={busy || !can("task.create")}>{busy && <i className="bi bi-arrow-repeat spin me-1" />}Create task</button>
      </Panel> : <Panel><EmptyState icon="bi-collection" title="Select a template" body="Templates are the deterministic ‘hands’ of Super MCP. AI picks one; the engine runs it." /></Panel>}</div></div></div>;
}
