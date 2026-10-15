// Risk indicator: anomaly detectors (templates) → guard combos → guards the user runs.
// A tripped guard blocks NEW trades in its scope (robots and manual) until the anomaly clears and
// the cool-down passes. Exits and stop-losses are never blocked.
// Detectors are volatility-scaled: thresholds are in multiples of each instrument's own normal
// 15-minute move (σ), so one setting works for Bitcoin and EUR/USD alike.

import { INSTRUMENTS, priceAt } from "./market";

export type RiskGroup = "ALL" | "US" | "HK" | "MY" | "FX" | "CRYPTO" | "COMMOD" | "INDEX";
export const RISK_GROUPS: { id: RiskGroup; label: string; icon: string }[] = [
  { id: "ALL", label: "All markets", icon: "🌐" }, { id: "US", label: "US stocks", icon: "🇺🇸" }, { id: "HK", label: "HK stocks", icon: "🇭🇰" },
  { id: "MY", label: "MY stocks", icon: "🇲🇾" }, { id: "FX", label: "Forex", icon: "💱" }, { id: "CRYPTO", label: "Crypto", icon: "🪙" },
  { id: "COMMOD", label: "Commodities", icon: "🛢" }, { id: "INDEX", label: "Indices", icon: "📊" },
];
export function groupOfCode(code: string): RiskGroup {
  const p = code.split(".")[0];
  return p === "US" ? "US" : p === "HK" ? "HK" : p === "MY" ? "MY" : p === "FX" ? "FX" : p === "CC" ? "CRYPTO" : p === "CM" ? "COMMOD" : "INDEX";
}
export const codesIn = (g: RiskGroup) => INSTRUMENTS.filter((i) => g === "ALL" || groupOfCode(i.code) === g).map((i) => i.code);

const M = 60_000;
export interface AssetRisk {
  code: string; group: RiskGroup; price: number;
  r15: number; r60: number; r24h: number;     // % change
  sigma: number;                               // normal 15-minute move, % (baseline: previous 24h)
  volRatio: number;                            // last hour's volatility ÷ normal
  maxZ: number;                                // biggest 1-minute move in the last 15 min, in normal 1-minute moves
  ddHigh: number;                              // % below the 24h high
  rets1m: number[];                            // last 60 one-minute returns (for contagion)
}

const sd = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };

export function assetRisk(code: string, now: number): AssetRisk {
  const t = Math.floor(now / M) * M, p = (ms: number) => priceAt(code, ms);
  const last = Array.from({ length: 61 }, (_, i) => p(t - (60 - i) * M));
  const rets1m = last.slice(1).map((x, i) => (x / last[i]! - 1) * 100);
  const base = Array.from({ length: 97 }, (_, i) => p(t - 3600_000 - (96 - i) * 15 * M));
  const base15 = base.slice(1).map((x, i) => (x / base[i]! - 1) * 100);
  const sigma = Math.max(1e-6, sd(base15));
  const now0 = last[60]!;
  const hi = Math.max(...base, ...last);
  const sigma1 = sigma / Math.sqrt(15);
  return {
    code, group: groupOfCode(code), price: now0,
    r15: (now0 / last[45]! - 1) * 100, r60: (now0 / last[0]! - 1) * 100, r24h: (now0 / p(t - 86_400_000) - 1) * 100,
    sigma, volRatio: (sd(rets1m) * Math.sqrt(15)) / sigma,
    maxZ: Math.max(...rets1m.slice(45).map((r) => Math.abs(r))) / sigma1,
    ddHigh: (now0 / hi - 1) * 100, rets1m,
  };
}

export interface RiskSnapshot { ts: number; assets: Record<string, AssetRisk> }
export function riskSnapshot(now = Date.now(), codes = INSTRUMENTS.map((i) => i.code)): RiskSnapshot {
  return { ts: now, assets: Object.fromEntries(codes.map((c) => [c, assetRisk(c, now)])) };
}

