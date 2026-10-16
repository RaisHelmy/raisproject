import { BURSA_SHARIAH, US_SCREENED } from "./universe.data";
// Deterministic simulated market. Price is a pure function of (instrument, time), so the browser
// can draw a live chart locally while the Worker computes the exact same price when filling orders
// or settling binary options — no feed, no state, no drift between client and server.

export type AssetClass = "stock" | "forex" | "crypto" | "commodity" | "index";

export interface Instrument {
  code: string; // moomoo-style code, e.g. US.AAPL, HK.00700
  name: string;
  cls: AssetClass;
  base: number;
  vol: number; // log-price amplitude
  decimals: number;
  payout: number; // binary payout ratio
  lot: number; // board lot for stock orders
  /** Extended universe: searchable/tradable, but not part of the live-ranked core markets. */
  ext?: boolean;
  board?: string;
}

export const INSTRUMENTS: Instrument[] = [
  { code: "US.AAPL", name: "Apple Inc.", cls: "stock", base: 228, vol: 0.035, decimals: 2, payout: 0.82, lot: 1 },
  { code: "US.TSLA", name: "Tesla Inc.", cls: "stock", base: 255, vol: 0.07, decimals: 2, payout: 0.85, lot: 1 },
  { code: "US.NVDA", name: "NVIDIA Corp.", cls: "stock", base: 132, vol: 0.06, decimals: 2, payout: 0.84, lot: 1 },
  { code: "US.MSFT", name: "Microsoft Corp.", cls: "stock", base: 418, vol: 0.03, decimals: 2, payout: 0.82, lot: 1 },
  { code: "US.AMZN", name: "Amazon.com Inc.", cls: "stock", base: 186, vol: 0.04, decimals: 2, payout: 0.82, lot: 1 },
  { code: "US.MOO", name: "Futu Holdings (moomoo)", cls: "stock", base: 98, vol: 0.06, decimals: 2, payout: 0.86, lot: 1 },
  { code: "FX.EURUSD", name: "EUR / USD", cls: "forex", base: 1.0925, vol: 0.006, decimals: 5, payout: 0.88, lot: 1000 },
  { code: "FX.GBPUSD", name: "GBP / USD", cls: "forex", base: 1.3061, vol: 0.007, decimals: 5, payout: 0.87, lot: 1000 },
  { code: "FX.USDJPY", name: "USD / JPY", cls: "forex", base: 149.2, vol: 0.008, decimals: 3, payout: 0.86, lot: 1000 },
  { code: "FX.USDMYR", name: "USD / MYR", cls: "forex", base: 4.31, vol: 0.006, decimals: 4, payout: 0.85, lot: 1000 },
  { code: "HK.00700", name: "Tencent Holdings", cls: "stock", base: 412, vol: 0.04, decimals: 2, payout: 0.83, lot: 100 },
  { code: "HK.09988", name: "Alibaba Group", cls: "stock", base: 88, vol: 0.05, decimals: 2, payout: 0.84, lot: 100 },
  { code: "MY.MAYBANK", name: "Malayan Banking", cls: "stock", base: 10.6, vol: 0.02, decimals: 3, payout: 0.8, lot: 100 },
  { code: "IDX.SPX", name: "S&P 500 Index", cls: "index", base: 5800, vol: 0.02, decimals: 2, payout: 0.8, lot: 1 },
  { code: "CC.BTCUSD", name: "Bitcoin", cls: "crypto", base: 63500, vol: 0.08, decimals: 2, payout: 0.9, lot: 0.001 },
  { code: "CC.ETHUSD", name: "Ethereum", cls: "crypto", base: 2450, vol: 0.09, decimals: 2, payout: 0.9, lot: 0.01 },
  { code: "CM.XAUUSD", name: "Gold", cls: "commodity", base: 2650, vol: 0.015, decimals: 2, payout: 0.86, lot: 1 },
  { code: "CM.WTI", name: "Crude Oil WTI", cls: "commodity", base: 74.5, vol: 0.035, decimals: 2, payout: 0.86, lot: 1 },
];

function hashUnit(s: string, salt: number) { let x = 2166136261 ^ salt; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return (x >>> 0) / 4294967296; }

/** 989 more real-world names (SC Shariah list + Musaffa-screened US stocks) with SIMULATED prices. */
export const EXTENDED: Instrument[] = [
  ...BURSA_SHARIAH.map(([c, name, board]) => {
    const h = hashUnit(c, 1), base = Math.exp(Math.log(0.08) + h * (Math.log(12) - Math.log(0.08)));
    return { code: `MY.${c}`, name, cls: "stock" as AssetClass, base: +base.toFixed(3), vol: 0.03 + hashUnit(c, 2) * 0.04, decimals: 3, payout: 0.8, lot: 100, ext: true, board };
  }),
  ...US_SCREENED.map(([t, name]) => {
    const h = hashUnit(t, 1), base = Math.exp(Math.log(15) + h * (Math.log(600) - Math.log(15)));
    return { code: `US.${t}`, name, cls: "stock" as AssetClass, base: +base.toFixed(2), vol: 0.03 + hashUnit(t, 2) * 0.04, decimals: 2, payout: 0.82, lot: 1, ext: true, board: "US" };
  }),
];
/** Core 18 (live-ranked) + extended universe. */
export const UNIVERSE: Instrument[] = [...INSTRUMENTS, ...EXTENDED];
export const BY_CODE: Record<string, Instrument> = Object.fromEntries(UNIVERSE.map((i) => [i.code, i]));

