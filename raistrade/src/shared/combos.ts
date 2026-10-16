// Combo ranking: every library rule (template + params + style) × asset is backtested, then
// scored for stability rather than raw profit. A combo ranks high only if it is profitable in
// most time windows, holds up out-of-sample, works on peer assets, and its profit is not just the
// market trend (a long-only robot "wins" in a rally without any real edge).
// Results are plain data so they can be computed in a Web Worker and posted to the page.

import { type Candle, BY_CODE, INSTRUMENTS, klines, priceAt } from "./market";
import { TEMPLATE_BY_ID, backtest, type MoneyMgmt, type RuleConfig } from "./strategies";
import { GOALS, LIB_BY_ID, PRESET_BY_ID, type Goal, type Horizon, type LibRule, type Preset } from "./library";

export { PRESETS, LIBRARY, CATALOG, GOALS, GOAL_BY_ID, type Goal, type Horizon, type Preset } from "./library";

const WINDOWS = 6;
const OOS_FRACTION = 0.3;

export const qtyFor = (code: string) => { const l = BY_CODE[code]!.lot; return l >= 100 ? l : l < 1 ? l * 10 : 10; };

export function comboConfig(rule: LibRule, code: string): RuleConfig {
  const p = PRESET_BY_ID[rule.preset]!;
  return {
    template: rule.template, mode: p.mode, code, ktype: p.ktype, params: rule.params,
    amount: p.mode === "BINARY" ? 50 : qtyFor(code), expiry: p.expiry, money_mgmt: rule.mm ?? "FIXED", stop_loss_pct: p.sl, take_profit_pct: p.tp,
  };
}

export type Verdict = "ROBUST" | "PROMISING" | "TREND" | "UNSTABLE" | "THIN";
export const VERDICT: Record<Verdict, { label: string; cls: string; tip: string }> = {
  ROBUST: { label: "Consistent", cls: "text-bg-success", tip: "Profitable across most windows, out-of-sample and on peer assets, and not explained by the market trend." },
  PROMISING: { label: "Promising", cls: "text-bg-info", tip: "Mostly consistent but one check is weak — start small and watch it." },
  TREND: { label: "Trend-riding", cls: "text-bg-warning", tip: "Profit tracks the market direction. It will likely fail when the trend reverses." },
  UNSTABLE: { label: "Unstable", cls: "text-bg-danger", tip: "Profit comes from a few lucky windows or fails out-of-sample." },
  THIN: { label: "Too few trades", cls: "text-bg-secondary", tip: "Not enough trades to judge." },
};

export interface ComboStats {
  key: string; rule: string; code: string; preset: string; horizon: Horizon; goal: Goal; perDay: number;
  trades: number; winRate: number; pnl: number; retPct: number; maxDD: number; profitFactor: number;
  windows: { ret: number; drift: number; trades: number }[]; consistency: number;
  oosRet: number; oosWin: number; isWin: number; trendCorr: number; alpha: number;
  peers: { code: string; pnl: number }[]; peerRate: number;
  score: number; verdict: Verdict; outlook: number;
}

