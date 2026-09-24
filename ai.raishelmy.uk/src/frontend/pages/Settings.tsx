import { useEffect, useState } from "react";
import { api } from "../api";

interface S { settings: Record<string, string>; providers_configured: string[]; gateway_id: string; timezone: string; base_url: string; sso_configured: boolean; cost_sync_available: boolean }

export function SettingsPage() {
  const [s, setS] = useState<S | null>(null);
  const [form, setForm] = useState({ global_daily_usd: "", global_weekly_usd: "", global_monthly_usd: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => api<S>("/settings").then((d) => { setS(d); setForm({ global_daily_usd: d.settings.global_daily_usd ?? "", global_weekly_usd: d.settings.global_weekly_usd ?? "", global_monthly_usd: d.settings.global_monthly_usd ?? "" }); });
  useEffect(() => { load(); }, []);
  if (!s) return <div className="text-secondary">Loading…</div>;

  const save = async () => { await api("/settings", { method: "PUT", json: form }); setMsg("Saved."); load(); };
  const sync = async () => { setMsg("Syncing…"); try { const r = await api("/sync-costs", { method: "POST" }); setMsg(r.skipped ? `Skipped: ${r.skipped}` : `Scanned ${r.scanned} gateway logs, matched ${r.matched} requests.`); } catch (e) { setMsg((e as Error).message); } };
  const all = ["workers-ai", "anthropic", "openai", "openrouter", "google-ai-studio", "groq", "mistral", "deepseek"];

  return (
    <div className="row justify-content-center"><div className="col-lg-8">
      <h3>Settings</h3>
      {msg && <div className="alert alert-info py-2 small" onClick={() => setMsg(null)}>{msg}</div>}
      <div className="card mb-3"><div className="card-body">
        <h6>Global budget (all projects combined)</h6>
        <div className="row g-2">
          {(["global_daily_usd", "global_weekly_usd", "global_monthly_usd"] as const).map((k) => (
            <div className="col-md-4" key={k}><label className="form-label small text-capitalize">{k.split("_")[1]}</label>
              <div className="input-group"><span className="input-group-text">$</span><input type="number" min="0" className="form-control" placeholder="no cap" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div></div>
          ))}
        </div>
        <button className="btn btn-primary btn-sm mt-3" onClick={save}>Save</button>
        <div className="small text-secondary mt-2">Windows are computed in {s.timezone} (change <code>BUDGET_TIMEZONE</code> in wrangler.jsonc).</div>
      </div></div>

      <div className="card mb-3"><div className="card-body">
        <h6>Upstream</h6>
        <table className="table table-dark table-sm small mb-2">
          <tbody>
            <tr><td>Cloudflare AI Gateway</td><td className="mono">{s.gateway_id}</td></tr>
            <tr><td>Public base URL</td><td className="mono">{s.base_url}/v1</td></tr>
            <tr><td>Suite SSO</td><td>{s.sso_configured ? "configured" : <span className="text-warning">SAAS_SSO_SECRET not set</span>}</td></tr>
            <tr><td>Cost sync from Cloudflare logs</td><td>{s.cost_sync_available ? <>available <button className="btn btn-sm btn-outline-secondary ms-2" onClick={sync}>Sync now</button></> : <span className="text-warning">CLOUDFLARE_API_TOKEN not set</span>}</td></tr>
          </tbody>
        </table>
        <div className="small text-secondary mb-1">Providers with an upstream key (set as Worker secrets <code>&lt;PROVIDER&gt;_API_KEY</code>, or store keys in the gateway with BYOK and set <code>AI_GATEWAY_TOKEN</code>):</div>
        <div className="d-flex flex-wrap gap-1">{all.map((p) => <span key={p} className={`badge badge-provider ${s.providers_configured.includes(p) ? "text-bg-success" : "text-bg-secondary"}`}>{p}</span>)}</div>
        <div className="small text-secondary mt-3">Every upstream request carries <code>cf-aig-metadata</code> with <code>project</code>, <code>credential</code> and <code>request_id</code>, so you can also add Cloudflare-side spend-limit rules split by <code>project</code> in the AI Gateway dashboard as a second guard rail.</div>
      </div></div>
    </div></div>
  );
}