function seedOf(code: string): number {
  let s = 2166136261;
  for (let i = 0; i < code.length; i++) s = Math.imul(s ^ code.charCodeAt(i), 16777619);
  return s >>> 0;
}
const SEEDS: Record<string, number> = Object.fromEntries(UNIVERSE.map((i) => [i.code, seedOf(i.code)]));

function hash(n: number, seed: number): number {
  let x = (Math.floor(n) ^ Math.imul(seed, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function noise(t: number, period: number, seed: number): number {
  const p = t / period;
  const i = Math.floor(p);
  const f = p - i;
  const s = f * f * (3 - 2 * f);
  const a = hash(i, seed) - 0.5;
  const b = hash(i + 1, seed) - 0.5;
  return (a + (b - a) * s) * 2;
}

// [period seconds, amplitude]: tick jitter up to multi-day trend. Amplitude grows ~sqrt(period),
// like a random walk, so indicators (RSI, bands, crossovers) behave as on real charts.
const OCTAVES: [number, number][] = [
  [1, 0.004], [4, 0.008], [15, 0.014], [60, 0.03], [300, 0.07], [1800, 0.3], [7200, 0.5], [43200, 0.7], [259200, 1.2],
];

/** Price of `code` at unix time `ms` (milliseconds). */
export function priceAt(code: string, ms: number): number {
  const inst = BY_CODE[code];
  if (!inst) throw new Error(`unknown code ${code}`);
  const seed = SEEDS[code]!;
  const t = ms / 1000;
  let v = 0;
  for (let k = 0; k < OCTAVES.length; k++) {
    const [p, a] = OCTAVES[k]!;
    v += a * noise(t, p, seed + k * 7919);
  }
  return round(inst.base * Math.exp(inst.vol * v), inst.decimals);
}

export function round(v: number, d: number): number {
  const m = 10 ** d;
  return Math.round(v * m) / m;
}

export type Candle = [time: number, open: number, high: number, low: number, close: number, volume: number];

export const KTYPES: Record<string, number> = {
  K_5S: 5, K_1M: 60, K_5M: 300, K_15M: 900, K_60M: 3600, K_DAY: 86400,
};

/** OHLCV candle for the bar starting at `startMs` (partial up to `nowMs`). */
export function candleAt(code: string, startMs: number, intervalSec: number, nowMs = Date.now()): Candle {
  const end = Math.min(startMs + intervalSec * 1000, nowMs);
  const samples = Math.max(2, Math.min(intervalSec, 24));
  const open = priceAt(code, startMs);
  let high = open, low = open, close = open;
  for (let i = 1; i <= samples; i++) {
    const t = startMs + ((end - startMs) * i) / samples;
    close = priceAt(code, t);
    if (close > high) high = close;
    if (close < low) low = close;
  }
  const seed = SEEDS[code]!;
  const volume = Math.round((0.4 + hash(startMs / 1000, seed ^ 0xabcdef) + Math.abs(close - open) / open * 400) * intervalSec * 120);
  return [startMs, open, high, low, close, volume];
}

export function klines(code: string, ktype: string, num: number, nowMs = Date.now()): Candle[] {
  const sec = KTYPES[ktype] ?? 60;
  const ms = sec * 1000;
  const last = Math.floor(nowMs / ms) * ms;
  const out: Candle[] = [];
  for (let i = num - 1; i >= 0; i--) out.push(candleAt(code, last - i * ms, sec, nowMs));
  return out;
}

export interface Snapshot {
  code: string;
  name: string;
  last_price: number;
  prev_close_price: number;
  change_rate: number;
  update_time: number;
}

export function snapshot(code: string, nowMs = Date.now()): Snapshot {
  const inst = BY_CODE[code]!;
  const last = priceAt(code, nowMs);
  const prev = priceAt(code, nowMs - 86400_000);
  return {
    code, name: inst.name, last_price: last, prev_close_price: prev,
    change_rate: round(((last - prev) / prev) * 100, 2), update_time: nowMs,
  };
}

/** Simple monogram icon per instrument: [glyph, background colour]. */
export const ICONS: Record<string, [string, string]> = {
  "US.AAPL": ["A", "#6c757d"], "US.TSLA": ["T", "#cc0000"], "US.NVDA": ["N", "#76b900"], "US.MSFT": ["⊞", "#0078d4"],
  "US.AMZN": ["a", "#ff9900"], "US.MOO": ["m", "#ff6a00"], "HK.00700": ["騰", "#1aad19"], "HK.09988": ["阿", "#ff6a00"],
  "MY.MAYBANK": ["M", "#d4a017"], "IDX.SPX": ["500", "#3b5bdb"], "FX.EURUSD": ["€", "#2f6fdb"], "FX.GBPUSD": ["£", "#7b2cbf"],
  "FX.USDJPY": ["¥", "#c92a2a"], "FX.USDMYR": ["RM", "#0b7285"], "CC.BTCUSD": ["₿", "#f7931a"], "CC.ETHUSD": ["Ξ", "#627eea"],
  "CM.XAUUSD": ["Au", "#c9a227"], "CM.WTI": ["⛽", "#343a40"],
};