function corr(a: number[], b: number[]) {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += (a[i]! - ma) * (b[i]! - mb); aa += (a[i]! - ma) ** 2; bb += (b[i]! - mb) ** 2; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** Context only the server knows (account and robots). */
export interface RiskContext { accountDDPct?: number; robotsStopped30m?: number }

export interface Hit { detector: string; target: string; value: number; threshold: number; text: string }

export interface Detector {
  id: string; name: string; icon: string; kind: "asset" | "group" | "account";
  desc: string; param: { label: string; def: number; unit: string };
  eval: (snap: RiskSnapshot, scope: string[], k: number, ctx: RiskContext) => Hit[];
}

const perAsset = (id: string, test: (a: AssetRisk, k: number) => [number, number] | null, text: (a: AssetRisk, v: number, th: number) => string) =>
  (snap: RiskSnapshot, scope: string[], k: number): Hit[] => scope.flatMap((c) => {
    const a = snap.assets[c]; if (!a) return [];
    const r = test(a, k); return r ? [{ detector: id, target: c, value: r[0], threshold: r[1], text: text(a, r[0], r[1]) }] : [];
  });

export const DETECTORS: Detector[] = [
  { id: "crash15", name: "Sudden crash (15 min)", icon: "📉", kind: "asset", desc: "Price falls more than k normal 15-minute moves within 15 minutes.",
    param: { label: "k × σ", def: 3, unit: "σ" },
    eval: perAsset("crash15", (a, k) => (a.r15 <= -k * a.sigma ? [a.r15, -k * a.sigma] : null), (a, v) => `${a.code} ${v.toFixed(2)}% in 15 min`) },
  { id: "crash60", name: "Crash (1 hour)", icon: "🔻", kind: "asset", desc: "Price falls more than k normal hourly moves within the last hour.",
    param: { label: "k × σ", def: 3, unit: "σ" },
    eval: perAsset("crash60", (a, k) => (a.r60 <= -k * a.sigma * 2 ? [a.r60, -k * a.sigma * 2] : null), (a, v) => `${a.code} ${v.toFixed(2)}% in 1 h`) },
  { id: "flash", name: "Flash move", icon: "⚡", kind: "asset", desc: "A single 1-minute candle moves more than k normal 1-minute moves — either direction.",
    param: { label: "k × σ₁ₘ", def: 6, unit: "σ" },
    eval: perAsset("flash", (a, k) => (a.maxZ >= k ? [a.maxZ, k] : null), (a, v) => `${a.code} 1-min move ${v.toFixed(1)}× normal`) },
  { id: "volstorm", name: "Volatility storm", icon: "🌪", kind: "asset", desc: "Last hour's volatility is more than k times normal.",
    param: { label: "× normal", def: 2.5, unit: "×" },
    eval: perAsset("volstorm", (a, k) => (a.volRatio >= k ? [a.volRatio, k] : null), (a, v) => `${a.code} volatility ${v.toFixed(1)}× normal`) },
  { id: "dd24", name: "Slide from 24h high", icon: "🧗", kind: "asset", desc: "Price is more than k normal daily moves below its 24-hour high.",
    param: { label: "k × daily σ", def: 2, unit: "σ" },
    eval: perAsset("dd24", (a, k) => { const th = -k * a.sigma * Math.sqrt(96); return a.ddHigh <= th ? [a.ddHigh, th] : null; }, (a, v) => `${a.code} ${v.toFixed(2)}% below 24h high`) },
  { id: "breadth", name: "Market-wide selloff", icon: "🌊", kind: "group", desc: "At least k% of the markets in scope are down more than 1.5 normal hourly moves.",
    param: { label: "% of markets", def: 60, unit: "%" },
    eval: (snap, scope, k) => {
      const xs = scope.map((c) => snap.assets[c]).filter((a): a is AssetRisk => !!a);
      if (xs.length < 2) return [];
      const down = xs.filter((a) => a.r60 <= -1.5 * a.sigma * 2).length / xs.length * 100;
      return down >= k ? [{ detector: "breadth", target: "scope", value: down, threshold: k, text: `${down.toFixed(0)}% of ${xs.length} markets falling together` }] : [];
    } },
  { id: "contagion", name: "Contagion (everything moves together)", icon: "🔗", kind: "group", desc: "Average correlation of 1-minute moves across the scope rises above k — typical of panics.",
    param: { label: "correlation", def: 0.7, unit: "" },
    eval: (snap, scope, k) => {
      const xs = scope.map((c) => snap.assets[c]).filter((a): a is AssetRisk => !!a);
      if (xs.length < 3) return [];
      let s = 0, n = 0;
      for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) { s += corr(xs[i]!.rets1m, xs[j]!.rets1m); n++; }
      const c = s / n;
      return c >= k ? [{ detector: "contagion", target: "scope", value: c, threshold: k, text: `markets moving together (corr ${c.toFixed(2)})` }] : [];
    } },
  { id: "acctdd", name: "Account drawdown", icon: "🏦", kind: "account", desc: "Session balance is down more than k% from where it started.",
    param: { label: "% loss", def: 20, unit: "%" },
    eval: (_s, _sc, k, ctx) => (ctx.accountDDPct != null && ctx.accountDDPct >= k ? [{ detector: "acctdd", target: "account", value: ctx.accountDDPct, threshold: k, text: `session down ${ctx.accountDDPct.toFixed(1)}%` }] : []) },
  { id: "meltdown", name: "Robot meltdown", icon: "🤖", kind: "account", desc: "At least k robots auto-stopped (losing streaks) in the last 30 minutes.",
    param: { label: "robots", def: 3, unit: "" },
    eval: (_s, _sc, k, ctx) => ((ctx.robotsStopped30m ?? 0) >= k ? [{ detector: "meltdown", target: "account", value: ctx.robotsStopped30m!, threshold: k, text: `${ctx.robotsStopped30m} robots auto-stopped in 30 min` }] : []) },
];
export const DETECTOR_BY_ID = Object.fromEntries(DETECTORS.map((d) => [d.id, d]));

