// Rule library: each entry is a template + concrete parameters + trading style. The server only
// needs template + params, so library rules run on the existing engine with no schema change.
// 1,000 tuned variants are generated from parameter grids, plus each template's default setup.

import { MONEY_MGMT, TEMPLATES, TEMPLATE_BY_ID, type MoneyMgmt, type ParamDef, type RuleMode, type Template } from "./strategies";

export type Horizon = "SHORT" | "LONG";
export type Goal = "QUICK" | "HOURS" | "DAY" | "WEEK" | "MONTH";

/** Trading types the user picks from, in plain language. */
export const GOALS: { id: Goal; icon: string; title: string; tagline: string; hold: string; check: string; risk: string }[] = [
  { id: "QUICK", icon: "⚡", title: "Quick profit", tagline: "In and out within minutes — small, fast gains.", hold: "30 seconds – 15 minutes", check: "Stay on the screen", risk: "Very high · many small bets" },
  { id: "HOURS", icon: "⏳", title: "Few hours", tagline: "Open a trade, check back in an hour or two.", hold: "30 minutes – 4 hours", check: "Every hour or so", risk: "High" },
  { id: "DAY", icon: "☀️", title: "Day trading", tagline: "Catch moves during the day, flat by the evening.", hold: "Minutes to a few hours", check: "A few times a day", risk: "Medium-high" },
  { id: "WEEK", icon: "🗓", title: "Weekly swing", tagline: "Ride a move for a few days. Still active, but not glued to the screen.", hold: "1–7 days", check: "Once a day", risk: "Medium" },
  { id: "MONTH", icon: "📆", title: "Long-term", tagline: "Buy and check back next month. Fewer, bigger moves.", hold: "Weeks to months", check: "Once a week or month", risk: "Lower · wide stops" },
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g])) as Record<Goal, (typeof GOALS)[number]>;

export interface Preset {
  id: string; horizon: Horizon; goal: Goal; label: string; blurb: string; mode: RuleMode; ktype: string; bars: number;
  expiry: number; sl: number | null; tp: number | null;
}

