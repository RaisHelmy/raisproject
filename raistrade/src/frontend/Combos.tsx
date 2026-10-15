import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BY_CODE, type Candle, INSTRUMENTS, KTYPES, klines, priceAt } from "../shared/market";
import {
  BUNDLES, CATALOG, type ComboStats, type FilledBundle, GOALS, GOAL_BY_ID, type Goal, LIBRARY, PRESETS, doubleOdds, longCheck, winConfidence, VERDICT, type Verdict, comboConfig, fillBundles, ruleOf, runBacktest, tplOf,
} from "../shared/combos";
import { PRESET_BY_ID, type LibRule } from "../shared/library";
import { MAX_BOT_EXPOSURE, TEMPLATES } from "../shared/strategies";
import { api, money } from "./api";
import { AssetIcon } from "./Watchlist";
import { EquityChart } from "./AutoTrade";
import { GROUPS, groupOf } from "./pickers";
import { toast } from "./toast";
import { codeShown, modeShown, moomooOnly, shownInstruments, useScope } from "./scope";
import { fromUSD, symbol, toUSD } from "./currency";
import type { ScanMsg } from "./scan.worker";
import { DEMO, DEMO_OFFSET } from "./demo/clock";

const PAGE = 40;

/** Owns the background scan worker; results refresh by themselves whenever a candle closes. */
function useLiveScan() {
  const [res, setRes] = useState<ComboStats[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [meta, setMeta] = useState<{ scannedAt: Record<string, number>; ms: number; changed: string[] } | null>(null);
  const prev = useRef(new Map<string, number>());
  const [delta, setDelta] = useState(new Map<string, number>());
  useEffect(() => {
    const w = new Worker(new URL("./scan.worker.ts", import.meta.url), { type: "module", name: DEMO ? `off:${DEMO_OFFSET}` : "scan" });
    w.onmessage = (e: MessageEvent<ScanMsg>) => {
      const m = e.data;
      if (m.type === "progress") { setProgress(m.done / m.total); return; }
      const d = new Map<string, number>();
      for (const r of m.results) {
        const p = prev.current.get(r.key);
        if (p != null && p !== r.score && m.changed.includes(r.preset)) d.set(r.key, r.score - p);
        prev.current.set(r.key, r.score);
      }
      setDelta(d);
      setRes(m.results.sort((a, b) => b.score - a.score));
      setMeta({ scannedAt: m.scannedAt, ms: m.ms, changed: m.changed });
    };
    return () => w.terminate();
  }, []);
  return { res, progress, meta, delta };
}

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
}

const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : s < 86400 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
};