function corr(a: number[], b: number[]): number {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i]! - ma) * (b[i]! - mb); saa += (a[i]! - ma) ** 2; sbb += (b[i]! - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

/** Full backtest incl. mark-to-market of a still-open position (a robot can't hide losses by never selling). */
export function runBacktest(rule: LibRule, code: string, candles: Candle[]) {
  const bt = backtest(comboConfig(rule, code), candles);
  if (bt.openPnl) {
    bt.fills.push([candles.at(-1)![0], bt.openPnl]); bt.pnl += bt.openPnl; bt.trades++;
    bt.openPnl > 0 ? bt.wins++ : bt.losses++;
    bt.equity.push([candles.at(-1)![0], bt.pnl]);
  }
  return bt;
}

export function evaluate(rule: LibRule, code: string, candles: Candle[]): ComboStats {
  const p = PRESET_BY_ID[rule.preset]!, cfg = comboConfig(rule, code);
  const bt = runBacktest(rule, code, candles);
  // Capital base so stock and binary results are comparable: notional of one position, or 10 stakes.
  const capital = p.mode === "BINARY" ? cfg.amount * 10 : cfg.amount * candles[30]![4];
  const t0 = candles[30]![0], t1 = candles.at(-1)![0], span = (t1 - t0) / WINDOWS;
  const windows = Array.from({ length: WINDOWS }, (_, w) => {
    const a = t0 + w * span, b = w === WINDOWS - 1 ? Infinity : a + span;
    let ret = 0, trades = 0;
    for (const [ts, d] of bt.fills) if (ts >= a && ts < b) { ret += d; trades++; }
    let first: Candle | undefined, last: Candle | undefined;
    for (const c of candles) if (c[0] >= a && c[0] < b) { first ??= c; last = c; }
    const drift = first && last ? (last[4] - first[1]) / first[1] * 100 : 0;
    return { ret: ret / capital * 100, drift, trades };
  });
  const consistency = windows.filter((w) => w.trades > 0 && w.ret > 0).length / WINDOWS;

  const cut = t1 - (t1 - t0) * OOS_FRACTION;
  const isF = bt.fills.filter((f) => f[0] < cut), oosF = bt.fills.filter((f) => f[0] >= cut);
  const rate = (f: [number, number][]) => (f.length ? f.filter((x) => x[1] > 0).length / f.length : 0);

  // Trend dependence: long-only stock robots vs signed drift, binary robots vs |drift| (trendiness).
  const ds = windows.map((w) => (p.mode === "STOCK" ? w.drift : Math.abs(w.drift)));
  const rs = windows.map((w) => w.ret);
  const md = ds.reduce((a, b) => a + b, 0) / WINDOWS, mr = rs.reduce((a, b) => a + b, 0) / WINDOWS;
  const vd = ds.reduce((a, d) => a + (d - md) ** 2, 0);
  const beta = vd ? ds.reduce((a, d, i) => a + (d - md) * (rs[i]! - mr), 0) / vd : 0;

  let peak = 0, maxDD = 0, cum = 0, gp = 0, gl = 0;
  for (const [, d] of bt.fills) { cum += d; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum); d > 0 ? (gp += d) : (gl -= d); }
  return {
    key: `${rule.id}|${code}`, rule: rule.id, code, preset: p.id, horizon: p.horizon, goal: p.goal, perDay: bt.trades / Math.max(1e-9, (t1 - t0) / 86400_000),
    trades: bt.trades, winRate: bt.trades ? bt.wins / bt.trades : 0,
    pnl: bt.pnl, retPct: bt.pnl / capital * 100, maxDD: maxDD / capital * 100, profitFactor: gl ? gp / gl : gp ? 9.99 : 0,
    windows, consistency, oosRet: oosF.reduce((s, x) => s + x[1], 0) / capital * 100, oosWin: rate(oosF), isWin: rate(isF),
    trendCorr: corr(rs, ds), alpha: mr - beta * md, peers: [], peerRate: 0.5, score: 0, verdict: "THIN", outlook: 0,
  };
}

const peerCodes: Record<string, string[]> = Object.fromEntries(INSTRUMENTS.map((i) => {
  let peers = INSTRUMENTS.filter((x) => x.code !== i.code && x.cls === i.cls);
  if (peers.length < 2) peers = INSTRUMENTS.filter((x) => x.code !== i.code && (x.cls === "stock") === (i.cls === "stock"));
  return [i.code, peers.slice(0, 5).map((x) => x.code)];
}));

