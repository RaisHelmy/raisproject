import { useState } from "react";
import { HORIZONS, RISKS, type QIAdvice, type QIHorizon, type QIInput, type QIRisk, advise, screeningPlan } from "../shared/quickInvest";
import { PRESET_BY_ID } from "../shared/library";
import { ruleOf, tplOf } from "../shared/combos";
import { SHARIAH_LABEL } from "../shared/shariah";
import { api, money } from "./api";
import { fromUSD, symbol, toUSD } from "./currency";
import { AssetIcon, ShariahBadge } from "./Watchlist";
import { DEMO, DEMO_OFFSET } from "./demo/clock";
import { toast } from "./toast";
import type { ScreenMsg } from "./screen.worker";

// ⚡ Quick Invest: choose horizon, amount, risk and Shariah-only → screen → plain-language advice → start a new session.

const VERDICT = {
  GOOD: { icon: "✅", title: "Good fit", cls: "good", text: "This combo matches what you asked for." },
  CAVEATS: { icon: "⚠️", title: "OK, with caveats", cls: "mid", text: "Workable — read the warnings before you start." },
  NOT_SUITABLE: { icon: "❌", title: "Not suitable", cls: "bad", text: "We don't recommend starting this as it stands." },
} as const;

function screen(inp: QIInput, onProgress: (p: number) => void) {
  const plan = screeningPlan(inp);
  return new Promise<{ advice: QIAdvice; total: number; markets: number }>((resolve) => {
    const w = new Worker(new URL("./screen.worker.ts", import.meta.url), { type: "module", name: DEMO ? `off:${DEMO_OFFSET}` : "screen" });
    w.onmessage = (e: MessageEvent<ScreenMsg>) => {
      if (e.data.type === "progress") onProgress(e.data.done / e.data.total);
      else { w.terminate(); resolve({ advice: advise(inp, e.data.results), total: plan.total, markets: new Set(plan.jobs.flatMap((j) => j.codes)).size }); }
    };
    w.postMessage({ jobs: plan.jobs });
  });
}

