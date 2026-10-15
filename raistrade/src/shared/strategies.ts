// Auto-trade rule templates. Each strategy precomputes its indicators over closed candles and
// returns a per-bar signal function. The Worker uses it live on the latest closed bar; the
// browser uses the same code for the backtest preview.

import { type Candle, KTYPES, priceAt, round } from "./market";
import * as I from "./indicators";
import { feeTotal } from "./fees";
import { spreadBps } from "./costs";

export type Signal = "BUY" | "SELL" | null;
export type RuleMode = "STOCK" | "BINARY";

export interface RuleState {
  posQty: number;
  entryPrice: number | null;
  refPrice: number | null;
}

export interface ParamDef { key: string; label: string; def: number; min?: number; max?: number; step?: number; hint?: string }

export interface Template {
  id: string;
  name: string;
  icon: string;
  category: "Trend" | "Momentum" | "Mean reversion" | "Breakout" | "Volatility" | "Pattern" | "Systematic";
  description: string;
  modes: RuleMode[];
  params: ParamDef[];
  prepare: (c: Candle[], p: Record<string, number>) => (i: number, s: RuleState) => Signal;
}

const closes = (c: Candle[]) => c.map((x) => x[4]);
const highs = (c: Candle[]) => c.map((x) => x[2]);
const lows = (c: Candle[]) => c.map((x) => x[3]);
const BOTH: RuleMode[] = ["STOCK", "BINARY"];

const maCross = (kind: "sma" | "ema") => (c: Candle[], p: Record<string, number>) => {
  const v = closes(c);
  const f = I[kind](v, p.fast!), s = I[kind](v, p.slow!);
  return (i: number) => (I.crossUp(f, s, i) ? "BUY" : I.crossDown(f, s, i) ? "SELL" : null);
};