/** Peers come from the full matrix (same rule on similar assets) — a real edge should transfer. */
export function finalize(all: ComboStats[]) {
  const by = new Map(all.map((r) => [r.key, r]));
  // Extended-universe assets: peers are up to 5 other screened assets from the same exchange.
  const present = [...new Set(all.map((r) => r.code))].sort();
  const peersOf = (code: string) => peerCodes[code] ?? present.filter((c) => c !== code && c.split(".")[0] === code.split(".")[0]).slice(0, 5);
  for (const r of all) {
    r.peers = peersOf(r.code).map((c) => by.get(`${r.rule}|${c}`)).filter((x): x is ComboStats => !!x).map((x) => ({ code: x.code, pnl: x.pnl }));
    r.peerRate = r.peers.length ? r.peers.filter((x) => x.pnl > 0).length / r.peers.length : 0.5;
    score(r);
  }
}

function score(r: ComboStats) {
  const n = Math.min(1, r.trades / 20);
  const oos = r.oosRet > 0 ? (r.oosWin >= r.isWin - 0.15 ? 1 : 0.5) : 0;
  const trendFree = r.alpha > 0 ? 1 - Math.max(0, r.trendCorr) * 0.6 : 1 - Math.max(0, r.trendCorr);
  const calmar = r.retPct > 0 ? r.retPct / (r.retPct + r.maxDD) : 0;
  let s = 100 * n * (0.3 * r.consistency + 0.2 * oos + 0.2 * r.peerRate + 0.15 * trendFree + 0.15 * calmar);
  if (r.pnl <= 0) s *= 0.3;
  r.score = Math.round(s);

  if (r.trades < 8) r.verdict = "THIN";
  else if (r.pnl > 0 && r.trendCorr > 0.6 && r.alpha <= 0) r.verdict = "TREND";
  else if (r.pnl <= 0 || r.consistency < 0.5 || r.oosRet <= 0) r.verdict = "UNSTABLE";
  else if (r.consistency >= 0.67 && r.peerRate >= 0.5 && r.trendCorr < 0.6) r.verdict = "ROBUST";
  else r.verdict = "PROMISING";

  // Next-period outlook: Laplace-smoothed share of profitable windows, peers and the OOS test,
  // shrunk by trend dependence (if the trend flips, a trend-explained profit disappears).
  const wins = r.windows.filter((w) => w.ret > 0).length + r.peers.filter((x) => x.pnl > 0).length + (r.oosRet > 0 ? 1 : 0);
  const base = (wins + 1) / (WINDOWS + r.peers.length + 1 + 2);
  const trendPenalty = Math.max(0, r.trendCorr) * (r.alpha <= 0 ? 0.35 : 0.1);
  r.outlook = Math.round(Math.max(0.02, Math.min(0.95, base * (1 - trendPenalty) * (0.6 + 0.4 * n))) * 100);
}

export const historyFor = (cache: Map<string, Candle[]>, code: string, p: Preset, now: number) => {
  const k = `${code}|${p.ktype}|${p.bars}`;
  if (!cache.has(k)) cache.set(k, klines(code, p.ktype, p.bars, now).slice(0, -1));
  return cache.get(k)!;
};

export const ruleOf = (r: ComboStats) => LIB_BY_ID[r.rule]!;
export const tplOf = (r: ComboStats) => TEMPLATE_BY_ID[LIB_BY_ID[r.rule]!.template]!;

// ---------------- Ready-made bundles (100 auto-trade combos) ----------------

export type BundleKind = "Risk profile" | "Style" | "Strategy family" | "Single asset" | "Binary" | "Low drawdown"
  | "High win-rate" | "Trend-free" | "Fast turnover" | "All-weather" | "Quick sprint" | "High risk";

export interface Bundle {
  id: string; kind: BundleKind;
  name: string; icon: string; desc: string;
  filter: (r: ComboStats) => boolean; nShort: number; nLong: number; sort?: (a: ComboStats, b: ComboStats) => number;
  /** Pick at most one robot per value of this key (e.g. market group). */
  distinctBy?: (r: ComboStats) => string;
}
export interface FilledBundle { bundle: Bundle; picks: ComboStats[]; score: number; outlook: number }

