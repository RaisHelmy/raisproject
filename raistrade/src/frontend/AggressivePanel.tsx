import { useState } from "react";
import { type Candle, BY_CODE } from "../shared/market";
import { type ComboStats, comboConfig, longCheck, ruleOf, tplOf, winConfidence } from "../shared/combos";
import { PRESET_BY_ID } from "../shared/library";
import { AGGRESSIVE_EXPOSURE, MAX_BOT_EXPOSURE } from "../shared/strategies";
import { api, money } from "./api";
import { AssetIcon } from "./Watchlist";
import { toast } from "./toast";
import { DEMO, DEMO_OFFSET } from "./demo/clock";
import type { ScanMsg } from "./scan.worker";
import type { Rule } from "./AutoTrade";
import { useSessions } from "./Sessions";

// Aggressive investment mode for the active session: bigger stakes (up to half-Kelly, capped),
// a 50% exposure cap, and the 20 best "aggressive but stable" robots — fast-trading robots with the
// largest edge re-tested on ~7 days, rated Consistent/Promising, spread across assets.

const PICKS = 20, MAX_PER_ASSET = 2, MAX_STAKE = 0.06;

interface Pick { r: ComboStats; edge: number; win: number; trades: number; perHour: number; halfKelly: number; stake: number; growth: number }

function scanOnce(onProgress: (p: number) => void): Promise<ComboStats[]> {
  return new Promise((resolve) => {
    const w = new Worker(new URL("./scan.worker.ts", import.meta.url), { type: "module", name: DEMO ? `off:${DEMO_OFFSET}` : "scan" });
    w.onmessage = (e: MessageEvent<ScanMsg>) => {
      if (e.data.type === "progress") onProgress(e.data.done / e.data.total);
      else { w.terminate(); resolve(e.data.results); }
    };
  });
}

async function findPicks(balance: number, existing: Rule[], onProgress: (s: string, p: number) => void): Promise<Pick[]> {
  // Skip robots already in this session — running the same signal twice only doubles the risk.
  const have = new Set(existing.map((r) => `${r.template}|${r.code}|${r.ktype}|${r.expiry ?? 0}|${r.params}`));
  const res = await scanOnce((p) => onProgress("Backtesting every robot on every market…", p * 0.8));
  onProgress("Re-testing the best candidates on 7 days of history…", 0.82);
  const seen = new Set<string>(), cache = new Map<string, Candle[]>();
  const cands = res.filter((r) => PRESET_BY_ID[r.preset]!.mode === "BINARY" && (r.goal === "QUICK" || r.goal === "HOURS")
      && (r.verdict === "ROBUST" || r.verdict === "PROMISING") && r.trades >= 15 && r.pnl > 0 && !ruleOf(r).mm
      && !have.has((() => { const c = comboConfig(ruleOf(r), r.code); return `${c.template}|${c.code}|${c.ktype}|${c.expiry}|${JSON.stringify(c.params)}`; })()))
    .sort((a, b) => winConfidence(b) - winConfidence(a))
    .filter((r) => { const k = `${r.code}|${ruleOf(r).template}|${r.preset}`; return !seen.has(k) && seen.add(k); })
    .slice(0, 90);
  const out: Pick[] = [];
  for (let i = 0; i < cands.length; i++) {
    const r = cands[i]!, lc = longCheck({ ...ruleOf(r), mm: undefined }, r.code, cache);
    if (lc.trades < 60 || lc.edge < 0.12) continue;
    const perHour = r.perDay / 24, stakeFrac = Math.min(MAX_STAKE, lc.halfKelly);
    // Aggressive = expected growth per hour (edge × trades/hour × stake), but only robots that stayed stable.
    out.push({ r, edge: lc.edge, win: lc.win, trades: lc.trades, perHour, halfKelly: lc.halfKelly, stake: Math.max(1, Math.round(balance * stakeFrac * 100) / 100), growth: lc.edge * perHour * stakeFrac });
    if (i % 10 === 0) onProgress("Re-testing the best candidates on 7 days of history…", 0.82 + (i / cands.length) * 0.18);
  }
  const perAsset = new Map<string, number>(), picks: Pick[] = [];
  for (const p of out.sort((a, b) => b.growth - a.growth)) {
    const n = perAsset.get(p.r.code) ?? 0;
    if (n >= MAX_PER_ASSET) continue;
    perAsset.set(p.r.code, n + 1); picks.push(p);
    if (picks.length === PICKS) break;
  }
  return picks;
}