export const PRESETS: Preset[] = [
  { id: "scalp30", horizon: "SHORT", goal: "QUICK", label: "⚡ Binary 30s", blurb: "1-min candles, 30-second binary options", mode: "BINARY", ktype: "K_1M", bars: 600, expiry: 30, sl: null, tp: null },
  { id: "scalp", horizon: "SHORT", goal: "QUICK", label: "⚡ Binary 60s", blurb: "1-min candles, 60-second binary options", mode: "BINARY", ktype: "K_1M", bars: 600, expiry: 60, sl: null, tp: null },
  { id: "scalp2m", horizon: "SHORT", goal: "QUICK", label: "⚡ Binary 2m", blurb: "1-min candles, 2-minute binary options", mode: "BINARY", ktype: "K_1M", bars: 600, expiry: 120, sl: null, tp: null },
  { id: "micro", horizon: "SHORT", goal: "QUICK", label: "⚡ Micro scalp", blurb: "1-min candles, stock, 0.25% stop / 0.35% target", mode: "STOCK", ktype: "K_1M", bars: 600, expiry: 60, sl: 0.25, tp: 0.35 },
  { id: "quick", horizon: "SHORT", goal: "QUICK", label: "⚡ Stock scalp", blurb: "1-min candles, stock, 0.4% stop / 0.6% target", mode: "STOCK", ktype: "K_1M", bars: 600, expiry: 60, sl: 0.4, tp: 0.6 },
  { id: "burst", horizon: "SHORT", goal: "QUICK", label: "⚡ Momentum burst", blurb: "1-min candles, stock, 0.6% stop / 1.2% target", mode: "STOCK", ktype: "K_1M", bars: 600, expiry: 60, sl: 0.6, tp: 1.2 },
  { id: "bin5m", horizon: "SHORT", goal: "HOURS", label: "⏳ Binary 5m", blurb: "5-min candles, 5-minute binary options", mode: "BINARY", ktype: "K_5M", bars: 600, expiry: 300, sl: null, tp: null },
  { id: "bin15m", horizon: "SHORT", goal: "HOURS", label: "⏳ Binary 15m", blurb: "15-min candles, 15-minute binary options", mode: "BINARY", ktype: "K_15M", bars: 600, expiry: 900, sl: null, tp: null },
  { id: "hours", horizon: "SHORT", goal: "HOURS", label: "⏳ Hour trade", blurb: "15-min candles, stock, 1.5% stop / 2.5% target", mode: "STOCK", ktype: "K_15M", bars: 600, expiry: 60, sl: 1.5, tp: 2.5 },
  { id: "intraday", horizon: "SHORT", goal: "DAY", label: "☀️ Intraday", blurb: "5-min candles, stock, 1% stop / 1.5% target", mode: "STOCK", ktype: "K_5M", bars: 600, expiry: 60, sl: 1, tp: 1.5 },
  { id: "dayrun", horizon: "SHORT", goal: "DAY", label: "☀️ Day runner", blurb: "5-min candles, stock, 0.7% stop / 2% target — small loss, bigger win", mode: "STOCK", ktype: "K_5M", bars: 600, expiry: 60, sl: 0.7, tp: 2 },
  { id: "swing", horizon: "LONG", goal: "WEEK", label: "🗓 Swing", blurb: "1-hour candles, stock, 4% stop / 8% target", mode: "STOCK", ktype: "K_60M", bars: 720, expiry: 60, sl: 4, tp: 8 },
  { id: "swing2", horizon: "LONG", goal: "WEEK", label: "🗓 Tight swing", blurb: "1-hour candles, stock, 2.5% stop / 4% target", mode: "STOCK", ktype: "K_60M", bars: 720, expiry: 60, sl: 2.5, tp: 4 },
  { id: "position", horizon: "LONG", goal: "MONTH", label: "🏔 Position", blurb: "1-hour candles, stock, wide 8% stop, no target — let winners run", mode: "STOCK", ktype: "K_60M", bars: 720, expiry: 60, sl: 8, tp: null },
  { id: "invest", horizon: "LONG", goal: "MONTH", label: "📆 Invest", blurb: "Daily candles, stock, 12% stop / 25% target — check monthly", mode: "STOCK", ktype: "K_DAY", bars: 400, expiry: 60, sl: 12, tp: 25 },
];
export const PRESET_BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

export interface LibRule { id: string; name: string; template: string; params: Record<string, number>; preset: string; isDefault: boolean; mm?: MoneyMgmt }

type Grid = Record<string, number[]>;
const GRIDS: Record<string, { grid: Grid; ok?: (p: Record<string, number>) => boolean }> = {
  sma_cross: { grid: { fast: [5, 7, 9, 12, 15, 20], slow: [21, 26, 30, 40, 50, 100] }, ok: (p) => p.slow! >= p.fast! * 1.6 },
  ema_cross: { grid: { fast: [5, 8, 10, 12, 15, 20], slow: [21, 26, 34, 50, 89, 100] }, ok: (p) => p.slow! >= p.fast! * 1.6 },
  golden_cross: { grid: { fast: [20, 30, 50, 60, 80, 100], slow: [100, 150, 200, 250] }, ok: (p) => p.slow! >= p.fast! * 1.5 },
  macd_cross: { grid: { fast: [8, 10, 12, 15], slow: [21, 26, 35], signal: [5, 7, 9, 12] } },
  rsi_reversal: { grid: { period: [5, 7, 9, 14, 21], oversold: [20, 25, 30, 35], overbought: [65, 70, 75, 80] }, ok: (p) => p.oversold! + p.overbought! === 100 },
  stoch_cross: { grid: { k: [5, 9, 14, 21], d: [3, 5], oversold: [20, 25, 30], overbought: [70, 75, 80] }, ok: (p) => p.oversold! + p.overbought! === 100 },
  bb_reversion: { grid: { period: [10, 14, 20, 30, 40], mult: [1.5, 1.8, 2, 2.2, 2.5, 3] } },
  bb_breakout: { grid: { period: [10, 14, 20, 30, 40], mult: [1.5, 1.8, 2, 2.2, 2.5, 3] } },
  donchian: { grid: { period: [7, 10, 14, 20, 30, 40, 55, 70, 100] } },
  supertrend: { grid: { period: [7, 10, 14, 21], mult: [1.5, 2, 2.5, 3, 3.5, 4] } },
  roc_momentum: { grid: { period: [5, 10, 14, 20, 30], threshold: [0.1, 0.2, 0.3, 0.5, 0.8, 1.2] } },
  zscore: { grid: { period: [10, 14, 20, 30, 50], entry: [1.5, 1.8, 2, 2.2, 2.5, 3] } },
  ema_rsi: { grid: { trend: [20, 50, 100, 200], period: [7, 14], pull: [30, 35, 40, 45] } },
  dca: { grid: { every: [3, 5, 10, 15, 20, 30, 60] } },
  grid: { grid: { step: [0.2, 0.3, 0.4, 0.6, 0.8, 1, 1.5, 2, 3] } },
  williams_r: { grid: { period: [7, 10, 14, 21, 30], zone: [10, 15, 20, 25, 30] } },
  cci_reversion: { grid: { period: [10, 14, 20, 30, 40], level: [80, 100, 150, 200] } },
  keltner: { grid: { period: [10, 14, 20, 30, 50], mult: [1, 1.5, 2, 2.5, 3] } },
  triple_ema: { grid: { fast: [3, 5, 8, 10], mid: [8, 13, 21], slow: [21, 34, 55, 100, 200] }, ok: (p) => p.mid! > p.fast! * 1.4 && p.slow! > p.mid! * 1.6 },
  rsi2: { grid: { trend: [50, 100, 150, 200], low: [2, 5, 10, 15, 20] } },
};

