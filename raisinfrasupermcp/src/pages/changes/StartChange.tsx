import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel } from "@/components/Panels";
import { ImpactMap } from "@/components/Journey";
import { StatusBadge } from "@/components/StatusBadge";
import type { ChangePlan } from "@/domain/ai/provider";
import type { ChangeImpact } from "@/domain/types";

const EXAMPLES = ["Add customer document upload to the claims portal.", "Upgrade the payment gateway SDK to 4.2 with 3DS2 support.", "Deploy Claims Portal v2.8 to Production.", "Redesign the customer profile page for mobile.", "Add two-factor login to the customer portal."];

export default function StartChange() {
  const { api, toast, session } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [intent, setIntent] = useState(params.get("intent") ?? "");
  const [plan, setPlan] = useState<ChangePlan | null>(null);
  const [aiRunId, setAiRunId] = useState<string>();
  const [provider, setProvider] = useState<{ provider: string; model: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [appId, setAppId] = useState("");
  const [envId, setEnvId] = useState("");
  const [version, setVersion] = useState("");
  const refs = useAsync(async () => ({ apps: await api.platform.applications(), envs: await api.platform.environments() }), []);
  const doPlan = async (text = intent) => { if (!text.trim()) return; setBusy(true); setError(undefined); try { const r = await api.changes.plan(text); setPlan(r.plan); setAiRunId(r.aiRunId); setProvider({ provider: r.provider, model: r.model }); const app = refs.data?.apps.find((a) => a.slug === r.plan.suggestedApplicationSlug); setAppId(app?.id ?? refs.data?.apps[0]?.id ?? ""); setEnvId(refs.data?.envs.find((e) => e.kind === r.plan.targetEnvironmentKind)?.id ?? ""); setVersion(r.plan.suggestedVersion ?? ""); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  useEffect(() => { if (params.get("intent") && refs.data && !plan) doPlan(params.get("intent")!); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refs.data]);
  const create = async () => { if (!plan) return; setBusy(true); try { const c = await api.changes.create({ ...plan, intent, applicationId: appId || undefined, targetEnvironmentId: envId || undefined, aiRunId, version: version || undefined }); toast(`${c.key} created. Requirements stage is active.`, "success"); nav(`/changes/${c.id}`); } catch (e) { setError(errorMessage(e)); setBusy(false); } };
  const setList = (k: "requirements" | "rollbackPlan" | "developmentTasks" | "testTasks", v: string) => setPlan((p) => p && { ...p, [k]: v.split("\n").filter((x) => x.trim()) });
  return <div>
    <PageHeader title="Start a Change" subtitle="What are you trying to change? AI proposes the plan; you stay in control before anything executes." />
    <div className="row g-3"><div className={plan ? "col-lg-5" : "col-lg-8"}>
      <Panel><label className="form-label fs-6" htmlFor="intent">What are you trying to change?</label>
        <textarea id="intent" className="form-control" rows={4} placeholder="e.g. Add customer document upload to the claims portal." value={intent} onChange={(e) => setIntent(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") doPlan(); }} />
        <div className="d-flex gap-2 mt-2 align-items-center flex-wrap"><button className="btn btn-primary" onClick={() => doPlan()} disabled={busy || intent.trim().length < 8}>{busy ? <><i className="bi bi-arrow-repeat spin me-1" />Planning…</> : <><i className="bi bi-stars me-1" />{plan ? "Re-plan" : "Plan with AI"}</>}</button><span className="small text-secondary">⌘⏎ to plan · AI: <StatusBadge status={session?.mode === "DEMO" ? "DEMO" : "CONNECTED"} label={provider ? `${provider.provider} · ${provider.model}` : session?.mode === "DEMO" ? "Demo planner" : "Platform AI"} /></span></div>
        {error && <div className="alert alert-danger mt-3 py-2 small">{error}</div>}
        {!plan && <div className="mt-3"><div className="panel-title mb-2">Try an example</div>{EXAMPLES.map((e) => <button key={e} className="btn btn-sm btn-outline-secondary me-2 mb-2" onClick={() => { setIntent(e); }}>{e}</button>)}</div>}
      </Panel>
      {!plan && <div className="mt-3 panel"><div className="panel-body"><div className="panel-title mb-2">What happens next</div><div className="pipeline">{["Understand intent", "Draft title, requirements, impact map", "Suggest Jira Epic / Stories / Tasks", "Generate checklist from impact", "Production readiness & approvals", "Deploy via Task Engine + Agent", "Live validation → UAT → close", "Record outcome → fewer AI calls next time"].map((s, i) => <div key={s}>{i > 0 && <div className="arrow">↓</div>}<span className={`node ${i === 0 ? "ai" : i === 5 ? "hot" : ""}`}>{s}</span></div>)}</div></div></div>}
    </div>
    {plan && <div className="col-lg-7">
      <Panel title={<span>AI plan <span className="text-secondary fw-normal text-lowercase">· confidence {Math.round(plan.confidence * 100)}% · editable</span></span>} actions={<button className="btn btn-primary" onClick={create} disabled={busy}>{busy && <i className="bi bi-arrow-repeat spin me-1" />}Start Change</button>}>
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label">Title</label><input className="form-control" value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label">Version (optional)</label><input className="form-control" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v2.9.0" /></div>
          <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} /></div>
          <div className="col-md-6"><label className="form-label">Application</label><select className="form-select" value={appId} onChange={(e) => setAppId(e.target.value)}><option value="">— none —</option>{refs.data?.apps.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.runtime})</option>)}</select></div>
          <div className="col-md-6"><label className="form-label">Target environment</label><select className="form-select" value={envId} onChange={(e) => setEnvId(e.target.value)}><option value="">— none —</option>{refs.data?.envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select><div className="form-text">{refs.data?.envs.find((e) => e.id === envId)?.kind === "PRODUCTION" ? "Production: approval required per policy." : "Non-production: automatic per platform policy."}</div></div>
          <div className="col-md-6"><div className="panel-title mb-2">Affected components</div><ImpactMap impacts={plan.impacts} editable onChange={(impacts: ChangeImpact[]) => setPlan({ ...plan, impacts })} /></div>
          <div className="col-md-6"><label className="form-label">Requirements (one per line)</label><textarea className="form-control" rows={7} value={plan.requirements.join("\n")} onChange={(e) => setList("requirements", e.target.value)} /></div>
          <div className="col-md-6"><div className="panel-title mb-2">Suggested Jira</div>{plan.jira.map((j) => <div key={j.key} className="small py-1 border-bottom"><span className="status tone-neutral me-2">{j.type}</span>{j.title}</div>)}</div>
          <div className="col-md-6"><label className="form-label">Development tasks</label><textarea className="form-control" rows={4} value={plan.developmentTasks.join("\n")} onChange={(e) => setList("developmentTasks", e.target.value)} /><label className="form-label mt-2">Test tasks</label><textarea className="form-control" rows={3} value={plan.testTasks.join("\n")} onChange={(e) => setList("testTasks", e.target.value)} /></div>
          <div className="col-md-6"><div className="panel-title mb-2">Deployment requirements</div><ul className="small ps-3">{plan.deploymentRequirements.map((d) => <li key={d}>{d}</li>)}</ul><div className="panel-title mb-2">Approval requirements</div><ul className="small ps-3">{plan.approvalRequirements.map((d) => <li key={d}>{d}</li>)}</ul></div>
          <div className="col-md-6"><label className="form-label">Rollback plan (one per line)</label><textarea className="form-control" rows={4} value={plan.rollbackPlan.join("\n")} onChange={(e) => setList("rollbackPlan", e.target.value)} /></div>
        </div>
      </Panel>
    </div>}</div>
  </div>;
}