export function AggressivePanel({ rules, reload }: { rules: Rule[]; reload: () => void }) {
  const { list, activeId } = useSessions();
  const session = list?.find((s) => s.id === activeId) as (NonNullable<typeof list>[number] & { aggressive?: number }) | undefined;
  const on = !!session?.aggressive;
  const agg = rules.filter((r) => (r as Rule & { aggressive?: number }).aggressive);
  const [busy, setBusy] = useState<{ step: string; p: number } | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [adding, setAdding] = useState(false);

  const toggle = async () => {
    if (!session) return toast.err("Start a session first");
    try {
      const r = await api(`/api/sessions/${session.id}/aggressive`, { body: { on: !on } });
      toast.ok(!on ? `Aggressive mode on${r.changed ? ` — ${r.changed} robots resumed` : ""}` : `Aggressive mode off — ${r.changed} aggressive robots paused`);
      window.dispatchEvent(new Event("rt:session"));
      reload();
      if (!on && !agg.length) find();
    } catch (e) { toast.err((e as Error).message); }
  };
  const find = async () => {
    setPicks(null);
    try {
      const acc = await api("/api/trd/accinfo");
      const balance = acc.binary.balance + (acc.binary.invested ?? 0);
      setPicks(await findPicks(balance, rules, (step, p) => setBusy({ step, p })));
    } catch (e) { toast.err((e as Error).message); }
    setBusy(null);
  };
  const addAll = async () => {
    if (!picks) return;
    setAdding(true);
    let ok = 0;
    for (const p of picks) {
      const rule = ruleOf(p.r);
      try { await api("/api/rules", { body: { ...comboConfig(rule, p.r.code), amount: p.stake, aggressive: true, name: `⚡ ${rule.name} · ${p.r.code} · ${p.r.preset}`.slice(0, 60) } }); ok++; }
      catch (e) { if (!/Already running/.test((e as Error).message)) toast.err((e as Error).message); }
    }
    setAdding(false); setPicks(null); reload();
    toast.ok(`Added ${ok} aggressive robots`);
  };
  const totalStake = picks?.reduce((s, p) => s + p.stake, 0) ?? 0;

  return (
    <div className={`panel p-3 mb-3 agg-panel ${on ? "on" : ""}`}>
      <div className="d-flex flex-wrap align-items-center gap-3">
        <label className="agg-switch">
          <input type="checkbox" checked={on} onChange={toggle} disabled={!session} />
          <span />
        </label>
        <div className="flex-grow-1">
          <div className="fw-bold">⚡ Aggressive investment {on ? <span className="badge text-bg-warning ms-1">ON</span> : <span className="badge text-bg-secondary ms-1">OFF</span>}</div>
          <div className="small text-secondary">
            Bigger stakes (up to each robot's half-Kelly, max {MAX_STAKE * 100}% per trade), exposure cap raised from {MAX_BOT_EXPOSURE * 100}% to {AGGRESSIVE_EXPOSURE * 100}%, and the {PICKS} fastest-growing robots that are still rated stable.
            Risk guards and the 4-loss auto-stop still apply. Turning it off pauses only the aggressive robots.
          </div>
        </div>
        <div className="text-end small">
          <div><b>{agg.filter((r) => r.status === "ACTIVE").length}</b> running · {agg.length} aggressive robots</div>
          <div className={agg.reduce((s, r) => s + r.pnl, 0) >= 0 ? "text-up" : "text-down"}>P/L {money(agg.reduce((s, r) => s + r.pnl, 0))}</div>
          {on && <button className="btn btn-sm btn-outline-secondary mt-1" disabled={!!busy} onClick={find}>{agg.length ? "🔄 Find more" : `🔎 Find best ${PICKS}`}</button>}
        </div>
      </div>
      {busy && <div className="mt-3"><div className="small text-secondary mb-1">{busy.step}</div><div className="progress" style={{ height: 6 }}><div className="progress-bar bg-warning" style={{ width: `${busy.p * 100}%` }} /></div></div>}
      {picks && (
        <div className="mt-3">
          <div className="d-flex align-items-center mb-2">
            <div className="step-title mb-0">Best {picks.length} aggressive & stable robots</div>
            <span className="small text-secondary ms-2">ranked by expected growth per hour after a 7-day re-test · max {MAX_PER_ASSET} per market</span>
          </div>
          <div className="table-responsive" style={{ maxHeight: 360 }}>
            <table className="table table-sm small-table tabular mb-2">
              <thead className="sticky-top"><tr><th>#</th><th>Robot</th><th>Style</th><th className="text-end">7-day win</th><th className="text-end">Edge / 1</th><th className="text-end">Trades/h</th><th className="text-end">Stake</th><th className="text-end">Exp. / hour</th></tr></thead>
              <tbody>{picks.map((p, i) => (
                <tr key={p.r.key}>
                  <td className="text-secondary">{i + 1}</td>
                  <td><AssetIcon code={p.r.code} size={18} /> {tplOf(p.r).icon} {ruleOf(p.r).name} <span className="text-secondary">· {p.r.code}</span></td>
                  <td>{PRESET_BY_ID[p.r.preset]!.label}</td>
                  <td className="text-end">{(p.win * 100).toFixed(0)}% <span className="text-secondary">({p.trades})</span></td>
                  <td className="text-end text-up">+{p.edge.toFixed(2)}</td>
                  <td className="text-end">{p.perHour.toFixed(1)}</td>
                  <td className="text-end">{money(p.stake)}</td>
                  <td className="text-end text-up">+{money(p.stake * p.edge * p.perHour)}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button className="btn btn-accent" disabled={adding || !picks.length} onClick={addAll}>{adding ? "Adding…" : `⚡ Add these ${picks.length} robots`}</button>
            <button className="btn btn-outline-secondary" onClick={() => setPicks(null)}>Cancel</button>
            <span className="small text-secondary ms-auto">Total stake if all fire at once: {money(totalStake)} — the {AGGRESSIVE_EXPOSURE * 100}% cap skips signals beyond that. Expected values come from backtests on a simulated market; real results will be lower.</span>
          </div>
          {picks.some((p) => !BY_CODE[p.r.code]) && null}
        </div>
      )}
    </div>
  );
}
