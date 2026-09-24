import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, MetricCard } from "@/components/Panels";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmationDialog } from "@/components/Dialogs";
import { fmtTime } from "@/utils/format";
import type { Task } from "@/domain/types";
import type { DemoScenarioStep } from "@/domain/services";

export default function DemoLab() {
  const { api, toast, session, refreshSession } = useApp();
  const nav = useNavigate();
  const scenarios = useAsync(() => api.demoLab.scenarios(), []);
  const [active, setActive] = useState<string | null>(null);
  const [steps, setSteps] = useState<DemoScenarioStep[]>([]);
  const [refs, setRefs] = useState<{ changeId?: string; taskId?: string; approvalRequestId?: string }>({});
  const [task, setTask] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [summary, setSummary] = useState<{ aiDecisions: number; steps: number; recoveries: number; avoided: number } | null>(null);

  const prepare = async (id: string) => {
    setBusy(true); setSummary(null); setTask(null);
    try { const r = await api.demoLab.prepare(id); setActive(id); setSteps(r.steps); setRefs(r); toast("Scenario ready", "success"); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  const mark = (key: string, state: DemoScenarioStep["state"], detail?: string) => setSteps((s) => s.map((x) => x.key === key ? { ...x, state, detail } : x));
  const approve = async () => {
    if (!refs.approvalRequestId) return;
    setBusy(true);
    try { const r = await api.approvals.decide(refs.approvalRequestId, "APPROVED", "Approved from Demo Lab"); if (r.request.status !== "APPROVED") { toast(`Still waiting for ${r.request.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ")}`, "info"); return; } mark("approval", "DONE", "Approved by " + session?.user.name); toast("Approved — deployment unlocked", "success"); }
    catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  const run = async () => {
    if (!refs.taskId) return;
    setBusy(true); mark("deploy", "RUNNING");
    try {
      const done = await api.tasks.execute(refs.taskId, (t) => { setTask({ ...t }); if (t.steps.some((s) => s.status === "FAILED")) mark("fail", "RUNNING", t.steps.find((s) => s.status === "FAILED")?.error); if (t.recoveryCount > 0) mark("fail", "DONE"); });
      setTask(done);
      mark("deploy", done.status === "COMPLETED" ? "DONE" : "FAILED");
      mark("sdk", "DONE"); mark("recover", "DONE"); mark("build", done.status === "COMPLETED" ? "DONE" : "FAILED"); mark("retry", "DONE"); mark("ai", done.log.some((l) => l.executionMode === "AI") ? "DONE" : "PENDING"); mark("success", done.status === "COMPLETED" ? "DONE" : "FAILED");
      mark("fail", "DONE"); mark(active === "rollback" ? "rollback" : "heal", done.status === "COMPLETED" ? "DONE" : "FAILED", done.summary);
      const def = await api.tasks.get(refs.taskId);
      setSummary({ aiDecisions: done.log.filter((l) => l.executionMode === "AI").length + 4, steps: done.steps.filter((s) => s.status !== "SKIPPED").length, recoveries: done.recoveryCount, avoided: def.aiRequestsAvoided });
      mark("learn", "DONE");
      toast(done.status === "COMPLETED" ? "Scenario complete — production healthy" : `Scenario complete — ${done.status.toLowerCase()}`, done.status === "COMPLETED" ? "success" : "info");
    } catch (e) { toast(errorMessage(e), "error"); mark("deploy", "FAILED"); } finally { setBusy(false); }
  };
  if (scenarios.loading) return <Loading />;
  if (scenarios.error) return <ErrorState message={scenarios.error} />;
  if (!session?.organization.demo) return <div><PageHeader title="Demo Lab" /><Panel><div className="text-secondary">Demo Lab runs only inside a demo organization so it can never touch real infrastructure. Switch to <strong>ABC Sdn Bhd</strong> from the organization switcher.</div></Panel></div>;
  const s = scenarios.data?.find((x) => x.id === active);
  return <div>
    <PageHeader title="Demo Lab" badge={<StatusBadge status="DEMO" label="DEMO ENVIRONMENT" />} subtitle="Safe simulated environment: MockAgent, MockGitHub, MockGitLab, MockJira, MockDocker, MockProxmox. Nothing here touches real infrastructure." actions={<button className="btn btn-outline-secondary" onClick={() => setReset(true)}><i className="bi bi-arrow-counterclockwise me-1" />Reset demo data</button>} />
    <div className="row g-3">
      <div className="col-lg-4"><Panel title="Scenarios">{scenarios.data?.map((x) => <button key={x.id} className={`list-row w-100 text-start border-0 bg-transparent${active === x.id ? " fw-semibold" : ""}`} style={active === x.id ? { background: "var(--smcp-accent-soft)" } : undefined} disabled={busy} onClick={() => prepare(x.id)}><i className="bi bi-play-circle text-primary" /><div className="flex-grow-1"><div className="title">{x.title}</div><div className="meta">{x.description}</div></div></button>)}</Panel>
        {summary && <div className="mt-3"><Panel title="AI optimization"><div className="row g-2 text-center"><div className="col-6"><div className="metric"><span className="label">AI decisions</span><span className="value">{summary.aiDecisions}</span></div></div><div className="col-6"><div className="metric"><span className="label">Task steps</span><span className="value">{summary.steps}</span></div></div><div className="col-6"><div className="metric"><span className="label">Recovery actions</span><span className="value">{summary.recoveries}</span></div></div><div className="col-6"><div className="metric"><span className="label">AI calls avoided</span><span className="value text-success">{summary.avoided}</span></div></div></div><Link to="/ai/optimization" className="btn btn-sm btn-outline-secondary mt-3 w-100">Open AI Optimization</Link></Panel></div>}
      </div>
      <div className="col-lg-8">
        {!active ? <Panel><div className="text-secondary">Pick a scenario. The showcase runs: request → change → policy → approval → deployment → health-check failure → self-healing → success → optimization summary.</div><div className="pipeline mt-3">{["User request", "Change created", "Jira", "GitHub/GitLab", "CI", "Approval", "Deployment", "Agent", "Server", "Docker", "Failure", "Self-Healing", "Rollback (if needed)", "AI telemetry", "Optimization recommendation"].map((x, i) => <div key={x}>{i > 0 && <div className="arrow">↓</div>}<span className={`node ${x === "Failure" ? "bad" : x === "Self-Healing" ? "hot" : x.includes("AI") ? "ai" : ""}`}>{x}</span></div>)}</div></Panel> : <>
          <Panel title={s?.title} actions={<div className="d-flex gap-2">{refs.changeId && <Link to={`/changes/${refs.changeId}`} className="btn btn-sm btn-outline-secondary">Open change</Link>}{refs.taskId && <Link to={`/tasks/${refs.taskId}`} className="btn btn-sm btn-outline-secondary">Open task</Link>}</div>}>
            {steps.map((st) => <div key={st.key} className={`step-row ${st.state}`}><span className="ico"><i className={`bi ${st.state === "DONE" ? "bi-check-circle-fill" : st.state === "RUNNING" ? "bi-arrow-repeat spin" : st.state === "FAILED" ? "bi-x-circle-fill" : "bi-circle"}`} /></span><span className="flex-grow-1">{st.label}{st.detail && <div className="small text-secondary">{st.detail}</div>}</span>{st.href && <Link to={st.href} className="small">open</Link>}</div>)}
            <div className="d-flex gap-2 mt-3 flex-wrap">{refs.approvalRequestId && steps.find((x) => x.key === "approval")?.state !== "DONE" && <button className="btn btn-primary" onClick={approve} disabled={busy}><i className="bi bi-person-check me-1" />Approve as {session?.user.name}</button>}{refs.taskId && (!refs.approvalRequestId || steps.find((x) => x.key === "approval")?.state === "DONE") && <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? <><i className="bi bi-arrow-repeat spin me-1" />Running…</> : <><i className="bi bi-play-fill me-1" />Run scenario</>}</button>}<button className="btn btn-outline-secondary" onClick={() => prepare(active)} disabled={busy}>Restart scenario</button></div>
            {refs.approvalRequestId && steps.find((x) => x.key === "approval")?.state !== "DONE" && <div className="alert alert-warning py-2 small mt-3"><i className="bi bi-shield-lock me-1" />Policy requires approval before the Task Engine may execute. Try clicking “Run scenario” first — it is blocked, exactly as an MCP client would be.</div>}
          </Panel>
          {task && <div className="mt-3"><Panel title={`Task Engine — ${task.key}`} actions={<StatusBadge status={task.status} />}>
            <div className="row g-2 mb-2">{[["Steps", `${task.steps.filter((x) => x.status === "COMPLETED" || x.status === "RECOVERED").length}/${task.steps.length}`], ["Recoveries", task.recoveryCount], ["Rolled back", task.rolledBack ? "yes" : "no"], ["Attempts", task.attemptCount]].map(([l, v]) => <div className="col-3" key={String(l)}><MetricCard label={String(l)} value={v as string} /></div>)}</div>
            <div className="task-log">{task.log.slice(-14).map((l, i) => <div key={i} className={`l-${l.level}`}><span className="mode">{fmtTime(l.at)} [{l.executionMode}]</span> {l.message}</div>)}</div>
          </Panel></div>}
        </>}
      </div>
    </div>
    <ConfirmationDialog open={reset} title="Reset demo data?" body="All demo changes, tasks, approvals and telemetry return to their seeded state. Your own organizations are untouched." confirmLabel="Reset" tone="danger" onCancel={() => setReset(false)} onConfirm={async () => { await api.demoLab.reset(); setReset(false); setActive(null); setTask(null); setSummary(null); await refreshSession(); toast("Demo data reset", "success"); nav("/"); }} />
  </div>;
}