const MARKETS: { id: string; label: string; icon: string; match: (code: string) => boolean }[] = [
  { id: "ALL", label: "All markets", icon: "🌐", match: () => true },
  { id: "US", label: "US stocks", icon: "🇺🇸", match: (c) => c.startsWith("US.") },
  { id: "FX", label: "Forex", icon: "💱", match: (c) => c.startsWith("FX.") },
  { id: "CC", label: "Crypto", icon: "🪙", match: (c) => c.startsWith("CC.") },
  { id: "HK", label: "HK stocks", icon: "🇭🇰", match: (c) => c.startsWith("HK.") },
  { id: "MY", label: "MY stocks", icon: "🇲🇾", match: (c) => c.startsWith("MY.") },
  { id: "IDX", label: "Indices", icon: "📊", match: (c) => c.startsWith("IDX.") },
  { id: "CM", label: "Commodities", icon: "🛢️", match: (c) => c.startsWith("CM.") },
];
const okV = (r: ComboStats) => r.verdict === "ROBUST" || r.verdict === "PROMISING";

function buildBundles(): Bundle[] {
  const out: Bundle[] = [];
  for (const m of MARKETS) {
    out.push({ id: `cons-${m.id}`, kind: "Risk profile", name: `Conservative · ${m.label}`, icon: "🛡", desc: "Only Consistent robots, weighted to long-term. Lowest drawdown first.",
      filter: (r) => m.match(r.code) && r.verdict === "ROBUST", nShort: 1, nLong: 3, sort: (a, b) => a.maxDD - b.maxDD || b.score - a.score });
    out.push({ id: `bal-${m.id}`, kind: "Risk profile", name: `Balanced · ${m.label}`, icon: "⚖", desc: "Consistent or Promising robots, half short-term, half long-term.",
      filter: (r) => m.match(r.code) && okV(r), nShort: 2, nLong: 2 });
    out.push({ id: `agg-${m.id}`, kind: "Risk profile", name: `Aggressive · ${m.label}`, icon: "🚀", desc: "Highest return among non-unstable robots, short-term heavy.",
      filter: (r) => m.match(r.code) && okV(r), nShort: 3, nLong: 1, sort: (a, b) => b.retPct - a.retPct });
    for (const g of GOALS) {
      const h = g.id === "QUICK" || g.id === "DAY";
      out.push({ id: `style-${g.id}-${m.id}`, kind: "Style", name: `${g.icon} ${g.title} · ${m.label}`, icon: g.icon, desc: `Top 3 stable robots for ${g.title.toLowerCase()} (hold ${g.hold.toLowerCase()}).`,
        filter: (r) => m.match(r.code) && r.goal === g.id && r.verdict !== "UNSTABLE" && r.verdict !== "THIN", nShort: h ? 3 : 0, nLong: h ? 0 : 3 });
    }
  }
  for (const cat of ["Trend", "Momentum", "Mean reversion", "Breakout", "Volatility", "Pattern", "Systematic"])
    for (const h of ["SHORT", "LONG"] as const)
      out.push({ id: `cat-${cat}-${h}`, kind: "Strategy family", name: `${cat} · ${h === "SHORT" ? "short-term" : "long-term"}`, icon: "🧬",
        desc: `Best 3 ${cat.toLowerCase()} robots on different assets.`,
        filter: (r) => tplOf(r).category === cat && r.horizon === h && r.verdict !== "UNSTABLE" && r.verdict !== "THIN", nShort: h === "SHORT" ? 3 : 0, nLong: h === "LONG" ? 3 : 0 });
  for (const i of INSTRUMENTS)
    out.push({ id: `asset-${i.code}`, kind: "Single asset", name: `${i.name} short + long`, icon: "🎯", desc: `Best short-term and long-term robot on ${i.code}.`,
      filter: (r) => r.code === i.code && r.verdict !== "UNSTABLE" && r.verdict !== "THIN", nShort: 1, nLong: 1 });
  for (const m of MARKETS.slice(1).filter((x) => x.id !== "IDX")) {
    out.push({ id: `bin-${m.id}`, kind: "Binary", name: `Binary scalpers · ${m.label}`, icon: "⏱", desc: "Three 60-second binary robots with the highest win rate that still pass the stability checks.",
      filter: (r) => m.match(r.code) && r.preset === "scalp" && okV(r), nShort: 3, nLong: 0, sort: (a, b) => b.winRate - a.winRate });
    out.push({ id: `lowdd-${m.id}`, kind: "Low drawdown", name: `Smooth equity · ${m.label}`, icon: "〰", desc: "Profitable robots with the smallest worst-case drawdown.",
      filter: (r) => m.match(r.code) && r.pnl > 0 && r.consistency >= 0.5 && r.trades >= 8, nShort: 1, nLong: 2, sort: (a, b) => a.maxDD / Math.max(0.01, a.retPct) - b.maxDD / Math.max(0.01, b.retPct) });
  }
  const quickish = (r: ComboStats) => r.goal === "QUICK" || r.goal === "HOURS";
  for (const g of GOALS) {
    const h = g.id === "QUICK" || g.id === "HOURS" || g.id === "DAY";
    out.push({ id: `win-${g.id}`, kind: "High win-rate", name: `Highest win-rate · ${g.title}`, icon: "🎯", desc: "Stable robots ranked by how often their trades win (confidence-adjusted for sample size).",
      filter: (r) => r.goal === g.id && okV(r), nShort: h ? 3 : 0, nLong: h ? 0 : 3, sort: (a, b) => winConfidence(b) - winConfidence(a) });
    out.push({ id: `tf-${g.id}`, kind: "Trend-free", name: `Trend-proof · ${g.title}`, icon: "🧭", desc: "Profit that doesn't depend on the market going up or down — least correlated with the trend.",
      filter: (r) => r.goal === g.id && okV(r) && r.trendCorr < 0.2, nShort: h ? 3 : 0, nLong: h ? 0 : 3, sort: (a, b) => Math.abs(a.trendCorr) - Math.abs(b.trendCorr) || b.score - a.score });
  }
  for (const m of MARKETS)
    out.push({ id: `fast-${m.id}`, kind: "Fast turnover", name: `Busiest robots · ${m.label}`, icon: "🏎", desc: "Consistent quick robots that trade the most often — results show up fastest.",
      filter: (r) => m.match(r.code) && quickish(r) && r.verdict === "ROBUST", nShort: 3, nLong: 0, sort: (a, b) => b.perDay - a.perDay });
  for (const [id, label, f, sort] of [
    ["cons", "Conservative", (r: ComboStats) => r.verdict === "ROBUST", (a: ComboStats, b: ComboStats) => a.maxDD - b.maxDD],
    ["bal", "Balanced", okV, undefined],
    ["agg", "Aggressive", okV, (a: ComboStats, b: ComboStats) => b.retPct - a.retPct],
  ] as const)
    out.push({ id: `aw-${id}`, kind: "All-weather", name: `All-weather · ${label}`, icon: "🌦", desc: "One robot per market (stocks, FX, crypto, commodities…) so no single market can sink the bundle.",
      filter: f, nShort: 3, nLong: 3, sort, distinctBy: (r) => r.code.split(".")[0]! });
  for (const p of ["scalp30", "scalp", "scalp2m", "bin5m", "bin15m"])
    for (const m of MARKETS.filter((x) => ["ALL", "FX", "CC"].includes(x.id)))
      out.push({ id: `sprint-${p}-${m.id}`, kind: "Quick sprint", name: `${PRESET_BY_ID[p]!.label} sprint · ${m.label}`, icon: "⚡", desc: `Three ${PRESET_BY_ID[p]!.blurb.toLowerCase()} robots with the best confidence-adjusted win rate.`,
        filter: (r) => m.match(r.code) && r.preset === p && okV(r), nShort: 3, nLong: 0, sort: (a, b) => winConfidence(b) - winConfidence(a) });
  for (const m of MARKETS.filter((x) => ["ALL", "FX", "CC"].includes(x.id)))
    out.push({ id: `risk-${m.id}`, kind: "High risk", name: `⚠ Martingale binaries · ${m.label}`, icon: "🎲", desc: "Doubles the stake after each loss. Wins often, but a losing streak can wipe out the balance fast. Practice account only.",
      filter: (r) => m.match(r.code) && LIB_BY_ID[r.rule]?.mm === "MARTINGALE" && r.pnl > 0 && r.trades >= 8, nShort: 3, nLong: 0, sort: (a, b) => b.winRate - a.winRate });
  return out;
}
export const BUNDLES: Bundle[] = buildBundles();