function cartesian(g: Grid): Record<string, number>[] {
  return Object.entries(g).reduce<Record<string, number>[]>((acc, [k, vs]) => acc.flatMap((a) => vs.map((v) => ({ ...a, [k]: v }))), [{}]);
}

function h(s: string) { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; }

const short = (t: string) => TEMPLATE_BY_ID[t]!.name.replace(/ \(.*\)$/, "").replace(/ (Crossover|Signal Cross|Overbought \/ Oversold|Oscillator|Mean Reversion|Breakout|Reversion|Alignment|Reversal|Trading)$/, "");

export const VARIANT_COUNT = 1000;

function build(): LibRule[] {
  const defaults: LibRule[] = [], pool: LibRule[][] = [];
  for (const t of TEMPLATES) {
    if (t.id === "price_level") continue;
    const presets = PRESETS.filter((p) => t.modes.includes(p.mode));
    const def = Object.fromEntries(t.params.map((p) => [p.key, p.def]));
    for (const p of presets) defaults.push({ id: `${t.id}~def~${p.id}`, name: `${t.name}`, template: t.id, params: def, preset: p.id, isDefault: true });
    const g = GRIDS[t.id];
    if (!g) continue;
    const combos = cartesian(g.grid).filter((x) => (g.ok ? g.ok(x) : true) && JSON.stringify(x) !== JSON.stringify(def));
    const mine = combos.flatMap((x) => presets.map((p) => {
      const sig = t.params.map((d) => x[d.key]).join("/");
      return { id: `${t.id}~${sig}~${p.id}`, name: `${short(t.id)} ${sig}`, template: t.id, params: x, preset: p.id, isDefault: false };
    })).sort((a, b) => h(a.id) - h(b.id));
    pool.push(mine);
  }
  // Round-robin across templates so every strategy family is fairly represented.
  const variants: LibRule[] = [];
  for (let i = 0; variants.length < VARIANT_COUNT && pool.some((p) => p.length > i); i++)
    for (const p of pool) if (p[i] && variants.length < VARIANT_COUNT) variants.push(p[i]!);
  return [...defaults, ...variants];
}


// ---------------- Catalogue: ~1M rules, generated on demand ----------------
// Every template gets a value ladder per parameter around its default (within min/max). Each valid
// parameter combination × compatible style (× money management for binary styles) is one rule.
// Rules are decoded from an index, so nothing is stored up front.