function ScoreBar({ v, d }: { v: number; d?: number }) {
  const cls = v >= 70 ? "ok" : v >= 45 ? "mid" : "bad";
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span className="mini-bar"><span className={cls} style={{ width: `${v}%` }} /></span><b className="tabular">{v}</b>
      {d ? <span className={`small ${d > 0 ? "text-up" : "text-down"}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span> : null}
    </span>
  );
}

function Windows({ r }: { r: ComboStats }) {
  const max = Math.max(...r.windows.map((w) => Math.abs(w.ret)), 0.0001);
  return (
    <span className="win-spark" title={r.windows.map((w, i) => `W${i + 1}: ${w.ret.toFixed(2)}% (${w.trades} trades, market ${w.drift >= 0 ? "+" : ""}${w.drift.toFixed(1)}%)`).join("\n")}>
      {r.windows.map((w, i) => <span key={i} className={w.ret > 0 ? "up" : w.ret < 0 ? "down" : ""} style={{ height: `${Math.max(12, (Math.abs(w.ret) / max) * 100)}%` }} />)}
    </span>
  );
}

const VerdictBadge = ({ v }: { v: Verdict }) => <span className={`badge ${VERDICT[v].cls}`} title={VERDICT[v].tip}>{VERDICT[v].label}</span>;
const Outlook = ({ v }: { v: number }) => <span className={`fw-semibold tabular ${v >= 65 ? "text-up" : v >= 50 ? "text-warning" : "text-down"}`} title="Estimated chance the next period is profitable">{v}%</span>;

async function start(rs: ComboStats[]) {
  let ok = 0;
  for (const r of rs) {
    const rule = ruleOf(r);
    try { await api("/api/rules", { body: { ...comboConfig(rule, r.code), name: `🏆 ${rule.name} · ${r.code} · ${r.preset}` } }); ok++; }
    catch (e) { toast.err((e as Error).message); }
  }
  if (ok) toast.ok(`Started ${ok} robot${ok > 1 ? "s" : ""} — see Auto-Trade`);
}

function why(r: ComboStats): string[] {
  const out = [
    `Profitable in ${r.windows.filter((w) => w.ret > 0).length} of ${r.windows.length} time windows.`,
    r.oosRet > 0 ? `Held up on the most recent 30% it was not ranked on (${r.oosRet.toFixed(2)}%, win ${(r.oosWin * 100).toFixed(0)}% vs ${(r.isWin * 100).toFixed(0)}% before).`
      : `Lost money on the most recent 30% of history (${r.oosRet.toFixed(2)}%) — the edge may be fading.`,
    `Same settings on ${r.peers.length} similar assets: ${r.peers.filter((p) => p.pnl > 0).length} profitable (${r.peers.map((p) => `${p.code.split(".")[1]} ${money(p.pnl)}`).join(", ")}).`,
  ];
  out.push(r.trendCorr > 0.6
    ? `Returns move with the market ${PRESET_BY_ID[r.preset]!.mode === "STOCK" ? "direction" : "trendiness"} (correlation ${r.trendCorr.toFixed(2)}). ${r.alpha > 0 ? "Some edge is left after removing that." : "Little edge is left after removing that, so it will likely fail when the trend changes."}`
    : `Returns don't depend much on the market trend (correlation ${r.trendCorr.toFixed(2)}), which points to an edge in the logic itself.`);
  return out;
}

function Detail({ r }: { r: ComboStats }) {
  const rule = ruleOf(r), p = PRESET_BY_ID[r.preset]!;
  const eq = useMemo(() => runBacktest(rule, r.code, klines(r.code, p.ktype, p.bars).slice(0, -1)).equity, [r]);
  const tpl = tplOf(r);
  return (
    <div className="row g-3 py-2" style={{ whiteSpace: "normal" }}>
      <div className="col-lg-6"><EquityChart data={eq} /></div>
      <div className="col-lg-6 small">
        <div className="step-title">Why “{VERDICT[r.verdict].label}”</div>
        <ul className="mb-2">{why(r).map((w) => <li key={w}>{w}</li>)}</ul>
        <div className="text-secondary">{tpl.description}</div>
        <div className="text-secondary mt-1">{p.blurb} · {tpl.params.map((d) => `${d.label} ${rule.params[d.key]}`).join(" · ")} · profit factor {r.profitFactor.toFixed(2)}</div>
      </div>
    </div>
  );
}

function ComboTable({ list, delta }: { list: ComboStats[]; delta: Map<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [n, setN] = useState(PAGE);
  useEffect(() => setN(PAGE), [list.length]);
  return (
    <div className="panel table-responsive">
      <table className="table table-sm table-hover small-table tabular mb-0 align-middle">
        <thead><tr>
          <th>#</th><th>Combo</th><th>Stability</th><th>Prediction</th><th className="text-end">Outlook</th>
          <th className="text-end">Trades</th><th className="text-end">Win</th><th className="text-end">Return</th><th className="text-end">Max DD</th>
          <th title="P/L per time window (oldest → newest)">Windows</th><th className="text-end" title="Same settings on similar assets">Peers</th><th />
        </tr></thead>
        <tbody>
          {list.slice(0, n).map((r, i) => {
            const rule = ruleOf(r), tpl = tplOf(r);
            return (
              <Fragment key={r.key}>
                <tr role="button" className={delta.has(r.key) ? "flash" : ""} onClick={() => setOpen(open === r.key ? null : r.key)}>
                  <td className="text-secondary">{i + 1}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <AssetIcon code={r.code} size={26} />
                      <div><div className="fw-semibold">{tpl.icon} {rule.name}{rule.isDefault ? "" : <span className="badge text-bg-secondary ms-1">tuned</span>}</div>
                        <div className="text-secondary" style={{ fontSize: ".72rem" }}>{r.code} · {PRESET_BY_ID[r.preset]!.label}</div></div>
                    </div>
                  </td>
                  <td><ScoreBar v={r.score} d={delta.get(r.key)} /></td>
                  <td><VerdictBadge v={r.verdict} /></td>
                  <td className="text-end"><Outlook v={r.outlook} /></td>
                  <td className="text-end">{r.trades}</td>
                  <td className="text-end">{(r.winRate * 100).toFixed(0)}%</td>
                  <td className={`text-end ${r.retPct >= 0 ? "text-up" : "text-down"}`}>{r.retPct >= 0 ? "+" : ""}{r.retPct.toFixed(1)}%</td>
                  <td className="text-end text-down">-{r.maxDD.toFixed(1)}%</td>
                  <td><Windows r={r} /></td>
                  <td className="text-end">{r.peers.filter((p) => p.pnl > 0).length}/{r.peers.length}</td>
                  <td><button className="btn btn-sm btn-accent py-0" onClick={(e) => { e.stopPropagation(); start([r]); }}>▶ Start</button></td>
                </tr>
                {open === r.key && <tr><td colSpan={12} className="bg-transparent"><Detail r={r} /></td></tr>}
              </Fragment>
            );
          })}
          {!list.length && <tr><td colSpan={12} className="text-center text-secondary py-4">No combos match these filters</td></tr>}
        </tbody>
      </table>
      {list.length > n && <div className="text-center p-2 border-top"><button className="btn btn-sm btn-outline-secondary" onClick={() => setN(n + PAGE)}>Show more ({list.length - n} left)</button></div>}
    </div>
  );
}

function Bundles({ filled, q }: { filled: FilledBundle[]; q: string }) {
  const [kind, setKind] = useState("ALL");
  const [showEmpty, setShowEmpty] = useState(false);
  const kinds = [...new Set(BUNDLES.map((b) => b.kind))];
  const list = filled.filter((f) => (kind === "ALL" || f.bundle.kind === kind) && (showEmpty || f.picks.length)
    && (!q || f.bundle.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <div className="d-flex flex-wrap gap-1 mb-2 align-items-center">
        {["ALL", ...kinds].map((k) => <button key={k} className={`chip ${kind === k ? "active" : ""}`} onClick={() => setKind(k)}>{k === "ALL" ? `All ${BUNDLES.length}` : k}</button>)}
        <label className="small d-flex align-items-center gap-1 ms-auto"><input type="checkbox" className="form-check-input m-0" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Show empty</label>
      </div>
      <div className="row g-2">
        {list.map((f, i) => (
          <div className="col-md-6 col-xxl-4" key={f.bundle.id}>
            <div className="panel p-3 h-100 bundle-card d-flex flex-column">
              <div className="d-flex align-items-start gap-2 mb-1">
                <span className="tpl-icon">{f.bundle.icon}</span>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{f.bundle.name}</div>
                  <div className="text-secondary" style={{ fontSize: ".75rem" }}>{f.bundle.kind} · #{i + 1}</div>
                </div>
                <div className="text-end small"><ScoreBar v={f.score} /><div className="text-secondary">outlook <Outlook v={f.outlook} /></div></div>
              </div>
              <div className="small text-secondary mb-2">{f.bundle.desc}</div>
              <div className="flex-grow-1">
                {f.picks.map((r) => (
                  <div key={r.key} className="d-flex align-items-center gap-2 py-1 border-top">
                    <AssetIcon code={r.code} size={22} />
                    <div className="flex-grow-1 text-truncate small">
                      <span className="fw-semibold">{tplOf(r).icon} {ruleOf(r).name}</span>
                      <span className="text-secondary"> · {r.code} · {PRESET_BY_ID[r.preset]!.label}</span>
                    </div>
                    <span className={`small tabular ${r.retPct >= 0 ? "text-up" : "text-down"}`}>{r.retPct >= 0 ? "+" : ""}{r.retPct.toFixed(1)}%</span>
                    <VerdictBadge v={r.verdict} />
                  </div>
                ))}
                {!f.picks.length && <div className="small text-secondary border-top pt-2">No robot qualifies right now — check back after the next candles.</div>}
              </div>
              <button className="btn btn-sm btn-accent mt-2" disabled={!f.picks.length} onClick={() => start(f.picks)}>▶ Start {f.picks.length} robot{f.picks.length === 1 ? "" : "s"}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const PAGE_LIB = 50;

/** Browses the full ~1M-rule catalogue. Rules in the live pool show their ranking; any other rule can be backtested on demand. */
function Library({ res, group }: { res: ComboStats[]; q: string; group: string }) {
  const [fam, setFam] = useState("");
  const [goalF, setGoalF] = useState<Goal | "">("");
  const [style, setStyle] = useState("");
  const [mm, setMm] = useState("");
  const [page, setPage] = useState(0);
  const [asset, setAsset] = useState("US.NVDA");
  const [tested, setTested] = useState<Record<string, { trades: number; win: number; pnl: number; cw: number }>>({});
  useEffect(() => setPage(0), [fam, goalF, style, mm]);
  const best = useMemo(() => {
    const m = new Map<string, ComboStats>();
    for (const r of res) if ((group === "ALL" || groupOf(r.code).id === group) && (!m.has(r.rule) || m.get(r.rule)!.score < r.score)) m.set(r.rule, r);
    return m;
  }, [res, group]);
  const { rows, total } = useMemo(() => CATALOG.page({ template: fam || undefined, goal: goalF || undefined, preset: style || undefined, mm: mm || undefined, mode: moomooOnly() ? "STOCK" : undefined, offset: page * PAGE_LIB, limit: PAGE_LIB }), [fam, goalF, style, mm, page, useScope()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_LIB));
  const test = (rule: LibRule) => {
    const p = PRESET_BY_ID[rule.preset]!;
    const c = klines(asset, p.ktype, p.bars).slice(0, -1);
    const bt = runBacktest(rule, asset, c);
    const win = bt.trades ? bt.wins / bt.trades : 0;
    setTested((t) => ({ ...t, [rule.id + asset]: { trades: bt.trades, win, pnl: bt.pnl, cw: winConfidence({ winRate: win, trades: bt.trades }) } }));
  };
  const startRule = async (rule: LibRule) => {
    try { await api("/api/rules", { body: { ...comboConfig(rule, asset), name: `${rule.name} · ${asset} · ${rule.preset}` } }); toast.ok("Robot started — see Auto-Trade"); }
    catch (e) { toast.err((e as Error).message); }
  };
  return (
    <>
      <div className="panel p-3 mb-2">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <div className="h5 mb-0 fw-bold">📚 {CATALOG.size.toLocaleString()} rules</div>
          <span className="small text-secondary">every strategy × parameter set × trading style × money management. {LIBRARY.length.toLocaleString()} of them are ranked live on all {INSTRUMENTS.length} assets; test any other rule on an asset in one click.</span>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <select className="form-select form-select-sm w-auto" value={goalF} onChange={(e) => { setGoalF(e.target.value as Goal | ""); setStyle(""); }}>
            <option value="">All trading types</option>{GOALS.map((g) => <option key={g.id} value={g.id}>{g.icon} {g.title}</option>)}
          </select>
          <select className="form-select form-select-sm w-auto" value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">All styles</option>{PRESETS.filter((p) => (!goalF || p.goal === goalF) && modeShown(p.mode)).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select className="form-select form-select-sm w-auto" style={{ maxWidth: 260 }} value={fam} onChange={(e) => setFam(e.target.value)}>
            <option value="">All 100 strategies</option>
            {TEMPLATES.filter((t) => t.id !== "price_level").map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </select>
          <select className="form-select form-select-sm w-auto" value={mm} onChange={(e) => setMm(e.target.value)}>
            <option value="">Any money management</option><option value="FIXED">Fixed stake</option><option value="MARTINGALE">Martingale</option><option value="ANTI_MARTINGALE">Anti-martingale</option>
          </select>
          <span className="small text-secondary ms-auto">Test on</span>
          <select className="form-select form-select-sm w-auto" value={asset} onChange={(e) => setAsset(e.target.value)}>
            {shownInstruments().map((i) => <option key={i.code} value={i.code}>{i.code}</option>)}
          </select>
        </div>
      </div>
      <div className="panel table-responsive">
        <table className="table table-sm table-hover small-table tabular mb-0 align-middle">
          <thead><tr><th>#</th><th>Rule</th><th>Style</th><th>Parameters</th><th>Live ranking</th><th>Test on {asset.split(".")[1]}</th><th /></tr></thead>
          <tbody>
            {rows.map((rule, i) => {
              const tpl = TEMPLATES.find((t) => t.id === rule.template)!, b = best.get(rule.id), t = tested[rule.id + asset];
              return (
                <tr key={rule.id}>
                  <td className="text-secondary">{(page * PAGE_LIB + i + 1).toLocaleString()}</td>
                  <td><span className="text-warning me-1">{tpl.icon}</span><b>{rule.name}</b>{rule.isDefault && <span className="badge text-bg-secondary ms-1">default</span>}{rule.mm === "MARTINGALE" && <span className="badge text-bg-danger ms-1">high risk</span>}</td>
                  <td>{PRESET_BY_ID[rule.preset]!.label}</td>
                  <td className="text-secondary text-truncate" style={{ maxWidth: 280 }}>{tpl.params.map((d) => `${d.label} ${rule.params[d.key]}`).join(" · ")}</td>
                  <td>{b ? <span className="d-inline-flex gap-2 align-items-center"><ScoreBar v={b.score} /><VerdictBadge v={b.verdict} /><span className="text-secondary">{b.code.split(".")[1]}</span></span> : <span className="text-secondary">—</span>}</td>
                  <td>{t ? <span className={t.pnl >= 0 ? "text-up" : "text-down"}>{t.trades} trades · win {(t.win * 100).toFixed(0)}% <span className="text-secondary">(≥{(t.cw * 100).toFixed(0)}%)</span> · {money(t.pnl)}</span>
                    : <button className="btn btn-sm btn-outline-secondary py-0" onClick={() => test(rule)}>🧪 Test</button>}</td>
                  <td><button className="btn btn-sm btn-accent py-0" onClick={() => startRule(rule)}>▶ Start</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="d-flex align-items-center gap-2 p-2 border-top small">
          <button className="btn btn-sm btn-outline-secondary" disabled={!page} onClick={() => setPage(0)}>⏮</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={!page} onClick={() => setPage(page - 1)}>‹ Prev</button>
          <span className="text-secondary">Page {(page + 1).toLocaleString()} of {pages.toLocaleString()} · {total.toLocaleString()} rules match</span>
          <button className="btn btn-sm btn-outline-secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next ›</button>
          <button className="btn btn-sm btn-outline-secondary" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>⏭</button>
          <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setPage(Math.floor(Math.random() * pages))}>🎲 Random page</button>
        </div>
      </div>
    </>
  );
}

// ---------------- "Can I double my money?" planner ----------------

function DoublePlanner({ res, goal }: { res: ComboStats[]; goal: Goal }) {
  const [capital, setCapital] = useState(10_000);
  const [hours, setHours] = useState(3);
  const [stake, setStake] = useState(2);
  const [target, setTarget] = useState(2);
  // Shortlist on the live ranking, then re-test every candidate on ~7 days of history and keep
  // only robots that still have an edge there — 10 hours of 1-minute data flatters lucky robots.
  const cands = useMemo(() => {
    const seen = new Set<string>(), cache = new Map<string, Candle[]>();
    return res.filter((r) => r.goal === goal && r.trades >= 15 && r.pnl > 0 && (r.verdict === "ROBUST" || r.verdict === "PROMISING"))
      .sort((a, b) => winConfidence(b) - winConfidence(a))
      .filter((r) => { const k = `${r.code}|${ruleOf(r).template}`; return !seen.has(k) && seen.add(k); }).slice(0, 30)
      .map((r) => { const rule = ruleOf(r); return { r, rule, long: longCheck({ ...rule, mm: undefined }, r.code, cache) }; })
      .filter((c) => c.long.trades >= 30)
      .sort((a, b) => b.long.edge - a.long.edge).slice(0, 10);
  }, [res, goal]);
  const rows = useMemo(() => cands.map((c) => {
    const base = { tradeR: c.long.tradeR, perHour: c.r.perDay / 24, hours, stakePct: stake, target, mm: c.rule.mm ?? "FIXED" as const };
    return { ...c, cautious: c.long.cautious, past: doubleOdds(base), safe: doubleOdds({ ...base, pWin: c.long.cautious }) };
  }).sort((a, b) => Number(b.long.edge > 0) - Number(a.long.edge > 0) || Math.round(b.safe.pTarget * 20) - Math.round(a.safe.pTarget * 20) || b.safe.median - a.safe.median), [cands, hours, stake, target]);
  const pick = rows[0];
  const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 && x > 0 ? 1 : 0)}%`;
  const amountFor = (r: ComboStats) => {
    const p = PRESET_BY_ID[r.preset]!, inst = BY_CODE[r.code]!;
    if (p.mode === "BINARY") return Math.max(1, Math.round((capital * stake) / 100));
    const q = Math.max(1, Math.floor((capital * stake) / 100 / (priceAt(r.code, Date.now()) * inst.lot))) * inst.lot;
    return +q.toFixed(6);
  };
  const startAll = async (list: typeof rows) => {
    let ok = 0;
    for (const x of list) {
      try { await api("/api/rules", { body: { ...comboConfig(x.rule, x.r.code), amount: amountFor(x.r), name: `🚀 ${x.rule.name} · ${x.r.code}` } }); ok++; }
      catch (e) { toast.err((e as Error).message); }
    }
    if (ok) toast.ok(`Started ${ok} robot${ok > 1 ? "s" : ""} — watch them in Auto-Trade`);
  };
  return (
    <div className="panel p-3 mb-4 planner">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <div className="h5 fw-bold mb-0">🚀 Can I {target === 2 ? "double" : `${target}×`} my money in {hours} hour{hours > 1 ? "s" : ""}?</div>
        <span className="small text-secondary">Each robot's own trades, replayed 4,000 times over your time window.</span>
      </div>
      <div className="d-flex flex-wrap gap-3 align-items-end mb-3 small">
        <label>Capital<div className="input-group input-group-sm" style={{ width: 140 }}><span className="input-group-text">{symbol()}</span><input className="form-control" type="number" value={Math.round(fromUSD(capital))} onChange={(e) => setCapital(Math.max(10, toUSD(Number(e.target.value))))} /></div></label>
        <label>Time<div className="seg seg-sm d-flex">{[1, 2, 3, 4, 6].map((h) => <button key={h} className={hours === h ? "active" : ""} onClick={() => setHours(h)}>{h}h</button>)}</div></label>
        <label>Stake per trade<div className="seg seg-sm d-flex">{[1, 2, 5, 10, 20, 50].map((x) => <button key={x} className={stake === x ? "active" : ""} onClick={() => setStake(x)}>{x}%</button>)}</div></label>
        <label>Goal<div className="seg seg-sm d-flex">{[1.25, 1.5, 2, 3].map((x) => <button key={x} className={target === x ? "active" : ""} onClick={() => setTarget(x)}>{x}×</button>)}</div></label>
      </div>
      {pick ? (
        <div className={`planner-verdict ${pick.safe.pTarget >= 0.5 ? "good" : pick.safe.pTarget >= 0.15 ? "mid" : "bad"}`}>
          <div className="fw-bold mb-1">
            Best realistic chance of turning {money(capital)} into {money(capital * target)} in {hours}h: <span className="fs-5">{pct(pick.safe.pTarget)}</span>
            <span className="fw-normal"> — with {pct(pick.safe.pHalf)} chance of losing half or more.</span>
          </div>
          <div className="small">
            {pick.safe.pTarget < 0.15
              ? <>At {stake}% per trade the robots don't trade often enough or win by enough to get there. Raising the stake raises both the chance of hitting the goal <i>and</i> of a wipe-out — try 20% or 50% above and watch the "lose half" column.</>
              : pick.safe.pHalf > 0.2
                ? <>It's possible, but it's a gamble: about {Math.round(pick.safe.pHalf * 10)} in 10 tries end with half the money gone.</>
                : <>Even in the cautious estimate this looks reachable — but it relies on the robot keeping its edge. Start on the practice account first.</>}
            {" "}Median outcome: {money(capital * pick.safe.median)} · trades in the window: ~{Math.round(pick.safe.trades)}.
            {stake > pick.long.halfKelly * 100 && <> <b>Your {stake}% stake is above this robot's sensible maximum of {(pick.long.halfKelly * 100).toFixed(1)}%</b> — you're paying for the higher doubling chance with a much higher chance of losing it all.</>}
          </div>
        </div>
      ) : <div className="text-secondary small">No robot of this type has enough trades yet — check back after the next candles.</div>}
      {rows.length > 0 && (
        <div className="table-responsive mt-3">
          <table className="table table-sm small-table tabular mb-2 align-middle">
            <thead><tr><th>Robot</th><th className="text-end" title="Win rate on the ~10 hours the ranking uses">10h win</th><th className="text-end" title="Win rate re-tested on ~7 days of history (trades)">7-day win</th><th className="text-end" title="95% lower bound of the 7-day win rate">Cautious win</th><th className="text-end" title="Expected result per 1 unit staked at the cautious win rate">Edge per 1</th><th className="text-end" title="Half-Kelly: the largest stake that makes sense for this edge. Betting more adds risk without adding long-run growth.">Max stake</th><th className="text-end">Trades/h</th>
              <th className="text-end" title="If the past repeats exactly">{target}× if past repeats</th><th className="text-end">{target}× cautious</th><th className="text-end">Any profit</th><th className="text-end">Lose ≥ half</th><th className="text-end">Median end</th><th /></tr></thead>
            <tbody>
              {rows.map((x, i) => (
                <tr key={x.r.key} className={i === 0 ? "planner-pick" : ""}>
                  <td><div className="d-flex align-items-center gap-2"><AssetIcon code={x.r.code} size={22} /><div><div className="fw-semibold">{i === 0 && "⭐ "}{x.rule.name}</div><div className="text-secondary" style={{ fontSize: ".72rem" }}>{x.r.code} · {PRESET_BY_ID[x.r.preset]!.label}</div></div></div></td>
                  <td className="text-end text-secondary">{(x.r.winRate * 100).toFixed(0)}%</td>
                  <td className="text-end">{(x.long.win * 100).toFixed(0)}% <span className="text-secondary">({x.long.trades})</span></td>
                  <td className="text-end fw-semibold">{(x.cautious * 100).toFixed(0)}%</td>
                  <td className={`text-end ${x.long.edge > 0 ? "text-up" : "text-down"}`}>{x.long.edge >= 0 ? "+" : ""}{x.long.edge.toFixed(2)}</td>
                  <td className={`text-end ${stake > x.long.halfKelly * 100 ? "text-down fw-bold" : ""}`} title={stake > x.long.halfKelly * 100 ? "Your stake is above this — over-betting" : ""}>{x.long.edge > 0 ? `${(x.long.halfKelly * 100).toFixed(1)}%` : "don't"}</td>
                  <td className="text-end">{(x.r.perDay / 24).toFixed(1)}</td>
                  <td className="text-end text-secondary">{pct(x.past.pTarget)}</td>
                  <td className={`text-end fw-bold ${x.safe.pTarget >= 0.5 ? "text-up" : x.safe.pTarget >= 0.15 ? "text-warning" : "text-down"}`}>{pct(x.safe.pTarget)}</td>
                  <td className="text-end">{pct(x.safe.pProfit)}</td>
                  <td className="text-end text-down">{pct(x.safe.pHalf)}</td>
                  <td className={`text-end ${x.safe.median >= 1 ? "text-up" : "text-down"}`}>{money(capital * x.safe.median)}</td>
                  <td><button className="btn btn-sm btn-accent py-0" disabled={x.long.edge <= 0} onClick={() => startAll([x])}>▶ {money(amountFor(x.r))}/trade</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => startAll(rows.filter((x) => x.long.edge > 0).slice(0, 5))}>▶ Start top 5 with an edge</button>
            <span className="small text-secondary ms-auto">Robots are re-tested on ~7 days; "cautious" is the low end of what that record supports. Bots can't stake more than {MAX_BOT_EXPOSURE * 100}% of the balance at once. Simulated market · paper money · not financial advice.</span>
          </div>
        </div>
      )}
    </div>
  );
}

const perLabel = (d: number) => (d >= 1 ? `~${Math.round(d)} trades/day` : d * 7 >= 1 ? `~${Math.round(d * 7)} trades/week` : `~${Math.max(1, Math.round(d * 30))} trades/month`);

function readGoal(): Goal { try { const g = localStorage.getItem("rt.goal") as Goal; return GOALS.some((x) => x.id === g) ? g : "DAY"; } catch { return "DAY"; } }

function GoalPicker({ goal, onPick, res }: { goal: Goal; onPick: (g: Goal) => void; res: ComboStats[] | null }) {
  return (
    <div className="row g-2 mb-3">
      {GOALS.map((g) => {
        const good = res?.filter((r) => r.goal === g.id && r.verdict === "ROBUST").length;
        return (
          <div className="col-sm-6 col-lg" key={g.id}>
            <button className={`goal-card w-100 text-start ${goal === g.id ? "active" : ""}`} onClick={() => onPick(g.id)}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="goal-icon">{g.icon}</span>
                <div className="fw-bold fs-6">{g.title}</div>
                {good != null && <span className="badge text-bg-success ms-auto">{good} consistent</span>}
              </div>
              <div className="small text-secondary mb-2">{g.tagline}</div>
              <div className="goal-facts">
                <span>⏳ Hold <b>{g.hold}</b></span>
                <span>👀 Check <b>{g.check.toLowerCase()}</b></span>
                <span>⚠ Risk <b>{g.risk}</b></span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TopPick({ r, rank }: { r: ComboStats; rank: number }) {
  const rule = ruleOf(r), tpl = tplOf(r), p = PRESET_BY_ID[r.preset]!;
  const wins = r.windows.filter((w) => w.ret > 0).length;
  return (
    <div className="col-lg-4">
      <div className="panel p-3 h-100 d-flex flex-column pick-card">
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="pick-rank">{["🥇", "🥈", "🥉"][rank]}</span>
          <AssetIcon code={r.code} size={34} />
          <div className="flex-grow-1 text-truncate">
            <div className="fw-bold text-truncate">{BY_CODE[r.code]!.name}</div>
            <div className="small text-secondary text-truncate">{tpl.icon} {rule.name} · {p.label}</div>
          </div>
          <VerdictBadge v={r.verdict} />
        </div>
        <div className="small mb-2">{tpl.description}</div>
        <div className="row g-2 small mb-2 text-center">
          <div className="col-4"><div className="pick-stat"><div className="text-secondary">Return</div><b className={r.retPct >= 0 ? "text-up" : "text-down"}>{r.retPct >= 0 ? "+" : ""}{r.retPct.toFixed(1)}%</b></div></div>
          <div className="col-4"><div className="pick-stat"><div className="text-secondary">Win rate</div><b>{(r.winRate * 100).toFixed(0)}%</b></div></div>
          <div className="col-4"><div className="pick-stat"><div className="text-secondary">Next period</div><Outlook v={r.outlook} /></div></div>
        </div>
        <ul className="small text-secondary ps-3 mb-3 flex-grow-1">
          <li>Made money in <b className="text-body-emphasis">{wins} of {r.windows.length}</b> past periods{r.oosRet > 0 ? ", including the most recent one" : ""}.</li>
          <li>Trades <b className="text-body-emphasis">{perLabel(r.perDay)}</b> · worst dip <b className="text-down">-{r.maxDD.toFixed(1)}%</b>.</li>
          <li>{r.trendCorr > 0.6 ? "⚠ Profit follows the market trend — may stop working if it turns." : `Works on ${r.peers.filter((x) => x.pnl > 0).length}/${r.peers.length} similar assets — not just luck on one chart.`}</li>
        </ul>
        <button className="btn btn-accent" onClick={() => start([r])}>▶ Start this robot</button>
      </div>
    </div>
  );
}

export function Combos() {
  const { res: raw, progress, meta, delta } = useLiveScan();
  const scoped = useScope();
  // In "moomoo API only" view, drop binary styles and instruments moomoo can't trade.
  const res = useMemo(() => raw && (scoped ? raw.filter((r) => modeShown(PRESET_BY_ID[r.preset]!.mode) && codeShown(r.code)) : raw), [raw, scoped]);
  useTick(1000);
  const [tab, setTab] = useState<"GOAL" | "BUNDLES" | "LIBRARY">("GOAL");
  const [goal, setGoalState] = useState<Goal>(readGoal);
  const setGoal = (g: Goal) => { setGoalState(g); setPreset("ALL"); try { localStorage.setItem("rt.goal", g); } catch { /* ignore */ } };
  const [preset, setPreset] = useState("ALL");
  const [group, setGroup] = useState("ALL");
  const [onePer, setOnePer] = useState(true);
  const [consistentOnly, setConsistentOnly] = useState(false);
  const [q, setQ] = useState("");
  const g = GOAL_BY_ID[goal];
  const goalPresets = PRESETS.filter((p) => p.goal === goal && modeShown(p.mode));

  const list = useMemo(() => {
    if (!res) return [];
    const seen = new Set<string>(), ql = q.toLowerCase();
    return res.filter((r) => r.goal === goal && (preset === "ALL" || r.preset === preset)
      && (group === "ALL" || groupOf(r.code).id === group) && (!consistentOnly || r.verdict === "ROBUST")
      && (!ql || ruleOf(r).name.toLowerCase().includes(ql) || r.code.toLowerCase().includes(ql) || BY_CODE[r.code]!.name.toLowerCase().includes(ql))
      && (!onePer || (!seen.has(ruleOf(r).template) && seen.add(ruleOf(r).template))));
  }, [res, goal, preset, group, onePer, consistentOnly, q]);
  const top = useMemo(() => {
    const used = new Set<string>();
    return list.filter((r) => r.verdict === "ROBUST" || r.verdict === "PROMISING").filter((r) => !used.has(r.code) && used.add(r.code)).slice(0, 3);
  }, [list]);
  const filled = useMemo(() => (res ? fillBundles(group === "ALL" ? res : res.filter((r) => groupOf(r.code).id === group)) : []), [res, group]);
  const nextIn = (ktype: string) => { const ms = KTYPES[ktype]! * 1000; return ago(Date.now() - (ms - (Date.now() % ms))); };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div>
          <h2 className="h4 fw-bold mb-1">🏆 Robot Combos</h2>
          <div className="small text-secondary">Tell us how you want to trade — we'll show the robots that have been the most <b>stable</b> for that style.</div>
        </div>
        <div className="seg ms-auto">
          <button className={tab === "GOAL" ? "active" : ""} onClick={() => setTab("GOAL")}>🎯 By trading type</button>
          <button className={tab === "BUNDLES" ? "active" : ""} onClick={() => setTab("BUNDLES")}>🎁 Bundles · {BUNDLES.length}</button>
          <button className={tab === "LIBRARY" ? "active" : ""} onClick={() => setTab("LIBRARY")}>📚 Library · {CATALOG.size.toLocaleString()}</button>
        </div>
      </div>

      {!res ? (
        <div className="panel p-4 text-center">
          <div className="small text-secondary mb-2">Backtesting {(LIBRARY.length * INSTRUMENTS.length).toLocaleString()} combos in the background…</div>
          <div className="progress mx-auto" style={{ height: 6, maxWidth: 360 }}><div className="progress-bar bg-warning" style={{ width: `${progress * 100}%` }} /></div>
        </div>
      ) : tab === "BUNDLES" ? <><MarketBar group={group} setGroup={setGroup} q={q} setQ={setQ} /><Bundles filled={filled} q={q} /></>
        : tab === "LIBRARY" ? <><MarketBar group={group} setGroup={setGroup} q={q} setQ={setQ} /><Library res={res} q={q} group={group} /></>
        : (
          <>
            <div className="step-title">1 · How do you want to trade?</div>
            <GoalPicker goal={goal} onPick={setGoal} res={res} />

            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <div className="step-title mb-0">2 · Top picks for {g.icon} {g.title.toLowerCase()}</div>
              <select className="form-select form-select-sm w-auto ms-auto" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="ALL">All markets</option>
                {GROUPS.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.label}</option>)}
              </select>
              {meta && <span className="small text-secondary d-inline-flex align-items-center gap-1"><span className="live-dot" /> live · {goalPresets.map((p) => `${p.label} next update in ${nextIn(p.ktype)}`).join(" · ")}</span>}
            </div>
            <div className="row g-2 mb-4">
              {top.map((r, i) => <TopPick key={r.key} r={r} rank={i} />)}
              {!top.length && <div className="col-12"><div className="panel p-4 text-center text-secondary">No consistent robot for this type in this market right now — try another market, or check back after the next candles.</div></div>}
            </div>

            {(goal === "QUICK" || goal === "HOURS") && <DoublePlanner res={res} goal={goal} />}

            <div className="step-title">3 · Compare all {list.length.toLocaleString()} {g.title.toLowerCase()} combos</div>
            <div className="panel p-2 mb-2 d-flex flex-wrap align-items-center gap-2">
              <input className="form-control form-control-sm" style={{ maxWidth: 220 }} placeholder="🔍 Search robot or asset…" value={q} onChange={(e) => setQ(e.target.value)} />
              {goalPresets.length > 1 && (
                <div className="seg seg-sm">
                  <button className={preset === "ALL" ? "active" : ""} onClick={() => setPreset("ALL")}>All</button>
                  {goalPresets.map((p) => <button key={p.id} className={preset === p.id ? "active" : ""} title={p.blurb} onClick={() => setPreset(p.id)}>{p.label}</button>)}
                </div>
              )}
              <label className="small d-flex align-items-center gap-1"><input type="checkbox" className="form-check-input m-0" checked={onePer} onChange={(e) => setOnePer(e.target.checked)} /> One per strategy</label>
              <label className="small d-flex align-items-center gap-1"><input type="checkbox" className="form-check-input m-0" checked={consistentOnly} onChange={(e) => setConsistentOnly(e.target.checked)} /> Consistent only</label>
              <span className="small text-secondary ms-auto">{goalPresets.map((p) => p.blurb).join(" · ")}</span>
            </div>
            <ComboTable list={list} delta={delta} />

            <details className="panel p-2 px-3 mt-3 small text-secondary">
              <summary className="text-body-emphasis">How the ranking and prediction work</summary>
              <ul className="mb-1 mt-2">
                <li><b>Stability score</b> (0–100): 30% profitable in each of 6 time periods · 20% still profitable on the most recent 30% (out-of-sample) · 20% works on similar assets · 15% not explained by the market trend · 15% return vs worst drawdown.</li>
                <li><b>Trend check</b>: if profit only shows up when the market rallies, the robot is just riding the trend and is flagged <span className="badge text-bg-warning">Trend-riding</span>.</li>
                <li><b>Next period</b>: estimated chance the next period is profitable, reduced when the profit depends on the trend.</li>
                <li><b>Live</b>: re-ranked automatically every time a candle closes. Past results on a simulated market don't guarantee anything.</li>
              </ul>
            </details>
          </>
        )}
    </div>
  );
}

function MarketBar({ group, setGroup, q, setQ }: { group: string; setGroup: (g: string) => void; q: string; setQ: (q: string) => void }) {
  return (
    <div className="panel p-2 mb-2 d-flex flex-wrap align-items-center gap-2">
      <input className="form-control form-control-sm" style={{ maxWidth: 220 }} placeholder="🔍 Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="form-select form-select-sm w-auto" value={group} onChange={(e) => setGroup(e.target.value)}>
        <option value="ALL">All markets</option>
        {GROUPS.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.label}</option>)}
      </select>
    </div>
  );
}