export const TEMPLATES: Template[] = [
  {
    id: "sma_cross", name: "SMA Crossover", icon: "✕", category: "Trend", modes: BOTH,
    description: "Buy when the fast simple moving average crosses above the slow one; sell on the cross below.",
    params: [{ key: "fast", label: "Fast SMA", def: 9, min: 2, max: 100 }, { key: "slow", label: "Slow SMA", def: 21, min: 3, max: 250 }],
    prepare: maCross("sma"),
  },
  {
    id: "ema_cross", name: "EMA Crossover", icon: "⤧", category: "Trend", modes: BOTH,
    description: "Faster-reacting exponential moving average crossover (12/26 by default).",
    params: [{ key: "fast", label: "Fast EMA", def: 12, min: 2, max: 100 }, { key: "slow", label: "Slow EMA", def: 26, min: 3, max: 250 }],
    prepare: maCross("ema"),
  },
  {
    id: "golden_cross", name: "Golden / Death Cross", icon: "★", category: "Trend", modes: ["STOCK"],
    description: "Long-term trend filter: 50 SMA crossing the 200 SMA. Few signals, best on larger timeframes.",
    params: [{ key: "fast", label: "Fast SMA", def: 50, min: 10, max: 100 }, { key: "slow", label: "Slow SMA", def: 200, min: 50, max: 250 }],
    prepare: maCross("sma"),
  },
  {
    id: "macd_cross", name: "MACD Signal Cross", icon: "≋", category: "Momentum", modes: BOTH,
    description: "Buy when the MACD line crosses above its signal line, sell when it crosses below.",
    params: [{ key: "fast", label: "Fast", def: 12 }, { key: "slow", label: "Slow", def: 26 }, { key: "signal", label: "Signal", def: 9 }],
    prepare: (c, p) => {
      const m = I.macd(closes(c), p.fast!, p.slow!, p.signal!);
      return (i) => (I.crossUp(m.line, m.signal, i) ? "BUY" : I.crossDown(m.line, m.signal, i) ? "SELL" : null);
    },
  },
  {
    id: "rsi_reversal", name: "RSI Overbought / Oversold", icon: "⇅", category: "Mean reversion", modes: BOTH,
    description: "Buy when RSI climbs back above the oversold level; sell when it drops back below overbought.",
    params: [{ key: "period", label: "RSI period", def: 14, min: 2, max: 50 }, { key: "oversold", label: "Oversold", def: 30, min: 5, max: 50 }, { key: "overbought", label: "Overbought", def: 70, min: 50, max: 95 }],
    prepare: (c, p) => {
      const r = I.rsi(closes(c), p.period!);
      return (i) => (I.crossUp(r, p.oversold!, i) ? "BUY" : I.crossDown(r, p.overbought!, i) ? "SELL" : null);
    },
  },
  {
    id: "stoch_cross", name: "Stochastic Oscillator", icon: "∿", category: "Momentum", modes: BOTH,
    description: "%K crossing %D inside the oversold zone is a buy; inside the overbought zone a sell.",
    params: [{ key: "k", label: "%K period", def: 14 }, { key: "d", label: "%D smoothing", def: 3 }, { key: "oversold", label: "Oversold", def: 20 }, { key: "overbought", label: "Overbought", def: 80 }],
    prepare: (c, p) => {
      const s = I.stochastic(highs(c), lows(c), closes(c), p.k!, p.d!);
      return (i) =>
        I.crossUp(s.k, s.d, i) && s.k[i]! < p.oversold! + 10 ? "BUY" : I.crossDown(s.k, s.d, i) && s.k[i]! > p.overbought! - 10 ? "SELL" : null;
    },
  },
  {
    id: "bb_reversion", name: "Bollinger Mean Reversion", icon: "◎", category: "Mean reversion", modes: BOTH,
    description: "Fade the extremes: buy when price re-enters above the lower band, sell when it re-enters below the upper band.",
    params: [{ key: "period", label: "Period", def: 20 }, { key: "mult", label: "Std-dev ×", def: 2, step: 0.1 }],
    prepare: (c, p) => {
      const v = closes(c), b = I.bollinger(v, p.period!, p.mult!);
      return (i) => (I.crossUp(v, b.lower, i) ? "BUY" : I.crossDown(v, b.upper, i) ? "SELL" : null);
    },
  },
  {
    id: "bb_breakout", name: "Bollinger Breakout", icon: "⇪", category: "Volatility", modes: BOTH,
    description: "Ride volatility expansion: buy a close above the upper band, sell a close below the lower band.",
    params: [{ key: "period", label: "Period", def: 20 }, { key: "mult", label: "Std-dev ×", def: 2, step: 0.1 }],
    prepare: (c, p) => {
      const v = closes(c), b = I.bollinger(v, p.period!, p.mult!);
      return (i) => (I.crossUp(v, b.upper, i) ? "BUY" : I.crossDown(v, b.lower, i) ? "SELL" : null);
    },
  },
  {
    id: "donchian", name: "Donchian Breakout (Turtle)", icon: "▭", category: "Breakout", modes: BOTH,
    description: "The Turtle rule: buy a new N-bar high, sell a new N-bar low.",
    params: [{ key: "period", label: "Channel bars", def: 20, min: 5, max: 100 }],
    prepare: (c, p) => {
      const v = closes(c), hh = I.highest(highs(c), p.period!), ll = I.lowest(lows(c), p.period!);
      return (i) => (v[i]! > hh[i - 1]! ? "BUY" : v[i]! < ll[i - 1]! ? "SELL" : null);
    },
  },
  {
    id: "supertrend", name: "Supertrend", icon: "⟰", category: "Trend", modes: BOTH,
    description: "ATR-based trailing trend line. Trades each time the trend direction flips.",
    params: [{ key: "period", label: "ATR period", def: 10 }, { key: "mult", label: "ATR ×", def: 3, step: 0.1 }],
    prepare: (c, p) => {
      const d = I.supertrend(highs(c), lows(c), closes(c), p.period!, p.mult!);
      return (i) => (d[i - 1] === -1 && d[i] === 1 ? "BUY" : d[i - 1] === 1 && d[i] === -1 ? "SELL" : null);
    },
  },
  {
    id: "roc_momentum", name: "Momentum (ROC)", icon: "➚", category: "Momentum", modes: BOTH,
    description: "Rate of change over N bars crossing a ± threshold (%).",
    params: [{ key: "period", label: "Lookback bars", def: 10 }, { key: "threshold", label: "Threshold %", def: 0.3, step: 0.05 }],
    prepare: (c, p) => {
      const v = closes(c);
      const roc = v.map((x, i) => (i < p.period! ? NaN : ((x - v[i - p.period!]!) / v[i - p.period!]!) * 100));
      return (i) => (I.crossUp(roc, p.threshold!, i) ? "BUY" : I.crossDown(roc, -p.threshold!, i) ? "SELL" : null);
    },
  },
  {
    id: "zscore", name: "Z-Score Reversion", icon: "σ", category: "Mean reversion", modes: BOTH,
    description: "Statistical arbitrage style: buy when price is N std-devs below its mean, sell when above.",
    params: [{ key: "period", label: "Lookback", def: 20 }, { key: "entry", label: "Entry z", def: 2, step: 0.1 }],
    prepare: (c, p) => {
      const v = closes(c), m = I.sma(v, p.period!), sd = I.stdev(v, p.period!);
      const z = v.map((x, i) => (sd[i]! ? (x - m[i]!) / sd[i]! : 0));
      return (i) => (I.crossDown(z, -p.entry!, i) ? "BUY" : I.crossUp(z, p.entry!, i) ? "SELL" : null);
    },
  },
  {
    id: "ema_rsi", name: "Trend + RSI Pullback", icon: "↯", category: "Trend", modes: BOTH,
    description: "Only buy dips in an uptrend: price above the 50 EMA and RSI crossing up through 40 (mirror for sells).",
    params: [{ key: "trend", label: "Trend EMA", def: 50 }, { key: "period", label: "RSI period", def: 14 }, { key: "pull", label: "Pullback RSI", def: 40 }],
    prepare: (c, p) => {
      const v = closes(c), e = I.ema(v, p.trend!), r = I.rsi(v, p.period!);
      return (i) =>
        v[i]! > e[i]! && I.crossUp(r, p.pull!, i) ? "BUY" : v[i]! < e[i]! && I.crossDown(r, 100 - p.pull!, i) ? "SELL" : null;
    },
  },
  {
    id: "williams_r", name: "Williams %R Reversal", icon: "ʬ", category: "Mean reversion", modes: BOTH,
    description: "Buy when %R climbs out of the oversold zone (below -80), sell when it drops out of overbought (above -20).",
    params: [{ key: "period", label: "Lookback", def: 14, min: 3, max: 60 }, { key: "zone", label: "Zone depth", def: 20, min: 5, max: 40 }],
    prepare: (c, p) => {
      const v = closes(c), hh = I.highest(highs(c), p.period!), ll = I.lowest(lows(c), p.period!);
      const w = v.map((x, i) => (hh[i]! === ll[i]! ? -50 : ((hh[i]! - x) / (hh[i]! - ll[i]!)) * -100));
      return (i) => (I.crossUp(w, -100 + p.zone!, i) ? "BUY" : I.crossDown(w, -p.zone!, i) ? "SELL" : null);
    },
  },
  {
    id: "cci_reversion", name: "CCI Reversion", icon: "ℂ", category: "Mean reversion", modes: BOTH,
    description: "Commodity Channel Index returning from an extreme: up through -level is a buy, down through +level a sell.",
    params: [{ key: "period", label: "CCI period", def: 20, min: 5, max: 60 }, { key: "level", label: "Extreme level", def: 100, min: 50, max: 250, step: 10 }],
    prepare: (c, p) => {
      const tp = c.map((x) => (x[2] + x[3] + x[4]) / 3), m = I.sma(tp, p.period!);
      const cci = tp.map((x, i) => {
        if (i < p.period! - 1) return NaN;
        let md = 0;
        for (let j = i - p.period! + 1; j <= i; j++) md += Math.abs(tp[j]! - m[i]!);
        md /= p.period!;
        return md ? (x - m[i]!) / (0.015 * md) : 0;
      });
      return (i) => (I.crossUp(cci, -p.level!, i) ? "BUY" : I.crossDown(cci, p.level!, i) ? "SELL" : null);
    },
  },
  {
    id: "keltner", name: "Keltner Channel Breakout", icon: "⫼", category: "Volatility", modes: BOTH,
    description: "EMA ± ATR envelope. A close above the upper line is a buy, below the lower line a sell.",
    params: [{ key: "period", label: "EMA period", def: 20, min: 5, max: 100 }, { key: "mult", label: "ATR ×", def: 1.5, step: 0.1, min: 0.5, max: 4 }],
    prepare: (c, p) => {
      const v = closes(c), e = I.ema(v, p.period!), a = I.atr(highs(c), lows(c), v, p.period!);
      const up = e.map((x, i) => x + p.mult! * a[i]!), dn = e.map((x, i) => x - p.mult! * a[i]!);
      return (i) => (I.crossUp(v, up, i) ? "BUY" : I.crossDown(v, dn, i) ? "SELL" : null);
    },
  },
  {
    id: "triple_ema", name: "Triple EMA Alignment", icon: "≡", category: "Trend", modes: BOTH,
    description: "Buy the moment fast > mid > slow EMAs line up; sell when they line up the other way.",
    params: [{ key: "fast", label: "Fast", def: 5, min: 2, max: 50 }, { key: "mid", label: "Mid", def: 13, min: 3, max: 100 }, { key: "slow", label: "Slow", def: 34, min: 5, max: 250 }],
    prepare: (c, p) => {
      const v = closes(c), f = I.ema(v, p.fast!), m = I.ema(v, p.mid!), s = I.ema(v, p.slow!);
      const st = v.map((_, i) => (f[i]! > m[i]! && m[i]! > s[i]! ? 1 : f[i]! < m[i]! && m[i]! < s[i]! ? -1 : 0));
      return (i) => (st[i] === 1 && st[i - 1] !== 1 ? "BUY" : st[i] === -1 && st[i - 1] !== -1 ? "SELL" : null);
    },
  },
  {
    id: "rsi2", name: "Connors RSI-2", icon: "②", category: "Mean reversion", modes: BOTH,
    description: "Short-term pullback in a long-term uptrend: price above the trend SMA and 2-period RSI deeply oversold (mirror for sells).",
    params: [{ key: "trend", label: "Trend SMA", def: 100, min: 20, max: 250 }, { key: "low", label: "Oversold RSI-2", def: 10, min: 1, max: 30 }],
    prepare: (c, p) => {
      const v = closes(c), t = I.sma(v, p.trend!), r = I.rsi(v, 2);
      return (i) => (v[i]! > t[i]! && I.crossDown(r, p.low!, i) ? "BUY" : v[i]! < t[i]! && I.crossUp(r, 100 - p.low!, i) ? "SELL" : null);
    },
  },
  {
    id: "price_level", name: "Price Alert Trigger", icon: "⌖", category: "Systematic", modes: BOTH,
    description: "Buy when price drops to your level, sell when it reaches your target. Set levels to 0 to use ±1% of the current price.",
    params: [{ key: "buy_below", label: "Buy at or below", def: 0, step: 0.01 }, { key: "sell_above", label: "Sell at or above", def: 0, step: 0.01 }],
    prepare: (c, p) => {
      const v = closes(c);
      return (i) => (p.buy_below! > 0 && v[i]! <= p.buy_below! ? "BUY" : p.sell_above! > 0 && v[i]! >= p.sell_above! ? "SELL" : null);
    },
  },
  {
    id: "dca", name: "Dollar-Cost Averaging", icon: "⋯", category: "Systematic", modes: ["STOCK"],
    description: "Buy a fixed quantity every N bars regardless of price; the whole position exits at the take-profit.",
    params: [{ key: "every", label: "Buy every N bars", def: 5, min: 1, max: 500 }],
    prepare: (c, p) => (i) => (Math.floor(c[i]![0] / ((c[1]?.[0] ?? 1) - (c[0]?.[0] ?? 0) || 1)) % p.every! === 0 ? "BUY" : null),
  },
  {
    id: "grid", name: "Grid Trading", icon: "▦", category: "Systematic", modes: ["STOCK"],
    description: "Buy each time price falls one grid step below the last exit, sell one step above the entry.",
    params: [{ key: "step", label: "Grid step %", def: 0.4, step: 0.05, min: 0.05 }],
    prepare: (c, p) => (i, s) => {
      const px = c[i]![4];
      if (s.posQty > 0 && s.entryPrice) return px >= s.entryPrice * (1 + p.step! / 100) ? "SELL" : null;
      const ref = s.refPrice ?? c[Math.max(0, i - 1)]![4];
      return px <= ref * (1 - p.step! / 100) ? "BUY" : null;
    },
  },
];