/** Wilson lower bound (95%) of the win rate — a high win rate on few trades counts for less. */
export function winConfidence(r: { winRate: number; trades: number }) {
  const n = r.trades, p = r.winRate, z = 1.96;
  if (!n) return 0;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
}

// ---------------- "Can I double my money?" simulator ----------------

export interface OddsInput {
  tradeR: number[];      // historical per-trade result as a multiple of the stake (binary: +payout / -1; stock: price move)
  perHour: number; hours: number; stakePct: number; target: number; mm: MoneyMgmt; paths?: number;
  /** If set, each trade wins with this probability (size drawn from past wins/losses) instead of replaying history as-is. */
  pWin?: number;
}
export interface Odds { pTarget: number; pProfit: number; pHalf: number; pBust: number; median: number; p10: number; p90: number; trades: number }

/** Monte Carlo: replays the robot's own trade results in random order for the chosen time window. */
export function doubleOdds(o: OddsInput): Odds {
  const N = o.paths ?? 4000, out: number[] = [];
  let seed = 0x9e3779b9;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lambda = o.perHour * o.hours;
  let hit = 0, prof = 0, half = 0, bust = 0, totalTrades = 0;
  const wins = o.tradeR.filter((r) => r > 0), losses = o.tradeR.filter((r) => r <= 0);
  const draw = () => {
    if (o.pWin == null || !wins.length || !losses.length) return o.tradeR[Math.floor(rnd() * o.tradeR.length)]!;
    const pool = rnd() < o.pWin ? wins : losses;
    return pool[Math.floor(rnd() * pool.length)]!;
  };
  for (let k = 0; k < N; k++) {
    // Poisson number of trades in the window
    let n = 0, L = Math.exp(-Math.min(lambda, 700)), p = 1;
    if (lambda > 60) n = Math.max(0, Math.round(lambda + Math.sqrt(lambda) * (rnd() + rnd() + rnd() - 1.5) * 2));
    else { do { n++; p *= rnd(); } while (p > L); n--; }
    let bal = 1, base = 0, mult = 1, reached = false;
    for (let i = 0; i < n && o.tradeR.length; i++) {
      if (mult === 1) base = (bal * o.stakePct) / 100;
      const stake = Math.min(bal, base * mult);
      const r = draw();
      bal += stake * r;
      const won = r > 0;
      mult = o.mm === "MARTINGALE" ? (won ? 1 : Math.min(mult * 2, 16)) : o.mm === "ANTI_MARTINGALE" ? (won ? Math.min(mult * 2, 8) : 1) : 1;
      totalTrades++;
      if (bal <= 0.01) { bal = 0; break; }
      if (bal >= o.target) { reached = true; break; }
    }
    if (reached) hit++;
    if (bal > 1) prof++;
    if (bal <= 0.5) half++;
    if (bal <= 0.05) bust++;
    out.push(bal);
  }
  out.sort((a, b) => a - b);
  return { pTarget: hit / N, pProfit: prof / N, pHalf: half / N, pBust: bust / N, median: out[Math.floor(N / 2)]!, p10: out[Math.floor(N * 0.1)]!, p90: out[Math.floor(N * 0.9)]!, trades: totalTrades / N };
}