export interface GuardConfig {
  scope: RiskGroup;
  /** true: block only the assets that triggered; false: block the whole scope. */
  perAsset: boolean;
  detectors: { id: string; k: number }[];
  cooldownMin: number;
}
export interface Combo extends GuardConfig { id: string; name: string; icon: string; desc: string; scenario: string }

const D = (id: string, k?: number) => ({ id, k: k ?? DETECTOR_BY_ID[id]!.param.def });
export const COMBOS: Combo[] = [
  { id: "market_crash", name: "Market crash shield", icon: "🛡", scenario: "Market crash", scope: "ALL", perAsset: false, cooldownMin: 60,
    desc: "Halts all new trading when many markets fall together or move in lock-step.", detectors: [D("breadth"), D("contagion"), D("crash60", 4)] },
  { id: "crypto_crash", name: "Crypto crash shield", icon: "🪙", scenario: "Crypto crash", scope: "CRYPTO", perAsset: false, cooldownMin: 60,
    desc: "Stops new crypto trades on a sharp drop, a flash move or a volatility storm in BTC/ETH.", detectors: [D("crash15"), D("crash60"), D("flash"), D("volstorm")] },
  { id: "us_selloff", name: "US selloff guard", icon: "🇺🇸", scenario: "Stock market crash", scope: "US", perAsset: false, cooldownMin: 45,
    desc: "Pauses US stock trading when most US names fall together.", detectors: [D("breadth", 50), D("crash60")] },
  { id: "flash_breaker", name: "Flash-crash breaker", icon: "⚡", scenario: "Flash crash", scope: "ALL", perAsset: true, cooldownMin: 30,
    desc: "Blocks only the asset that just jumped or crashed in one candle.", detectors: [D("flash"), D("crash15", 4)] },
  { id: "vol_storm", name: "Volatility storm", icon: "🌪", scenario: "Panic / news shock", scope: "ALL", perAsset: true, cooldownMin: 30,
    desc: "Skips assets whose volatility explodes — signals stop meaning anything.", detectors: [D("volstorm")] },
  { id: "fx_shock", name: "FX shock", icon: "💱", scenario: "Currency shock", scope: "FX", perAsset: true, cooldownMin: 30,
    desc: "Central-bank-style jumps in currency pairs.", detectors: [D("flash", 5), D("crash15")] },
  { id: "commod_shock", name: "Oil & gold shock", icon: "🛢", scenario: "Commodity shock", scope: "COMMOD", perAsset: true, cooldownMin: 45,
    desc: "Sharp moves in oil or gold.", detectors: [D("crash60"), D("flash"), D("dd24")] },
  { id: "acct_brake", name: "Account drawdown brake", icon: "🏦", scenario: "Bot losing money", scope: "ALL", perAsset: false, cooldownMin: 240,
    desc: "Stops everything if this session has lost 20% of its starting balance.", detectors: [D("acctdd")] },
  { id: "robot_melt", name: "Robot meltdown brake", icon: "🤖", scenario: "Strategy failure", scope: "ALL", perAsset: false, cooldownMin: 60,
    desc: "If several robots hit their losing streak at once, the market regime has probably changed.", detectors: [D("meltdown")] },
  { id: "max_protect", name: "Maximum protection", icon: "🧱", scenario: "Any of the above", scope: "ALL", perAsset: false, cooldownMin: 60,
    desc: "Every detector at once — the most cautious setting; expect more pauses.",
    detectors: [D("crash15"), D("crash60"), D("flash"), D("volstorm", 2.2), D("dd24"), D("breadth"), D("contagion"), D("acctdd", 15), D("meltdown")] },
];
export const COMBO_BY_ID = Object.fromEntries(COMBOS.map((c) => [c.id, c]));

/** Evaluates one guard: which detectors fire, and which instruments to block. */
export function evaluateGuard(cfg: GuardConfig, snap: RiskSnapshot, ctx: RiskContext = {}) {
  const scope = codesIn(cfg.scope);
  const hits = cfg.detectors.flatMap((d) => DETECTOR_BY_ID[d.id]?.eval(snap, scope, d.k, ctx) ?? []);
  const assetHits = hits.filter((h) => h.target !== "scope" && h.target !== "account").map((h) => h.target);
  const whole = !cfg.perAsset || hits.some((h) => h.target === "scope" || h.target === "account");
  return { hits, blocked: hits.length ? (whole ? scope : [...new Set(assetHits)]) : [] };
}