// ---------------- Extended library: more indicators, patterns and filtered variants ----------------

const vols = (c: Candle[]) => c.map((x) => x[5]);
const sig = (buy: boolean, sell: boolean): Signal => (buy ? "BUY" : sell ? "SELL" : null);
type MaFn = (v: number[], p: number) => number[];
const maCrossOf = (fn: MaFn) => (c: Candle[], p: Record<string, number>) => {
  const v = closes(c), f = fn(v, p.fast!), s = fn(v, p.slow!);
  return (i: number) => sig(I.crossUp(f, s, i), I.crossDown(f, s, i));
};
const priceMa = (fn: MaFn) => (c: Candle[], p: Record<string, number>) => {
  const v = closes(c), m = fn(v, p.period!);
  return (i: number) => sig(I.crossUp(v, m, i), I.crossDown(v, m, i));
};
const FAST_SLOW = (f: number, s: number): ParamDef[] => [{ key: "fast", label: "Fast", def: f, min: 2, max: 100 }, { key: "slow", label: "Slow", def: s, min: 3, max: 250 }];
const PERIOD = (d: number, label = "Period", min = 2, max = 200): ParamDef => ({ key: "period", label, def: d, min, max });

const EXTRA: Template[] = [
  { id: "wma_cross", name: "WMA Crossover", icon: "⩘", category: "Trend", modes: BOTH, description: "Weighted moving average crossover — recent bars count more.", params: FAST_SLOW(10, 30), prepare: maCrossOf(I.wma) },
  { id: "dema_cross", name: "DEMA Crossover", icon: "⩚", category: "Trend", modes: BOTH, description: "Double-EMA crossover: less lag than a plain EMA cross.", params: FAST_SLOW(10, 30), prepare: maCrossOf(I.dema) },
  { id: "tema_cross", name: "TEMA Crossover", icon: "⩛", category: "Trend", modes: BOTH, description: "Triple-EMA crossover: the fastest-reacting smooth average.", params: FAST_SLOW(10, 30), prepare: maCrossOf(I.tema) },
  { id: "hma_cross", name: "Hull MA Crossover", icon: "ℍ", category: "Trend", modes: BOTH, description: "Hull moving average crossover — smooth and very low lag.", params: FAST_SLOW(9, 25), prepare: maCrossOf(I.hma) },
  { id: "price_sma", name: "Price × SMA", icon: "⟋", category: "Trend", modes: BOTH, description: "Buy when price closes above its SMA, sell when it closes below.", params: [PERIOD(20)], prepare: priceMa(I.sma) },
  { id: "price_ema", name: "Price × EMA", icon: "⟍", category: "Trend", modes: BOTH, description: "Buy when price closes above its EMA, sell when it closes below.", params: [PERIOD(20)], prepare: priceMa(I.ema) },
  { id: "hma_slope", name: "Hull MA Turn", icon: "↺", category: "Trend", modes: BOTH, description: "Trade each time the Hull moving average changes direction.", params: [PERIOD(20)],
    prepare: (c, p) => { const h = I.hma(closes(c), p.period!); return (i) => sig(h[i]! > h[i - 1]! && h[i - 1]! <= h[i - 2]!, h[i]! < h[i - 1]! && h[i - 1]! >= h[i - 2]!); } },
  { id: "linreg_slope", name: "Regression Slope Flip", icon: "∠", category: "Trend", modes: BOTH, description: "Least-squares trend line over N bars turning from down to up (buy) or up to down (sell).", params: [PERIOD(20, "Bars", 5, 200)],
    prepare: (c, p) => { const s = I.linregSlope(closes(c), p.period!); return (i) => sig(I.crossUp(s, 0, i), I.crossDown(s, 0, i)); } },
  { id: "aroon", name: "Aroon Cross", icon: "⇈", category: "Trend", modes: BOTH, description: "Aroon Up crossing above Aroon Down means a fresh trend up (and vice versa).", params: [PERIOD(25, "Lookback", 5, 100)],
    prepare: (c, p) => {
      const n = p.period!, h = highs(c), l = lows(c);
      const up = h.map((_, i) => { if (i < n) return NaN; let k = 0; for (let j = 1; j <= n; j++) if (h[i - j]! > h[i - k]!) k = j; return ((n - k) / n) * 100; });
      const dn = l.map((_, i) => { if (i < n) return NaN; let k = 0; for (let j = 1; j <= n; j++) if (l[i - j]! < l[i - k]!) k = j; return ((n - k) / n) * 100; });
      return (i) => sig(I.crossUp(up, dn, i), I.crossDown(up, dn, i));
    } },
  { id: "adx_di", name: "ADX / DMI Trend", icon: "Ⓐ", category: "Trend", modes: BOTH, description: "+DI crossing -DI while ADX shows a real trend (above the threshold).", params: [PERIOD(14, "DI period", 3, 60), { key: "adx", label: "Min ADX", def: 20, min: 5, max: 50 }],
    prepare: (c, p) => { const d = I.dmi(highs(c), lows(c), closes(c), p.period!); return (i) => sig(d.adx[i]! > p.adx! && I.crossUp(d.plus, d.minus, i), d.adx[i]! > p.adx! && I.crossDown(d.plus, d.minus, i)); } },
  { id: "psar", name: "Parabolic SAR", icon: "⁘", category: "Trend", modes: BOTH, description: "Wilder's stop-and-reverse: trade every time the SAR dots flip sides.", params: [{ key: "step", label: "AF step", def: 0.02, step: 0.01, min: 0.005, max: 0.2 }, { key: "max", label: "AF max", def: 0.2, step: 0.05, min: 0.05, max: 0.5 }],
    prepare: (c, p) => { const d = I.psar(highs(c), lows(c), p.step!, p.max!); return (i) => sig(d[i - 1] === -1 && d[i] === 1, d[i - 1] === 1 && d[i] === -1); } },
  { id: "ichimoku_tk", name: "Ichimoku TK Cross", icon: "雲", category: "Trend", modes: BOTH, description: "Tenkan-sen crossing Kijun-sen (conversion vs base line).", params: [{ key: "tenkan", label: "Tenkan", def: 9, min: 3, max: 50 }, { key: "kijun", label: "Kijun", def: 26, min: 5, max: 120 }],
    prepare: (c, p) => {
      const mid = (n: number) => { const hh = I.highest(highs(c), n), ll = I.lowest(lows(c), n); return hh.map((x, i) => (x + ll[i]!) / 2); };
      const t = mid(p.tenkan!), k = mid(p.kijun!);
      return (i) => sig(I.crossUp(t, k, i), I.crossDown(t, k, i));
    } },
  { id: "vortex", name: "Vortex Indicator", icon: "🌀", category: "Trend", modes: BOTH, description: "VI+ crossing VI- marks the start of a new trend.", params: [PERIOD(14, "Period", 3, 60)],
    prepare: (c, p) => {
      const n = p.period!, h = highs(c), l = lows(c), v = closes(c);
      const vp = c.map((_, i) => (i ? Math.abs(h[i]! - l[i - 1]!) : 0)), vm = c.map((_, i) => (i ? Math.abs(l[i]! - h[i - 1]!) : 0));
      const tr = c.map((_, i) => (i ? Math.max(h[i]! - l[i]!, Math.abs(h[i]! - v[i - 1]!), Math.abs(l[i]! - v[i - 1]!)) : h[0]! - l[0]!));
      const sp = I.sma(vp, n), sm = I.sma(vm, n), st = I.sma(tr, n);
      const a = sp.map((x, i) => x / st[i]!), b = sm.map((x, i) => x / st[i]!);
      return (i) => sig(I.crossUp(a, b, i), I.crossDown(a, b, i));
    } },
  { id: "heikin_ashi", name: "Heikin-Ashi Flip", icon: "▥", category: "Trend", modes: BOTH, description: "Smoothed Heikin-Ashi candles changing colour after N same-colour bars.", params: [{ key: "confirm", label: "Bars of colour", def: 2, min: 1, max: 6 }],
    prepare: (c, p) => {
      const hc = c.map((x) => (x[1] + x[2] + x[3] + x[4]) / 4), ho: number[] = [];
      c.forEach((x, i) => ho.push(i ? (ho[i - 1]! + hc[i - 1]!) / 2 : (x[1] + x[4]) / 2));
      const g = hc.map((x, i) => (x > ho[i]! ? 1 : -1));
      const run = (i: number, d: number) => { for (let j = 0; j < p.confirm!; j++) if (g[i - j] !== d) return false; return g[i - p.confirm!] === -d; };
      return (i) => sig(run(i, 1), run(i, -1));
    } },
  { id: "trix", name: "TRIX Zero Cross", icon: "Ⓣ", category: "Momentum", modes: BOTH, description: "Rate of change of a triple-smoothed EMA crossing zero.", params: [PERIOD(15, "Period", 3, 60)],
    prepare: (c, p) => {
      const e3 = I.emaNaN(I.emaNaN(I.ema(closes(c), p.period!), p.period!), p.period!);
      const t = e3.map((x, i) => (i ? ((x - e3[i - 1]!) / e3[i - 1]!) * 10000 : NaN));
      return (i) => sig(I.crossUp(t, 0, i), I.crossDown(t, 0, i));
    } },
  { id: "awesome", name: "Awesome Oscillator", icon: "◐", category: "Momentum", modes: BOTH, description: "Bill Williams' 5/34 median-price momentum crossing zero.", params: FAST_SLOW(5, 34),
    prepare: (c, p) => { const m = c.map((x) => (x[2] + x[3]) / 2), f = I.sma(m, p.fast!), s = I.sma(m, p.slow!), ao = f.map((x, i) => x - s[i]!); return (i) => sig(I.crossUp(ao, 0, i), I.crossDown(ao, 0, i)); } },
  { id: "ppo_hist", name: "PPO Histogram Flip", icon: "▚", category: "Momentum", modes: BOTH, description: "Percentage Price Oscillator histogram changing sign — MACD normalised to %.", params: [...FAST_SLOW(12, 26), { key: "signal", label: "Signal", def: 9, min: 2, max: 50 }],
    prepare: (c, p) => {
      const v = closes(c), f = I.ema(v, p.fast!), s = I.ema(v, p.slow!), ppo = f.map((x, i) => ((x - s[i]!) / s[i]!) * 100), sg = I.emaNaN(ppo, p.signal!);
      const h = ppo.map((x, i) => x - sg[i]!);
      return (i) => sig(I.crossUp(h, 0, i), I.crossDown(h, 0, i));
    } },
  { id: "cmo", name: "Chande Momentum", icon: "Ⓒ", category: "Momentum", modes: BOTH, description: "Chande Momentum Oscillator leaving the ±level extreme zone.", params: [PERIOD(14, "Period", 3, 60), { key: "level", label: "Level", def: 50, min: 10, max: 90 }],
    prepare: (c, p) => {
      const v = closes(c), n = p.period!;
      const m = v.map((_, i) => { if (i < n) return NaN; let u = 0, d = 0; for (let j = i - n + 1; j <= i; j++) { const x = v[j]! - v[j - 1]!; x > 0 ? (u += x) : (d -= x); } return u + d ? ((u - d) / (u + d)) * 100 : 0; });
      return (i) => sig(I.crossUp(m, -p.level!, i), I.crossDown(m, p.level!, i));
    } },
  { id: "ultimate", name: "Ultimate Oscillator", icon: "Ⓤ", category: "Momentum", modes: BOTH, description: "Larry Williams' 7/14/28 blended buying-pressure oscillator leaving 30/70.", params: [{ key: "low", label: "Oversold", def: 30, min: 10, max: 45 }],
    prepare: (c, p) => {
      const v = closes(c), h = highs(c), l = lows(c);
      const bp = v.map((x, i) => (i ? x - Math.min(l[i]!, v[i - 1]!) : 0)), tr = v.map((_, i) => (i ? Math.max(h[i]!, v[i - 1]!) - Math.min(l[i]!, v[i - 1]!) : 1));
      const avg = (n: number) => { const a = I.sma(bp, n), b = I.sma(tr, n); return a.map((x, i) => x / b[i]!); };
      const a7 = avg(7), a14 = avg(14), a28 = avg(28), uo = a7.map((x, i) => (100 * (4 * x + 2 * a14[i]! + a28[i]!)) / 7);
      return (i) => sig(I.crossUp(uo, p.low!, i), I.crossDown(uo, 100 - p.low!, i));
    } },
  { id: "elder_ray", name: "Elder Ray", icon: "⚡", category: "Momentum", modes: BOTH, description: "In an EMA uptrend, buy when bear power turns up from below zero (mirror for sells).", params: [PERIOD(13, "EMA", 3, 60)],
    prepare: (c, p) => {
      const e = I.ema(closes(c), p.period!), bull = highs(c).map((x, i) => x - e[i]!), bear = lows(c).map((x, i) => x - e[i]!);
      return (i) => sig(e[i]! > e[i - 1]! && bear[i]! < 0 && bear[i]! > bear[i - 1]!, e[i]! < e[i - 1]! && bull[i]! > 0 && bull[i]! < bull[i - 1]!);
    } },
  { id: "obv_trend", name: "OBV Trend", icon: "▤", category: "Momentum", modes: BOTH, description: "On-Balance Volume crossing its own EMA — volume leads price.", params: [PERIOD(20, "OBV EMA", 3, 100)],
    prepare: (c, p) => {
      const v = closes(c), vo = vols(c), obv: number[] = [];
      v.forEach((x, i) => obv.push(i ? obv[i - 1]! + (x > v[i - 1]! ? vo[i]! : x < v[i - 1]! ? -vo[i]! : 0) : 0));
      const e = I.ema(obv, p.period!);
      return (i) => sig(I.crossUp(obv, e, i), I.crossDown(obv, e, i));
    } },
  { id: "mfi", name: "Money Flow Index", icon: "💧", category: "Mean reversion", modes: BOTH, description: "Volume-weighted RSI: buy leaving oversold, sell leaving overbought.", params: [PERIOD(14, "Period", 3, 60), { key: "low", label: "Oversold", def: 20, min: 5, max: 45 }],
    prepare: (c, p) => {
      const tp = c.map((x) => (x[2] + x[3] + x[4]) / 3), vo = vols(c), n = p.period!;
      const m = tp.map((_, i) => { if (i < n) return NaN; let u = 0, d = 0; for (let j = i - n + 1; j <= i; j++) { const f = tp[j]! * vo[j]!; tp[j]! > tp[j - 1]! ? (u += f) : (d += f); } return d ? 100 - 100 / (1 + u / d) : 100; });
      return (i) => sig(I.crossUp(m, p.low!, i), I.crossDown(m, 100 - p.low!, i));
    } },
  { id: "vwap_revert", name: "VWAP Reversion", icon: "Ⓥ", category: "Mean reversion", modes: BOTH, description: "Rolling volume-weighted average price: buy a stretch below it, sell a stretch above.", params: [PERIOD(30, "Bars", 5, 200), { key: "dev", label: "Stretch %", def: 0.5, step: 0.05, min: 0.05, max: 5 }],
    prepare: (c, p) => {
      const tp = c.map((x) => (x[2] + x[3] + x[4]) / 3), vo = vols(c), pv = tp.map((x, i) => x * vo[i]!);
      const a = I.sma(pv, p.period!), b = I.sma(vo, p.period!), d = closes(c).map((x, i) => ((x - a[i]! / b[i]!) / (a[i]! / b[i]!)) * 100);
      return (i) => sig(I.crossUp(d, -p.dev!, i), I.crossDown(d, p.dev!, i));
    } },
  { id: "envelope", name: "MA Envelope", icon: "⊂", category: "Mean reversion", modes: BOTH, description: "Buy back inside a fixed-% band below the SMA, sell back inside the band above.", params: [PERIOD(20), { key: "pct", label: "Band %", def: 1, step: 0.1, min: 0.1, max: 10 }],
    prepare: (c, p) => {
      const v = closes(c), m = I.sma(v, p.period!), up = m.map((x) => x * (1 + p.pct! / 100)), dn = m.map((x) => x * (1 - p.pct! / 100));
      return (i) => sig(I.crossUp(v, dn, i), I.crossDown(v, up, i));
    } },
  { id: "pct_rank", name: "Percentile Rank", icon: "％", category: "Mean reversion", modes: BOTH, description: "Close ranks in the bottom X% of the last N bars → buy; top X% → sell.", params: [PERIOD(50, "Bars", 10, 200), { key: "edge", label: "Edge %", def: 10, min: 1, max: 40 }],
    prepare: (c, p) => {
      const v = closes(c), n = p.period!;
      const r = v.map((x, i) => { if (i < n) return NaN; let k = 0; for (let j = i - n; j < i; j++) if (v[j]! < x) k++; return (k / n) * 100; });
      return (i) => sig(I.crossUp(r, p.edge!, i), I.crossDown(r, 100 - p.edge!, i));
    } },
  { id: "dpo", name: "Detrended Price Osc.", icon: "Ⓓ", category: "Mean reversion", modes: BOTH, description: "Price minus a displaced SMA isolates short cycles; trade the cycle lows and highs.", params: [PERIOD(20, "Period", 5, 100)],
    prepare: (c, p) => {
      const v = closes(c), m = I.sma(v, p.period!), sh = Math.floor(p.period! / 2) + 1;
      const d = v.map((x, i) => (i >= sh ? x - m[i - sh]! : NaN)), sd = I.stdev(d.map((x) => (Number.isNaN(x) ? 0 : x)), p.period!);
      return (i) => sig(I.crossUp(d, -sd[i]!, i), I.crossDown(d, sd[i]!, i));
    } },
  { id: "squeeze", name: "Volatility Squeeze", icon: "⧖", category: "Volatility", modes: BOTH, description: "Bollinger Bands inside Keltner Channels = squeeze. Trade the release in the momentum direction.", params: [PERIOD(20, "Period", 5, 100)],
    prepare: (c, p) => {
      const v = closes(c), n = p.period!, b = I.bollinger(v, n, 2), e = I.ema(v, n), a = I.atr(highs(c), lows(c), v, n);
      const sq = v.map((_, i) => b.upper[i]! < e[i]! + 1.5 * a[i]! && b.lower[i]! > e[i]! - 1.5 * a[i]!);
      return (i) => { const rel = !!sq[i - 1] && !sq[i]; return sig(rel && v[i]! > b.mid[i]!, rel && v[i]! < b.mid[i]!); };
    } },
  { id: "atr_breakout", name: "ATR Breakout", icon: "⇯", category: "Volatility", modes: BOTH, description: "Bar closes more than k × ATR away from the previous close — a volatility burst.", params: [PERIOD(14, "ATR period", 3, 60), { key: "k", label: "ATR ×", def: 1.2, step: 0.1, min: 0.3, max: 5 }],
    prepare: (c, p) => { const v = closes(c), a = I.atr(highs(c), lows(c), v, p.period!); return (i) => sig(v[i]! - v[i - 1]! > p.k! * a[i - 1]!, v[i - 1]! - v[i]! > p.k! * a[i - 1]!); } },
  { id: "chandelier", name: "Chandelier Flip", icon: "🕯", category: "Volatility", modes: BOTH, description: "Chandelier exit line (highest high − k×ATR) crossed by price flips the position.", params: [PERIOD(22, "Lookback", 5, 100), { key: "k", label: "ATR ×", def: 3, step: 0.1, min: 0.5, max: 6 }],
    prepare: (c, p) => {
      const v = closes(c), a = I.atr(highs(c), lows(c), v, p.period!), hh = I.highest(highs(c), p.period!), ll = I.lowest(lows(c), p.period!);
      const longStop = hh.map((x, i) => x - p.k! * a[i]!), shortStop = ll.map((x, i) => x + p.k! * a[i]!);
      return (i) => sig(I.crossUp(v, shortStop, i), I.crossDown(v, longStop, i));
    } },
  { id: "nr7", name: "NR7 Breakout", icon: "⇲", category: "Breakout", modes: BOTH, description: "After the narrowest range of the last N bars, trade the break of that bar's high or low.", params: [PERIOD(7, "Bars", 3, 30)],
    prepare: (c, p) => {
      const rg = c.map((x) => x[2] - x[3]), n = p.period!, v = closes(c);
      const nr = rg.map((x, i) => { if (i < n) return false; for (let j = i - n + 1; j < i; j++) if (rg[j]! <= x) return false; return true; });
      return (i) => sig(nr[i - 1]! && v[i]! > c[i - 1]![2], nr[i - 1]! && v[i]! < c[i - 1]![3]);
    } },
  { id: "inside_bar", name: "Inside-Bar Breakout", icon: "⧈", category: "Breakout", modes: BOTH, description: "A bar inside the previous bar's range, then a close beyond the mother bar.", params: [],
    prepare: (c) => (i) => {
      const m = c[i - 2], ib = c[i - 1], x = c[i]!;
      if (!m || !ib) return null;
      const inside = ib[2] <= m[2] && ib[3] >= m[3];
      return sig(inside && x[4] > m[2], inside && x[4] < m[3]);
    } },
  { id: "range_break", name: "Opening-Range Style Break", icon: "⊐", category: "Breakout", modes: BOTH, description: "Break of the high/low of the last N bars after a quiet period (range < X% of price).", params: [PERIOD(12, "Range bars", 3, 60), { key: "quiet", label: "Max range %", def: 1, step: 0.1, min: 0.1, max: 10 }],
    prepare: (c, p) => {
      const hh = I.highest(highs(c), p.period!), ll = I.lowest(lows(c), p.period!), v = closes(c);
      return (i) => { const q = ((hh[i - 1]! - ll[i - 1]!) / v[i - 1]!) * 100 < p.quiet!; return sig(q && v[i]! > hh[i - 1]!, q && v[i]! < ll[i - 1]!); };
    } },
  { id: "engulfing", name: "Engulfing Candle", icon: "◧", category: "Pattern", modes: BOTH, description: "Bullish engulfing after a down bar → buy; bearish engulfing after an up bar → sell.", params: [],
    prepare: (c) => (i) => {
      const a = c[i - 1]!, b = c[i]!;
      return sig(a[4] < a[1] && b[4] > b[1] && b[4] >= a[1] && b[1] <= a[4], a[4] > a[1] && b[4] < b[1] && b[4] <= a[1] && b[1] >= a[4]);
    } },
  { id: "pin_bar", name: "Pin Bar (Hammer)", icon: "⚲", category: "Pattern", modes: BOTH, description: "Long lower wick (hammer) → buy; long upper wick (shooting star) → sell.", params: [{ key: "wick", label: "Wick ÷ body", def: 2.5, step: 0.5, min: 1, max: 6 }],
    prepare: (c, p) => (i) => {
      const [, o, h, l, cl] = c[i]!, body = Math.max(Math.abs(cl - o), (h - l) * 0.05), lo = Math.min(o, cl) - l, up = h - Math.max(o, cl);
      return sig(lo > p.wick! * body && up < body, up > p.wick! * body && lo < body);
    } },
  { id: "three_bar", name: "Three Soldiers / Crows", icon: "Ⅲ", category: "Pattern", modes: BOTH, description: "Three consecutive strong up closes → buy; three strong down closes → sell.", params: [{ key: "bars", label: "Bars", def: 3, min: 2, max: 6 }],
    prepare: (c, p) => (i) => {
      let up = true, dn = true;
      for (let j = 0; j < p.bars!; j++) { const x = c[i - j]; if (!x) return null; up &&= x[4] > x[1] && x[4] > c[i - j - 1]![4]; dn &&= x[4] < x[1] && x[4] < c[i - j - 1]![4]; }
      return sig(up, dn);
    } },
  { id: "doji_reversal", name: "Doji Reversal", icon: "✚", category: "Pattern", modes: BOTH, description: "A doji (tiny body) after N bars in one direction, confirmed by the next bar.", params: [{ key: "trend", label: "Prior bars", def: 3, min: 2, max: 8 }],
    prepare: (c, p) => (i) => {
      const d = c[i - 1]!, x = c[i]!;
      if (Math.abs(d[4] - d[1]) > (d[2] - d[3]) * 0.1) return null;
      const before = c[i - 1 - p.trend!]; if (!before) return null;
      return sig(d[4] < before[4] && x[4] > d[2], d[4] > before[4] && x[4] < d[3]);
    } },
];