/** About 7 days of history per timeframe — the ranking uses ~10 hours for 1-minute styles, which can flatter a robot. */
export const LONG_BARS: Record<string, number> = { K_1M: 10080, K_5M: 2016, K_15M: 672, K_60M: 720, K_DAY: 400 };

export interface LongCheck { trades: number; win: number; cautious: number; edge: number; halfKelly: number; tradeR: number[] }
/** Re-tests a combo on ~7 days of history: cautious win rate, expected result per $1 staked and a half-Kelly stake. */
export function longCheck(rule: LibRule, code: string, cache: Map<string, Candle[]>): LongCheck {
  const p = PRESET_BY_ID[rule.preset]!, k = `${code}|${p.ktype}|long`;
  if (!cache.has(k)) cache.set(k, klines(code, p.ktype, LONG_BARS[p.ktype] ?? 2000).slice(0, -1));
  const R = tradeReturns(rule, code, cache.get(k)!);
  const wins = R.filter((r) => r > 0), win = R.length ? wins.length / R.length : 0;
  const cautious = winConfidence({ winRate: win, trades: R.length });
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const losses = R.filter((r) => r <= 0), avgLoss = losses.length ? -losses.reduce((a, b) => a + b, 0) / losses.length : 1;
  const edge = cautious * avgWin - (1 - cautious) * avgLoss;
  const kelly = avgWin && avgLoss ? cautious / avgLoss - (1 - cautious) / avgWin : 0;
  return { trades: R.length, win, cautious, edge, halfKelly: Math.max(0, kelly / 2), tradeR: R };
}