export function QuickInvest() {
  const [horizon, setHorizon] = useState<QIHorizon>("DAY");
  const [amount, setAmount] = useState(() => Math.round(fromUSD(46.6)));
  const [risk, setRisk] = useState<QIRisk>("BALANCED");
  const [shariah, setShariah] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [res, setRes] = useState<{ advice: QIAdvice; total: number; markets: number; inp: QIInput } | null>(null);
  const [starting, setStarting] = useState(false);

  const run = async () => {
    const inp: QIInput = { horizon, amountUSD: toUSD(amount), risk, shariah };
    setRes(null); setProgress(0);
    const r = await screen(inp, setProgress);
    setProgress(null); setRes({ ...r, inp });
  };
  const start = async (asNew: boolean) => {
    if (!res) return;
    const { advice, inp } = res;
    if (asNew && !confirm(`Start a new session with ${symbol()}${amount.toLocaleString()} and ${advice.picks.length} robots?\n\nYour current session will be stopped — its open trades still settle, and its history is kept.`)) return;
    setStarting(true);
    try {
      if (asNew) {
        const name = `Quick ${HORIZONS[inp.horizon].label.toLowerCase()} · ${RISKS[inp.risk].label}${inp.shariah ? " · ☪" : ""}`;
        await api("/api/sessions", { body: { name, deposit_usd: inp.amountUSD, notes: `Quick Invest: ${HORIZONS[inp.horizon].label}, ${RISKS[inp.risk].label}, ${inp.shariah ? "Shariah-only" : "all markets"} · advice: ${VERDICT[advice.verdict].title} (${advice.score}/100)` } });
      }
      let ok = 0;
      for (const p of advice.picks) {
        try { await api("/api/rules", { body: { ...p.cfg, name: `⚡ ${ruleOf(p.r).name} · ${p.r.code}`.slice(0, 60) } }); ok++; }
        catch (e) { toast.err((e as Error).message); }
      }
      window.dispatchEvent(new Event("rt:session"));
      toast.ok(`${asNew ? "New session started" : "Added to current session"} with ${ok} robot${ok === 1 ? "" : "s"}`);
    } catch (e) { toast.err((e as Error).message); }
    setStarting(false);
  };

  const v = res ? VERDICT[res.advice.verdict] : null;
  return (
    <div>
      <div className="mb-3"><h2 className="h4 fw-bold mb-1">⚡ Quick Invest</h2>
        <div className="small text-secondary">Tell us how long, how much and how careful — we screen every strategy on the fitting markets and tell you honestly whether the best combo suits you.</div></div>

      <div className="panel p-3 mb-3">
        <div className="step-title">1 · How long?</div>
        <div className="row g-2 mb-3">
          {(Object.keys(HORIZONS) as QIHorizon[]).map((k) => (
            <div className="col-sm-4" key={k}>
              <button className={`goal-card w-100 text-start ${horizon === k ? "active" : ""}`} onClick={() => setHorizon(k)}>
                <div className="d-flex align-items-center gap-2"><span className="goal-icon">{HORIZONS[k].icon}</span><b>{HORIZONS[k].label}</b></div>
                <div className="small text-secondary mt-1">{HORIZONS[k].desc}</div>
              </button>
            </div>
          ))}
        </div>
        <div className="row g-3 align-items-end">
          <div className="col-md-3"><div className="step-title">2 · How much?</div>
            <div className="input-group"><span className="input-group-text">{symbol()}</span><input className="form-control" type="number" min={10} value={amount} onChange={(e) => setAmount(Math.max(10, Number(e.target.value)))} /></div>
            <div className="d-flex gap-1 mt-1">{[200, 1000, 5000, 10000].map((x) => <button key={x} className="chip" onClick={() => setAmount(Math.round(fromUSD(toUSD(x))))}>{symbol()}{x.toLocaleString()}</button>)}</div></div>
          <div className="col-md-5"><div className="step-title">3 · How careful?</div>
            <div className="seg d-flex">{(Object.keys(RISKS) as QIRisk[]).map((k) => <button key={k} className={`flex-fill ${risk === k ? "active" : ""}`} title={RISKS[k].desc} onClick={() => setRisk(k)}>{RISKS[k].label}</button>)}</div>
            <div className="small text-secondary mt-1">{RISKS[risk].desc} · up to {RISKS[risk].robots} robots · target dip ≤ {RISKS[risk].maxDD}%</div></div>
          <div className="col-md-4"><div className="step-title">4 · Shariah</div>
            <label className="d-flex align-items-center gap-2"><span className="agg-switch"><input type="checkbox" checked={shariah} onChange={(e) => setShariah(e.target.checked)} /><span /></span>
              <span className="small"><b>☪ Shariah-compliant only</b><br /><span className="text-secondary">Stocks on the SC Shariah list / passing the Musaffa screen. No binary options.</span></span></label></div>
        </div>
        <div className="d-flex align-items-center gap-3 mt-3">
          <button className="btn btn-accent btn-lg px-4" disabled={progress != null} onClick={run}>{progress != null ? "Screening…" : "🔍 Screen & advise"}</button>
          {progress != null && <div className="flex-grow-1"><div className="small text-secondary mb-1">Backtesting every strategy on {screeningPlan({ horizon, amountUSD: toUSD(amount), risk, shariah }).stockCodes.length}+ markets… {Math.round(progress * 100)}%</div><div className="progress" style={{ height: 6 }}><div className="progress-bar bg-warning" style={{ width: `${progress * 100}%` }} /></div></div>}
        </div>
      </div>

      {res && v && (
        <div className="panel p-3">
          <div className={`qi-verdict ${v.cls} mb-3`}>
            <div className="d-flex align-items-center gap-3">
              <div className="qi-score">{res.advice.score}<small>/100</small></div>
              <div><div className="h5 fw-bold mb-0">{v.icon} {v.title}</div><div className="small">{v.text} Screened {res.total.toLocaleString()} strategy × market combinations on {res.markets} markets.</div></div>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-lg-5">
              <div className="step-title">Why</div>
              {res.advice.checks.map((c) => (
                <div key={c.title} className={`fee-check ${c.level === "ok" ? "good" : c.level === "warn" ? "mid" : "bad"} mb-1`}><b>{c.level === "ok" ? "✓" : c.level === "warn" ? "⚠" : "✕"} {c.title}.</b> {c.text}</div>
              ))}
              {res.advice.suggestions.length > 0 && <><div className="step-title mt-3">What would make it better</div>
                <ul className="small mb-0 ps-3">{res.advice.suggestions.map((s) => <li key={s}>{s}</li>)}</ul></>}
            </div>
            <div className="col-lg-7">
              <div className="step-title">Recommended combo ({res.advice.picks.length} robots)</div>
              {res.advice.picks.length ? (
                <div className="table-responsive"><table className="table table-sm small-table tabular mb-2 align-middle">
                  <thead><tr><th>Robot</th><th>Style</th><th className="text-end">Win</th><th className="text-end">Trades/day</th><th className="text-end">Position</th><th className="text-end">Costs</th><th>Shariah</th></tr></thead>
                  <tbody>{res.advice.picks.map((p) => (
                    <tr key={p.r.key}>
                      <td><AssetIcon code={p.r.code} size={20} /> {tplOf(p.r).icon} {ruleOf(p.r).name} <span className="text-secondary">· {p.r.code}</span> <span className={`badge ${p.r.verdict === "ROBUST" ? "text-bg-success" : "text-bg-info"}`}>{p.r.verdict === "ROBUST" ? "Consistent" : "Promising"}</span></td>
                      <td>{PRESET_BY_ID[p.r.preset]!.label}</td>
                      <td className="text-end">{(p.r.winRate * 100).toFixed(0)}%</td>
                      <td className="text-end">{p.perDay.toFixed(1)}</td>
                      <td className="text-end">{money(p.positionUSD)}{p.cfg.mode === "STOCK" ? <span className="text-secondary"> ({p.cfg.amount})</span> : null}</td>
                      <td className={`text-end ${p.costPct > 1 ? "text-down" : ""}`}>{p.cfg.mode === "STOCK" ? `${p.costPct.toFixed(2)}%` : "—"}</td>
                      <td><ShariahBadge code={p.r.code} mode={p.cfg.mode} /></td>
                    </tr>))}</tbody>
                </table></div>
              ) : <div className="text-secondary small py-3">No robot qualified — see the suggestions.</div>}
              <div className="d-flex flex-wrap gap-2 mt-2">
                <button className="btn btn-accent" disabled={starting || !res.advice.picks.length} onClick={() => start(true)}>{starting ? "Starting…" : `🚀 Start as new session with ${symbol()}${amount.toLocaleString()}`}</button>
                <button className="btn btn-outline-secondary" disabled={starting || !res.advice.picks.length} onClick={() => start(false)}>➕ Add to current session</button>
              </div>
              {res.advice.verdict === "NOT_SUITABLE" && res.advice.picks.length > 0 && <div className="small text-down mt-2">You can still start it, but we advise against it — see "Why".</div>}
              <div className="small text-secondary mt-2">Results come from backtests on RaisTrade's simulated market and include moomoo fees and spreads. Past results don't guarantee future returns. {SHARIAH_LABEL.compliant.long} status is an indication, not a fatwa.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