// Filtered and contrarian versions of signal-based strategies.
const FILTERABLE = ["sma_cross", "ema_cross", "macd_cross", "rsi_reversal", "stoch_cross", "bb_reversion", "bb_breakout", "donchian", "supertrend", "roc_momentum", "zscore", "williams_r", "cci_reversion", "keltner", "triple_ema", "hma_cross", "psar"];
const CONTRA = ["ema_cross", "bb_breakout", "donchian", "supertrend", "roc_momentum", "keltner", "awesome", "atr_breakout", "three_bar"];
const flip = (s: Signal): Signal => (s === "BUY" ? "SELL" : s === "SELL" ? "BUY" : null);

function variants(base: Template[]): Template[] {
  const by = Object.fromEntries(base.map((t) => [t.id, t]));
  const out: Template[] = [];
  for (const id of FILTERABLE) {
    const t = by[id]!;
    out.push({ ...t, id: `${id}__trend`, name: `${t.name} + Trend Filter`, description: `${t.description} Only takes buys above the long EMA and sells below it.`,
      params: [...t.params, { key: "filter", label: "Trend EMA", def: 100, min: 20, max: 250 }],
      prepare: (c, p) => { const s = t.prepare(c, p), e = I.ema(closes(c), p.filter!), v = closes(c); return (i, st) => { const x = s(i, st); return (x === "BUY" && v[i]! > e[i]!) || (x === "SELL" && v[i]! < e[i]!) ? x : null; }; } });
    out.push({ ...t, id: `${id}__vol`, name: `${t.name} + Volatility Filter`, description: `${t.description} Skips signals when the market is unusually quiet (ATR below its own average).`,
      params: [...t.params, { key: "filter", label: "ATR period", def: 14, min: 3, max: 100 }],
      prepare: (c, p) => {
        const s = t.prepare(c, p), a = I.atr(highs(c), lows(c), closes(c), p.filter!), am = I.sma(a.map((x) => (Number.isNaN(x) ? 0 : x)), 50);
        return (i, st) => { const x = s(i, st); return x && a[i]! >= am[i]! ? x : null; };
      } });
  }
  for (const id of CONTRA) {
    const t = by[id]!;
    out.push({ ...t, id: `${id}__fade`, name: `${t.name} (Contrarian)`, category: "Mean reversion", description: `Fades the classic signal: ${t.description.charAt(0).toLowerCase()}${t.description.slice(1)} — but trades the opposite way, betting the move is exhausted.`,
      prepare: (c, p) => { const s = t.prepare(c, p); return (i, st) => flip(s(i, st)); } });
  }
  return out;
}
TEMPLATES.push(...EXTRA);
TEMPLATES.push(...variants(TEMPLATES));