/** Per-trade results (as a multiple of the stake) from a fresh backtest of the combo. */
export function tradeReturns(rule: LibRule, code: string, candles: Candle[]): number[] {
  const p = PRESET_BY_ID[rule.preset]!, cfg = comboConfig({ ...rule, mm: undefined }, code);
  const bt = runBacktest({ ...rule, mm: undefined }, code, candles);
  return bt.fills.map(([t, d]) => (p.mode === "BINARY" ? d / cfg.amount : d / (cfg.amount * priceAt(code, t))));
}

/** Fills each bundle from the current ranking, one robot per asset+template so picks diversify. */
export function fillBundles(all: ComboStats[]): FilledBundle[] {
  const sorted = [...all].sort((a, b) => b.score - a.score);
  return BUNDLES.map((b) => {
    const cand = sorted.filter(b.filter);
    if (b.sort) cand.sort(b.sort);
    const picks: ComboStats[] = [], used = new Set<string>(), usedKey = new Set<string>();
    const take = (h: Horizon, n: number) => {
      for (const r of cand) {
        if (picks.filter((p) => p.horizon === h).length >= n) break;
        const k = `${r.code}|${ruleOf(r).template}`, dk = b.distinctBy?.(r);
        if (r.horizon === h && !used.has(k) && (dk == null || !usedKey.has(dk))) { used.add(k); if (dk != null) usedKey.add(dk); picks.push(r); }
      }
    };
    take("SHORT", b.nShort); take("LONG", b.nLong);
    const full = picks.length === b.nShort + b.nLong;
    const avg = (f: (r: ComboStats) => number) => (picks.length ? picks.reduce((s, r) => s + f(r), 0) / picks.length : 0);
    const codes = new Set(picks.map((p) => p.code)).size;
    return { bundle: b, picks, score: Math.min(100, Math.round(avg((r) => r.score) * (full ? 1 : 0.6) * (codes > 1 ? 1.05 : 1))), outlook: Math.round(avg((r) => r.outlook)) };
  }).sort((a, b) => b.score - a.score || b.outlook - a.outlook || b.picks.length - a.picks.length);
}