const LEVELS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.4, 3];
function ladder(d: ParamDef, n: number): number[] {
  // (oscillator thresholds are kept inside 1–99)
  const lv = n >= LEVELS.length ? LEVELS : Array.from(new Set([...Array.from({ length: n }, (_, i) => LEVELS[Math.round((i * (LEVELS.length - 1)) / (n - 1))]!), 1]));
  const int = Number.isInteger(d.def) && !d.step;
  const out = new Set<number>();
  for (const k of lv) {
    let v = d.def * k;
    if (d.min != null) v = Math.max(d.min, v);
    if (d.max != null) v = Math.min(d.max, v);
    if (PCT_KEYS.test(d.key)) v = Math.min(99, Math.max(1, v));
    v = int ? Math.round(v) : Math.round(v / (d.step ?? 0.01)) * (d.step ?? 0.01);
    out.add(+v.toFixed(4));
  }
  return [...out].sort((a, b) => a - b);
}
const PAIRS: [string, string][] = [["fast", "slow"], ["fast", "mid"], ["mid", "slow"], ["oversold", "overbought"], ["tenkan", "kijun"], ["low", "high"]];
const validCombo = (p: Record<string, number>) => PAIRS.every(([a, b]) => p[a] == null || p[b] == null || p[a]! < p[b]!);

const MMS = Object.keys(MONEY_MGMT) as MoneyMgmt[];
interface Fam { tpl: Template; values: number[][]; combos: Int16Array[]; presets: Preset[]; perCombo: number; size: number; start: number }
let FAMS: Fam[] | null = null;
const N2 = 13, N3 = 9;
const PCT_KEYS = /^(oversold|overbought|low|zone|edge|adx|pull)$/;
function fams(): Fam[] {
  if (FAMS) return FAMS;
  let start = 0;
  FAMS = TEMPLATES.filter((t) => t.id !== "price_level").map((tpl) => {
    const k = tpl.params.length;
    const n = k <= 1 ? 40 : k === 2 ? N2 : k === 3 ? N3 : k === 4 ? 6 : 5;
    const values = tpl.params.map((d) => (k <= 1 ? ladder40(d) : ladder(d, n)));
    const combos: Int16Array[] = [];
    const idx = new Int16Array(k);
    const rec = (j: number) => {
      if (j === k) {
        const p = Object.fromEntries(tpl.params.map((d, i) => [d.key, values[i]![idx[i]!]!]));
        if (validCombo(p)) combos.push(idx.slice());
        return;
      }
      for (let v = 0; v < values[j]!.length; v++) { idx[j] = v; rec(j + 1); }
    };
    rec(0);
    const presets = PRESETS.filter((p) => tpl.modes.includes(p.mode));
    const perCombo = presets.reduce((s, p) => s + (p.mode === "BINARY" ? MMS.length : 1), 0);
    const f = { tpl, values, combos, presets, perCombo, size: combos.length * perCombo, start };
    start += f.size;
    return f;
  });
  return FAMS;
}
/** Single-parameter templates get a fine 40-step ladder across their whole range. */
function ladder40(d: ParamDef): number[] {
  const lo = d.min ?? Math.max(1, d.def / 4), hi = d.max ?? d.def * 4, int = Number.isInteger(d.def) && !d.step;
  const out = new Set<number>();
  for (let i = 0; i < 40; i++) {
    let v = lo * (hi / lo) ** (i / 39);
    v = int ? Math.round(v) : Math.round(v / (d.step ?? 0.01)) * (d.step ?? 0.01);
    out.add(+v.toFixed(4));
  }
  return [...out].sort((a, b) => a - b);
}

function make(f: Fam, ci: number, slot: number): LibRule {
  let preset = f.presets[0]!, mm: MoneyMgmt | undefined;
  for (const p of f.presets) {
    const w = p.mode === "BINARY" ? MMS.length : 1;
    if (slot < w) { preset = p; mm = p.mode === "BINARY" ? MMS[slot] : undefined; break; }
    slot -= w;
  }
  const c = f.combos[ci]!;
  const params = Object.fromEntries(f.tpl.params.map((d, i) => [d.key, f.values[i]![c[i]!]!]));
  const sig = f.tpl.params.map((d) => params[d.key]).join("/");
  const isDefault = f.tpl.params.every((d) => params[d.key] === d.def);
  const tag = mm && mm !== "FIXED" ? ` ${mm === "MARTINGALE" ? "· Martingale" : "· Anti-martingale"}` : "";
  return { id: `${f.tpl.id}~${sig || "def"}~${preset.id}${mm && mm !== "FIXED" ? `~${mm}` : ""}`, name: `${short(f.tpl.id)}${sig ? ` ${sig}` : ""}${tag}`,
    template: f.tpl.id, params, preset: preset.id, isDefault, mm: mm && mm !== "FIXED" ? mm : undefined };
}