export const TEMPLATE_BY_ID: Record<string, Template> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export const MONEY_MGMT = {
  FIXED: "Fixed stake",
  MARTINGALE: "Martingale (×2 after loss, max 4 steps)",
  ANTI_MARTINGALE: "Anti-martingale (×2 after win, max 3 steps)",
} as const;
export type MoneyMgmt = keyof typeof MONEY_MGMT;

export function nextStake(mm: MoneyMgmt, base: number, cur: number, won: boolean): number {
  if (mm === "MARTINGALE") return won ? base : Math.min(cur * 2, base * 16);
  if (mm === "ANTI_MARTINGALE") return won ? Math.min(cur * 2, base * 8) : base;
  return base;
}

/** Auto-stop policy: a rule stops after MAX_LOSS_STREAK losses in a row (a win resets the count, a tie doesn't count). */
export const MAX_LOSS_STREAK = 4;
/** Success rate shown as "healthy" (green) in the UI. Display only — no longer used for stopping. */
export const MIN_SUCCESS = 0.6;

/** Account-level safety for bot binaries: all open bot stakes together may use at most this share of
 *  the practice equity, and a martingale stake that grows past MAX_MARTINGALE_SHARE resets to base. */
export const MAX_BOT_EXPOSURE = 0.3;
export const MAX_MARTINGALE_SHARE = 0.1;
/** Exposure cap while the session's aggressive mode is on. */
export const AGGRESSIVE_EXPOSURE = 0.5;

