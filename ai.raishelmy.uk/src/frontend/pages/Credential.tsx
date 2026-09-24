import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fmtInt, fmtTime, money, type Alias, type Credential, type Model, type Project } from "../api";
import { BudgetBar } from "../components/BudgetBar";
import { ConfigSnippets } from "../components/ConfigSnippets";
import { KeyReveal } from "../components/KeyReveal";

interface Usage { days: number; daily: { day: string; cost: number; cf_cost: number; requests: number; input_tokens: number; output_tokens: number }[]; by_model: { model: string; provider: string; cost: number; requests: number; input_tokens: number; output_tokens: number; errors: number }[]; recent: any[] }

export function CredentialPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [cred, setCred] = useState<Credential | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [catalog, setCatalog] = useState<{ models: Model[]; aliases: Alias[] }>({ models: [], aliases: [] });
  const [rotated, setRotated] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Omit<Credential, "daily_usd" | "weekly_usd" | "monthly_usd" | "requests_per_minute">> & { daily_usd?: any; weekly_usd?: any; monthly_usd?: any; requests_per_minute?: any }>({});

  const load = () => Promise.all([api(`/keys/${id}`), api(`/keys/${id}/usage?days=30`), api("/catalog")]).then(([k, u, c]) => { setCred(k.credential); setProject(k.project); setUsage(u); setCatalog(c); setEdit({}); });
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [id]);

  const options = useMemo(() => [...catalog.aliases.map((a) => a.name), ...catalog.models.filter((m) => m.enabled).map((m) => m.id)], [catalog]);
  if (!cred || !usage) return <div className="text-secondary">{msg ?? "Loading…"}</div>;

  const val = <K extends keyof Credential>(k: K) => (k in edit ? (edit as any)[k] : cred[k]);
  const save = async () => {
    try { await api(`/keys/${id}`, { method: "PATCH", json: edit }); setMsg("Saved."); await load(); } catch (e) { setMsg((e as Error).message); }
  };
  const toggleEnabled = async () => { await api(`/keys/${id}`, { method: "PATCH", json: { enabled: !cred.enabled } }); load(); };
  const rotate = async () => {
    if (!confirm("Rotate this credential? The current key stops working immediately.")) return;
    const r = await api<{ key: string }>(`/keys/${id}/rotate`, { method: "POST" }); setRotated(r.key); load();
  };
  const del = async () => {
    if (!confirm("Delete this credential and its usage history?")) return;
    await api(`/keys/${id}`, { method: "DELETE" }); nav("/");
  };
  const toggleAllowed = (m: string) => { const cur: string[] = val("allowed_models") ?? []; setEdit({ ...edit, allowed_models: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] }); };
  const maxCost = Math.max(0.0001, ...usage.daily.map((d) => d.cost));
  const totalCf = usage.daily.reduce((a, d) => a + (d.cf_cost || 0), 0);
  const total = usage.daily.reduce((a, d) => a + d.cost, 0);

  return (
    <>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <div className="small text-secondary"><Link to="/">Dashboard</Link> / {project?.name}</div>
          <h3 className="mb-0">{cred.name} <span className={`badge ${cred.enabled ? "text-bg-success" : "text-bg-secondary"}`}>{cred.enabled ? "Active" : "Disabled"}</span></h3>
          <div className="mono text-secondary">{cred.masked} · created {fmtTime(cred.created_at)} · last used {fmtTime(cred.last_used_at)}{cred.expires_at ? ` · expires ${fmtTime(cred.expires_at)}` : ""}</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={toggleEnabled}>{cred.enabled ? "Disable" : "Enable"}</button>
          <button className="btn btn-outline-warning btn-sm" onClick={rotate}>Rotate key</button>
          <button className="btn btn-outline-danger btn-sm" onClick={del}>Delete</button>
        </div>
      </div>
      {msg && <div className="alert alert-info py-2 small" onClick={() => setMsg(null)}>{msg}</div>}
      {rotated && <KeyReveal apiKey={rotated} model={cred.default_model} onDone={() => setRotated(null)} />}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card mb-3"><div className="card-body">
            <h6>Budget</h6>
            <BudgetBar label="Today" spent={cred.spend.day} limit={cred.daily_usd} />
            <BudgetBar label="This week" spent={cred.spend.week} limit={cred.weekly_usd} />
            <BudgetBar label="This month" spent={cred.spend.month} limit={cred.monthly_usd} />
          </div></div>

          <div className="card mb-3"><div className="card-body">
            <div className="d-flex justify-content-between"><h6>Last 30 days</h6><span className="small text-secondary">estimate {money(total)}{totalCf > 0 && <> · Cloudflare {money(totalCf)}</>}</span></div>
            {usage.daily.length === 0 ? <div className="text-secondary small">No requests yet.</div> : (
              <>
                <div className="bar" title="Daily cost">{usage.daily.map((d) => <div key={d.day} style={{ height: `${Math.max(2, (d.cost / maxCost) * 100)}%` }} title={`${d.day}: ${money(d.cost)} · ${d.requests} req`} />)}</div>
                <div className="d-flex justify-content-between small text-secondary"><span>{usage.daily[0]?.day}</span><span>{usage.daily[usage.daily.length - 1]?.day}</span></div>
              </>
            )}
            {usage.by_model.length > 0 && (
              <table className="table table-sm table-dark mt-3 mb-0 small">
                <thead><tr><th>Model</th><th className="text-end">Requests</th><th className="text-end">Errors</th><th className="text-end">Tokens in/out</th><th className="text-end">Cost</th></tr></thead>
                <tbody>{usage.by_model.map((m) => <tr key={m.model}><td className="mono">{m.model}</td><td className="text-end">{fmtInt(m.requests)}</td><td className="text-end">{fmtInt(m.errors)}</td><td className="text-end">{fmtInt(m.input_tokens)} / {fmtInt(m.output_tokens)}</td><td className="text-end">{money(m.cost)}</td></tr>)}</tbody>
              </table>
            )}
          </div></div>

          <div className="card mb-3"><div className="card-body">
            <h6>Recent requests</h6>
            {usage.recent.length === 0 ? <div className="text-secondary small">Nothing yet.</div> : (
              <div className="table-responsive"><table className="table table-sm table-dark small mb-0">
                <thead><tr><th>Time</th><th>Requested → used</th><th className="text-end">In/out</th><th className="text-end">Cost</th><th className="text-end">ms</th><th>Status</th></tr></thead>
                <tbody>{usage.recent.map((r) => (
                  <tr key={r.id} title={r.error ?? ""}>
                    <td className="text-nowrap">{new Date(r.created_at * 1000).toLocaleString()}</td>
                    <td className="mono">{r.requested_model}{r.requested_model !== r.model && <> → {r.model}</>}{r.streamed ? <span className="text-secondary"> (stream)</span> : null}</td>
                    <td className="text-end">{fmtInt(r.input_tokens)}/{fmtInt(r.output_tokens)}</td>
                    <td className="text-end">{money(r.cost_usd)}{r.cf_cost_usd !== null && r.cf_cost_usd !== undefined ? <span className="text-secondary"> ({money(r.cf_cost_usd)})</span> : null}</td>
                    <td className="text-end">{r.latency_ms}</td>
                    <td><span className={`badge ${r.status < 400 ? "text-bg-success" : "text-bg-danger"}`}>{r.status}</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div></div>
        </div>

        <div className="col-lg-5">
          <div className="card mb-3"><div className="card-body">
            <h6>Connect an app</h6>
            <div className="small text-secondary mb-2">The key itself is only shown at creation/rotation — paste your saved key over the placeholder.</div>
            <ConfigSnippets apiKey={`${cred.key_prefix}…`} model={cred.default_model} />
          </div></div>

          <div className="card"><div className="card-body">
            <h6>Settings</h6>
            <label className="form-label small">Name</label>
            <input className="form-control form-control-sm" value={val("name")} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <div className="row g-2 mt-1">
              {(["daily_usd", "weekly_usd", "monthly_usd"] as const).map((k) => (
                <div className="col-4" key={k}><label className="form-label small text-capitalize">{k.split("_")[0]}</label>
                  <div className="input-group input-group-sm"><span className="input-group-text">$</span><input type="number" min="0" step="0.5" className="form-control" placeholder="none" value={val(k) ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value || null })} /></div></div>
              ))}
            </div>
            <label className="form-label small mt-2">When limit reached</label>
            <select className="form-select form-select-sm" value={val("on_limit")} onChange={(e) => setEdit({ ...edit, on_limit: e.target.value as any })}><option value="block">Block requests (429)</option><option value="fallback">Use fallback model</option></select>
            <label className="form-label small mt-2">Allowed models (none ticked = all)</label>
            <div style={{ maxHeight: 180, overflow: "auto" }} className="border border-secondary-subtle rounded p-2">
              {options.map((m) => <div className="form-check" key={m}><input className="form-check-input" type="checkbox" id={`a-${m}`} checked={(val("allowed_models") ?? []).includes(m)} onChange={() => toggleAllowed(m)} /><label className="form-check-label small mono" htmlFor={`a-${m}`}>{m}</label></div>)}
            </div>
            <div className="row g-2 mt-1">
              <div className="col-6"><label className="form-label small">Default model</label><select className="form-select form-select-sm" value={val("default_model")} onChange={(e) => setEdit({ ...edit, default_model: e.target.value })}>{options.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div className="col-6"><label className="form-label small">Fallback model</label><select className="form-select form-select-sm" value={val("fallback_model") ?? ""} onChange={(e) => setEdit({ ...edit, fallback_model: e.target.value || null })}><option value="">— none —</option>{options.map((m) => <option key={m}>{m}</option>)}</select></div>
              <div className="col-6"><label className="form-label small">Requests / minute</label><input type="number" min="1" className="form-control form-control-sm" placeholder="unlimited" value={val("requests_per_minute") ?? ""} onChange={(e) => setEdit({ ...edit, requests_per_minute: e.target.value || null })} /></div>
              <div className="col-6"><label className="form-label small">Expires</label><input type="date" className="form-control form-control-sm" value={val("expires_at") ? new Date(val("expires_at")! * 1000).toISOString().slice(0, 10) : ""} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null })} /></div>
            </div>
            <button className="btn btn-primary btn-sm mt-3" onClick={save} disabled={Object.keys(edit).length === 0}>Save changes</button>
          </div></div>
        </div>
      </div>
    </>
  );
}
