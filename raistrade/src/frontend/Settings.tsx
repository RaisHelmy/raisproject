import { useEffect, useState } from "react";
import { api } from "./api";
import { toast } from "./toast";
import { CurrencyToggle } from "./currency";
import { ThemeToggle } from "./theme";
import { ScopeButton } from "./scope";

interface Cfg {
  bridge_url: string; token_set: boolean; token_hint: string | null; trd_env: "SIMULATE" | "REAL"; market: string; security_firm: string; acc_id: string;
  opend_host: string; opend_port: number; enabled: boolean; last_test: { ok: boolean; at: number; summary: string } | null;
}

const STEPS = [
  ["Install moomoo OpenD", <>Download <a href="https://www.moomoo.com/download/OpenAPI" target="_blank" rel="noreferrer">moomoo OpenD</a> on your PC or a small server, log in with your moomoo Malaysia account. It listens on port 11111.</>],
  ["Run the RaisTrade bridge", <>Download <a href="/moomoo-bridge.py" download>moomoo-bridge.py</a>, then:<pre className="settings-pre">{`pip install futu-api fastapi uvicorn
export BRIDGE_TOKEN=$(python -c "import secrets;print(secrets.token_urlsafe(32))")
echo $BRIDGE_TOKEN        # copy this into the form below
uvicorn moomoo-bridge:app --host 127.0.0.1 --port 8787`}</pre>(rename the file to <code>bridge.py</code> if your Python complains about the dash, and use <code>bridge:app</code>.)</>],
  ["Expose it over HTTPS", <>e.g. <code>cloudflared tunnel --url http://127.0.0.1:8787</code> and copy the <code>https://…trycloudflare.com</code> URL. Never expose it over plain http.</>],
  ["Connect", <>Paste the URL and token below, pick Simulate, and press <b>Test connection</b>.</>],
] as const;

export function Settings() {
  const [c, setC] = useState<Cfg | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; steps: { step: string; ok: boolean; detail: string }[] } | null>(null);
  useEffect(() => { api("/api/config/moomoo").then((r) => setC(r.data)).catch((e) => toast.err(e.message)); }, []);
  if (!c) return <div className="panel p-4 text-center text-secondary">Loading settings…</div>;
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setC({ ...c, [k]: v });
  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try { const r = await api("/api/config/moomoo", { body: { ...c, token: token || undefined, ...extra } }); setC(r.data); setToken(""); toast.ok("Saved"); return true; }
    catch (e) { toast.err((e as Error).message); return false; } finally { setBusy(false); }
  };
  const runTest = async () => {
    if (!(await save())) return;
    setBusy(true); setTest(null);
    try { const r = await api("/api/config/moomoo/test", { method: "POST" }); setTest(r); } catch (e) { toast.err((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="row g-3">
      <div className="col-xl-8">
        <div className="panel p-3">
          <div className="d-flex align-items-center gap-2 mb-1">
            <h5 className="fw-bold mb-0">🔌 moomoo OpenAPI connection</h5>
            <span className={`badge ms-auto ${c.last_test?.ok ? "text-bg-success" : c.bridge_url ? "text-bg-warning" : "text-bg-secondary"}`}>{c.last_test?.ok ? "● Connected" : c.bridge_url ? "Not verified" : "Not set up"}</span>
          </div>
          <div className="small text-secondary mb-3">RaisTrade talks to moomoo through <b>OpenD</b> running on your own machine, via a small bridge. Your moomoo login and trade password <b>never leave your machine</b> — RaisTrade only stores the bridge address and an access token (encrypted).</div>

          <div className="row g-2">
            <div className="col-md-8"><label className="form-label small text-secondary mb-1">Bridge URL (https)</label>
              <input className="form-control form-control-sm" placeholder="https://your-tunnel.trycloudflare.com" value={c.bridge_url} onChange={(e) => set("bridge_url", e.target.value)} /></div>
            <div className="col-md-4"><label className="form-label small text-secondary mb-1">Access token {c.token_set && <span className="text-up">· saved {c.token_hint}</span>}</label>
              <input className="form-control form-control-sm" type="password" autoComplete="new-password" placeholder={c.token_set ? "leave blank to keep" : "BRIDGE_TOKEN from step 2"} value={token} onChange={(e) => setToken(e.target.value)} /></div>
            <div className="col-6 col-md-3"><label className="form-label small text-secondary mb-1">Market</label>
              <select className="form-select form-select-sm" value={c.market} onChange={(e) => set("market", e.target.value)}>
                {[["US", "🇺🇸 US"], ["HK", "🇭🇰 HK"], ["MY", "🇲🇾 Bursa"], ["CN", "🇨🇳 A-shares"], ["SG", "🇸🇬 SG"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            <div className="col-6 col-md-3"><label className="form-label small text-secondary mb-1">Broker entity</label>
              <select className="form-select form-select-sm" value={c.security_firm} onChange={(e) => set("security_firm", e.target.value)}>
                {[["FUTUMY", "moomoo Malaysia"], ["FUTUSG", "moomoo Singapore"], ["FUTUINC", "moomoo US"], ["FUTUAU", "moomoo Australia"], ["FUTUSECURITIES", "Futu HK"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            <div className="col-6 col-md-3"><label className="form-label small text-secondary mb-1">Account ID (optional)</label>
              <input className="form-control form-control-sm" inputMode="numeric" placeholder="from Test connection" value={c.acc_id} onChange={(e) => set("acc_id", e.target.value)} /></div>
            <div className="col-6 col-md-3"><label className="form-label small text-secondary mb-1">OpenD (on bridge machine)</label>
              <div className="input-group input-group-sm"><input className="form-control" value={c.opend_host} onChange={(e) => set("opend_host", e.target.value)} /><input className="form-control" style={{ maxWidth: 80 }} type="number" value={c.opend_port} onChange={(e) => set("opend_port", Number(e.target.value))} /></div></div>
          </div>

          <div className="step-title mt-3">Trading environment</div>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <label className={`env-card ${c.trd_env === "SIMULATE" ? "active" : ""}`}><input type="radio" className="form-check-input m-0 me-2" checked={c.trd_env === "SIMULATE"} onChange={() => set("trd_env", "SIMULATE")} /><span><b>Simulate</b> — moomoo paper trading. Safe for testing.</span></label>
            <label className={`env-card real ${c.trd_env === "REAL" ? "active" : ""}`}><input type="radio" className="form-check-input m-0 me-2" checked={c.trd_env === "REAL"} onChange={() => confirm("Real-money trading uses your actual moomoo account. The bridge also has to be started with ALLOW_REAL=1. Continue?") && set("trd_env", "REAL")} /><span><b>Real money</b> — live orders. Only works if the bridge allows it.</span></label>
          </div>
          {c.trd_env === "REAL" && <div className="fee-check bad mb-2">⚠ Real money: losses are real. RaisTrade robots are tuned on a simulated market and may perform much worse live. Start with Simulate.</div>}

          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-accent" disabled={busy} onClick={runTest}>{busy ? "Working…" : "🔍 Save & test connection"}</button>
            <button className="btn btn-outline-secondary" disabled={busy} onClick={() => save()}>Save</button>
            {c.token_set && <button className="btn btn-outline-danger ms-auto" disabled={busy} onClick={() => confirm("Remove the saved access token?") && save({ clear_token: true })}>Forget token</button>}
          </div>

          {(test || c.last_test) && (
            <div className="mt-3">
              <div className="step-title">Connection check {c.last_test && <span className="text-secondary fw-normal">· {new Date(c.last_test.at).toLocaleString()}</span>}</div>
              {test ? test.steps.map((s) => <div key={s.step} className={`small ${s.ok ? "text-up" : "text-down"}`}>{s.ok ? "✓" : "✕"} <b>{s.step}</b> — <span className="text-secondary">{s.detail}</span></div>)
                : <div className="small text-secondary">{c.last_test!.summary}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="col-xl-4">
        <div className="panel p-3 mb-3">
          <h6 className="fw-bold">Setup in 4 steps</h6>
          <ol className="small ps-3 mb-0 settings-steps">{STEPS.map(([t, d]) => <li key={t}><b>{t}</b><div className="text-secondary">{d}</div></li>)}</ol>
        </div>
        <div className="panel p-3 mb-3">
          <h6 className="fw-bold">What's connected today</h6>
          <ul className="small text-secondary ps-3 mb-0">
            <li>Connection check, accounts, funds, positions and live quotes through the bridge.</li>
            <li>Robots still trade the RaisTrade simulator. Sending robot orders to moomoo is the next step and will start in <b>Simulate</b> only.</li>
            <li>The bridge refuses real-money orders unless you start it with <code>ALLOW_REAL=1</code> and your trade password set locally.</li>
          </ul>
        </div>
        <div className="panel p-3">
          <h6 className="fw-bold">Preferences</h6>
          <div className="d-flex flex-column gap-2 small">
            <div className="d-flex align-items-center justify-content-between">Display currency <CurrencyToggle /></div>
            <div className="d-flex align-items-center justify-content-between">Theme <ThemeToggle /></div>
            <div className="d-flex align-items-center justify-content-between">Markets shown <ScopeButton /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