export const RULE_KTYPES = ["K_1M", "K_5M", "K_15M", "K_60M", "K_DAY"];

export interface RuleConfig {
  template: string; mode: RuleMode; code: string; ktype: string; params: Record<string, number>;
  amount: number; expiry: number; money_mgmt: MoneyMgmt; stop_loss_pct: number | null; take_profit_pct: number | null;
  /** Charge moomoo MY fees on stock trades (default true). */
  fees?: boolean;
}

export interface BacktestResult { trades: number; wins: number; losses: number; pnl: number; equity: [number, number][]; wouldStopAt: number | null; fills: [number, number][]; openPnl: number }

/** Replays a rule over historical candles (exact prices from the deterministic market). */
export function backtest(cfg: RuleConfig, candles: Candle[]): BacktestResult {
  const tpl = TEMPLATE_BY_ID[cfg.template]!;
  const sig = tpl.prepare(candles, cfg.params);
  const sec = KTYPES[cfg.ktype]!;
  const withFees = cfg.mode === "STOCK" && cfg.fees !== false;
  // Round-trip moomoo fees for closing a position (buy leg at the average entry, sell leg at exit).
  const fees = (qty: number, entry: number, exit: number, t: number) =>
    withFees ? feeTotal(cfg.code, "BUY", qty, entry, t) + feeTotal(cfg.code, "SELL", qty, exit, t) + qty * ((entry + exit) / 2) * (spreadBps(cfg.code) / 1e4) : 0;
  const st: RuleState = { posQty: 0, entryPrice: null, refPrice: null };
  let wins = 0, losses = 0, pnl = 0, stake = cfg.amount, wouldStopAt: number | null = null, busyUntil = 0, streak = 0;
  const equity: [number, number][] = [];
  const fills: [number, number][] = [];
  const record = (won: boolean, d = 0, t = 0) => {
    won ? wins++ : losses++;
    fills.push([t, d]);
    streak = won ? 0 : streak + 1;
    if (wouldStopAt == null && streak >= MAX_LOSS_STREAK) wouldStopAt = wins + losses;
  };
  for (let i = 30; i < candles.length; i++) {
    const t = candles[i]![0] + sec * 1000; // bar close time
    const px = candles[i]![4];
    if (cfg.mode === "STOCK" && st.posQty > 0 && st.entryPrice) {
      const ch = ((px - st.entryPrice) / st.entryPrice) * 100;
      if ((cfg.stop_loss_pct && ch <= -cfg.stop_loss_pct) || (cfg.take_profit_pct && ch >= cfg.take_profit_pct)) {
        const d = (px - st.entryPrice) * st.posQty - fees(st.posQty, st.entryPrice, px, t); pnl += d; record(d > 0, d, t);
        st.posQty = 0; st.refPrice = px; st.entryPrice = null;
      }
    }
    const s = sig(i, st);
    if (!s) { equity.push([t, round(pnl, 2)]); continue; }
    if (cfg.mode === "BINARY") {
      if (t < busyUntil) continue;
      const close = priceAt(cfg.code, t + cfg.expiry * 1000);
      const strike = priceAt(cfg.code, t);
      if (close !== strike) {
        const won = s === "BUY" ? close > strike : close < strike;
        const d = won ? stake * 0.85 : -stake;
        pnl += d; record(won, d, t);
        stake = nextStake(cfg.money_mgmt, cfg.amount, stake, won);
      }
      busyUntil = t + cfg.expiry * 1000;
    } else if (s === "BUY" && (st.posQty === 0 || cfg.template === "dca")) {
      st.entryPrice = st.posQty ? (st.entryPrice! * st.posQty + px * cfg.amount) / (st.posQty + cfg.amount) : px;
      st.posQty += cfg.amount;
    } else if (s === "SELL" && st.posQty > 0 && cfg.template !== "dca") {
      const d = (px - st.entryPrice!) * st.posQty - fees(st.posQty, st.entryPrice!, px, t); pnl += d; record(d > 0, d, t);
      st.posQty = 0; st.refPrice = px; st.entryPrice = null;
    }
    equity.push([t, round(pnl, 2)]);
  }
  return { trades: wins + losses, wins, losses, pnl: round(pnl, 2), equity, wouldStopAt, fills,
    openPnl: st.posQty > 0 && st.entryPrice ? round((candles.at(-1)![4] - st.entryPrice) * st.posQty - fees(st.posQty, st.entryPrice, candles.at(-1)![4], candles.at(-1)![0]), 2) : 0 };
}