export const CATALOG = {
  get size() { const f = fams(); return f.at(-1)!.start + f.at(-1)!.size; },
  /** Rule number i (0-based) in a stable order: template → parameter combo → style. */
  at(i: number): LibRule {
    const f = fams().find((x) => i >= x.start && i < x.start + x.size)!;
    const j = i - f.start;
    return make(f, Math.floor(j / f.perCombo), j % f.perCombo);
  },
  /** Page through rules matching template/style filters without materialising the catalogue. */
  page(opts: { template?: string; preset?: string; goal?: Goal; mm?: string; mode?: RuleMode; offset: number; limit: number }) {
    const out: LibRule[] = [];
    let total = 0;
    for (const f of fams()) {
      if (opts.template && f.tpl.id !== opts.template) continue;
      const slots: number[] = [];
      let s = 0;
      for (const p of f.presets) {
        const ms = p.mode === "BINARY" ? MMS : [undefined];
        for (const m of ms) {
          if ((!opts.preset || p.id === opts.preset) && (!opts.mode || p.mode === opts.mode) && (!opts.goal || p.goal === opts.goal) && (!opts.mm || (m ?? "FIXED") === opts.mm)) slots.push(s);
          s++;
        }
      }
      const n = f.combos.length * slots.length;
      for (let k = Math.max(0, opts.offset - total); k < n && out.length < opts.limit; k++)
        out.push(make(f, Math.floor(k / slots.length), slots[k % slots.length]!));
      total += n;
    }
    return { rows: out, total };
  },
  /** Decodes any catalogue id (template~p1/p2~preset[~MM]). */
  byId(id: string): LibRule | null {
    const [t, sig, preset, mm] = id.split("~");
    const tpl = TEMPLATE_BY_ID[t ?? ""], p = PRESET_BY_ID[preset ?? ""];
    if (!tpl || !p) return null;
    const vals = sig === "def" ? tpl.params.map((d) => d.def) : (sig ?? "").split("/").map(Number);
    const params = Object.fromEntries(tpl.params.map((d, i) => [d.key, vals[i] ?? d.def]));
    const sigs = tpl.params.map((d) => params[d.key]).join("/");
    const tag = mm ? ` ${mm === "MARTINGALE" ? "· Martingale" : "· Anti-martingale"}` : "";
    return { id, name: `${short(tpl.id)}${sigs ? ` ${sigs}` : ""}${tag}`, template: tpl.id, params, preset: p.id, isDefault: tpl.params.every((d) => params[d.key] === d.def), mm: mm as MoneyMgmt | undefined };
  },
};

/** Ranked pool: the subset of the catalogue that the live scanner backtests on every asset.
 *  Defaults + 1,000 tuned grid variants + QUICK_EXTRA quick-profit rules sampled from the catalogue. */
export const QUICK_EXTRA = 600;
export const LIBRARY: LibRule[] = (() => {
  const base = build(), seen = new Set(base.map((r) => r.id));
  const { total } = CATALOG.page({ goal: "QUICK", offset: 0, limit: 0 });
  const extra: LibRule[] = [];
  for (let i = 0; extra.length < QUICK_EXTRA && i < QUICK_EXTRA * 4; i++) {
    const r = CATALOG.page({ goal: "QUICK", offset: (h(`q${i}`) % total), limit: 1 }).rows[0];
    if (r && !seen.has(r.id)) { seen.add(r.id); extra.push(r); }
  }
  return [...base, ...extra];
})();
const POOL_BY_ID: Record<string, LibRule> = Object.fromEntries(LIBRARY.map((r) => [r.id, r]));
export const LIB_BY_ID: Record<string, LibRule> = new Proxy(POOL_BY_ID, {
  get: (o, k: string) => o[k] ?? (typeof k === "string" ? (o[k] = CATALOG.byId(k) ?? undefined!) : undefined),
});
