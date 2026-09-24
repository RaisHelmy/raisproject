/**
 * Rais Fintech quant engine.
 *
 * Hierarchy (mirrors the robo design):
 *   TECHNIQUE  — a family of mechanical trading approaches
 *     METHOD   — a way of applying the technique
 *       ALGORITHM — a concrete, parameterized rule producing a signal
 *
 * A separate DECISION LIBRARY combines algorithm signals into one decision:
 *   aggregators (how votes are combined), risk filters (when to overrule),
 *   and position sizing (how much to commit).
 *
 * Every algorithm returns a Signal with action, score in [-1, 1] and a
 * human-readable detail — the UI shows the full breakdown per instrument.
 */

import type { Instrument, ShariahStatus } from "./instruments";
import { priceHistory } from "./instruments";

export interface Signal {
  action: "buy" | "sell" | "hold";
  score: number; // -1 (strong sell) .. +1 (strong buy)
  detail: string;
}

/* ================= indicator primitives ================= */

function sma(prices: number[], n: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i];
    if (i >= n) sum -= prices[i - n];
    out.push(i >= n - 1 ? sum / n : NaN);
  }
  return out;
}

function ema(prices: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  let prev = prices[0];
  for (let i = 0; i < prices.length; i++) {
    prev = i === 0 ? prices[0] : prices[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function stdev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

function dailyReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) out.push(prices[i] / prices[i - 1] - 1);
  return out;
}

function rsi(prices: number[], n = 14): number {
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / n;
  let avgLoss = loss / n;
  for (let i = n + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    avgGain = (avgGain * (n - 1) + Math.max(d, 0)) / n;
    avgLoss = (avgLoss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function maxDrawdown(prices: number[]): number {
  let peak = prices[0];
  let mdd = 0;
  for (const p of prices) {
    peak = Math.max(peak, p);
    mdd = Math.max(mdd, (peak - p) / peak);
  }
  return mdd;
}

function annualizedVol(prices: number[]): number {
  return stdev(dailyReturns(prices)) * Math.sqrt(252);
}

const clamp = (x: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, x));
const toAction = (score: number): Signal["action"] =>
  score > 0.15 ? "buy" : score < -0.15 ? "sell" : "hold";
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/* ================= algorithm registry ================= */

export interface AlgorithmDef {
  id: string;
  name: string;
  description: string;
  run: (prices: number[]) => Signal;
}

export interface MethodDef {
  id: string;
  name: string;
  description: string;
  algorithms: AlgorithmDef[];
}

export interface TechniqueDef {
  id: string;
  name: string;
  description: string;
  weight: number; // weight in the weighted-score aggregator
  methods: MethodDef[];
}

const signal = (score: number, detail: string): Signal => ({
  action: toAction(clamp(score)),
  score: clamp(score),
  detail,
});

export const TECHNIQUES: TechniqueDef[] = [
  {
    id: "trend",
    name: "Trend Following",
    weight: 0.4,
    description: "Ride established price trends; enter with the trend, exit when it turns.",
    methods: [
      {
        id: "ma-cross",
        name: "Moving Average Crossover",
        description: "Compare a fast average against a slow one; crossings mark trend changes.",
        algorithms: [
          {
            id: "sma-50-200",
            name: "SMA 50/200 (Golden Cross)",
            description: "Buy when the 50-day SMA is above the 200-day; recent crosses are strongest.",
            run: (p) => {
              const f = sma(p, 50);
              const s = sma(p, 200);
              const i = p.length - 1;
              const above = f[i] > s[i];
              const crossedRecently =
                (f[i] > s[i]) !== (f[i - 5] > s[i - 5]);
              const gap = (f[i] - s[i]) / s[i];
              const score = clamp(gap * 12) + (crossedRecently ? (above ? 0.3 : -0.3) : 0);
              return signal(
                score,
                `SMA50 ${above ? "above" : "below"} SMA200 by ${pct(Math.abs(gap))}${crossedRecently ? " — crossed within 5 days" : ""}`
              );
            },
          },
          {
            id: "ema-12-26",
            name: "EMA 12/26 Crossover",
            description: "Faster exponential crossover for shorter trends.",
            run: (p) => {
              const f = ema(p, 12);
              const s = ema(p, 26);
              const i = p.length - 1;
              const gap = (f[i] - s[i]) / s[i];
              return signal(clamp(gap * 25), `EMA12 vs EMA26 gap ${pct(gap)}`);
            },
          },
        ],
      },
      {
        id: "macd",
        name: "MACD",
        description: "Moving Average Convergence/Divergence — momentum of the trend itself.",
        algorithms: [
          {
            id: "macd-12-26-9",
            name: "MACD Histogram (12, 26, 9)",
            description: "Buy when the histogram is positive and rising; sell when negative and falling.",
            run: (p) => {
              const macd = ema(p, 12).map((v, i) => v - ema(p, 26)[i]);
              const sig = ema(macd, 9);
              const i = p.length - 1;
              const hist = macd[i] - sig[i];
              const histPrev = macd[i - 3] - sig[i - 3];
              const rising = hist > histPrev;
              const norm = hist / p[i];
              const score = clamp(norm * 120) * (rising ? 1 : 0.5);
              return signal(score, `Histogram ${norm >= 0 ? "+" : ""}${(norm * 100).toFixed(2)}% of price, ${rising ? "rising" : "falling"}`);
            },
          },
        ],
      },
    ],
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    weight: 0.3,
    description: "Prices stretch and snap back; buy oversold, sell overbought.",
    methods: [
      {
        id: "oscillators",
        name: "Oscillators",
        description: "Bounded indicators that flag exhaustion.",
        algorithms: [
          {
            id: "rsi-14",
            name: "RSI 14",
            description: "Relative Strength Index — below 30 oversold (buy), above 70 overbought (sell).",
            run: (p) => {
              const r = rsi(p, 14);
              const score = clamp((50 - r) / 25);
              return signal(score, `RSI(14) = ${r.toFixed(1)} ${r < 30 ? "— oversold" : r > 70 ? "— overbought" : ""}`);
            },
          },
        ],
      },
      {
        id: "bands",
        name: "Bands & Statistics",
        description: "Statistical envelopes around a rolling mean.",
        algorithms: [
          {
            id: "bollinger-20-2",
            name: "Bollinger Bands (20, 2σ)",
            description: "Buy touches of the lower band, sell touches of the upper band.",
            run: (p) => {
              const n = 20;
              const window = p.slice(-n);
              const m = window.reduce((a, b) => a + b, 0) / n;
              const sd = stdev(window);
              const z = (p[p.length - 1] - m) / (sd || 1e-9);
              return signal(clamp(-z / 2), `Close is ${z.toFixed(2)}σ from the 20-day mean`);
            },
          },
          {
            id: "zscore-20",
            name: "Z-Score 20",
            description: "Standardized distance from the 20-day mean; fade extremes beyond ±2σ.",
            run: (p) => {
              const n = 20;
              const window = p.slice(-n);
              const m = window.reduce((a, b) => a + b, 0) / n;
              const sd = stdev(window);
              const z = (p[p.length - 1] - m) / (sd || 1e-9);
              const score = Math.abs(z) > 2 ? clamp(-z / 2.5) : clamp(-z / 6);
              return signal(score, `z = ${z.toFixed(2)} ${Math.abs(z) > 2 ? "(extreme)" : "(normal range)"}`);
            },
          },
        ],
      },
    ],
  },
  {
    id: "momentum",
    name: "Momentum",
    weight: 0.3,
    description: "Recent winners tend to keep winning over the following weeks.",
    methods: [
      {
        id: "roc",
        name: "Rate of Change",
        description: "Simple lookback returns as a momentum measure.",
        algorithms: [
          {
            id: "roc-20",
            name: "ROC 20-day",
            description: "One-month price change; positive momentum favors buying.",
            run: (p) => {
              const i = p.length - 1;
              const roc = p[i] / p[i - 20] - 1;
              return signal(clamp(roc * 8), `20-day change ${pct(roc)}`);
            },
          },
          {
            id: "momentum-90",
            name: "Momentum 90-day",
            description: "Quarterly momentum — a classic cross-sectional factor.",
            run: (p) => {
              const i = p.length - 1;
              const m = p[i] / p[i - 90] - 1;
              return signal(clamp(m * 4), `90-day change ${pct(m)}`);
            },
          },
        ],
      },
      {
        id: "breakout",
        name: "Breakout",
        description: "New highs/lows against a rolling channel signal continuation.",
        algorithms: [
          {
            id: "donchian-55",
            name: "Donchian Channel 55",
            description: "Buy a close at a new 55-day high; sell a close at a new 55-day low.",
            run: (p) => {
              const i = p.length - 1;
              const window = p.slice(i - 55, i);
              const hi = Math.max(...window);
              const lo = Math.min(...window);
              const c = p[i];
              if (c >= hi) return signal(0.7, `New 55-day high (${c.toFixed(2)} ≥ ${hi.toFixed(2)})`);
              if (c <= lo) return signal(-0.7, `New 55-day low (${c.toFixed(2)} ≤ ${lo.toFixed(2)})`);
              const pos = (c - lo) / (hi - lo) - 0.5;
              return signal(pos * 0.3, `At ${Math.round(((c - lo) / (hi - lo)) * 100)}% of the 55-day channel`);
            },
          },
        ],
      },
    ],
  },
];

/* ================= decision-making library ================= */

export const DECISION_LIBRARY = {
  aggregators: [
    { id: "weighted-score", name: "Weighted Score", description: "Average of all algorithm scores, weighted by technique (trend 40%, mean-reversion 30%, momentum 30%). The default." },
    { id: "majority-vote", name: "Majority Vote", description: "Each algorithm gets one vote; the most common action wins." },
    { id: "unanimous", name: "Unanimous Consent", description: "Act only when every technique agrees; otherwise hold. Most conservative." },
  ],
  riskFilters: [
    { id: "volatility-cap", name: "Volatility Cap", description: "Annualized volatility above 45% downgrades any buy to hold." },
    { id: "drawdown-guard", name: "Drawdown Guard", description: "A historical max drawdown above 40% blocks new buys." },
    { id: "shariah-screen", name: "Shariah Screen", description: "Non-compliant instruments are excluded from Shariah-mandated strategies." },
  ],
  positionSizing: [
    { id: "fixed-fraction", name: "Fixed Fraction", description: "Commit a fixed 2% of capital per position." },
    { id: "volatility-target", name: "Volatility Target", description: "Scale the position so it contributes ~10% annualized volatility." },
    { id: "kelly-capped", name: "Capped Kelly", description: "Kelly-optimal fraction from confidence, capped at 25% for safety." },
  ],
};

/* ================= per-instrument analysis ================= */

export interface AlgoResult {
  id: string;
  name: string;
  action: Signal["action"];
  score: number;
  detail: string;
}

export interface MethodResult {
  id: string;
  name: string;
  algorithms: AlgoResult[];
}

export interface TechniqueResult {
  id: string;
  name: string;
  weight: number;
  score: number;
  action: Signal["action"];
  methods: MethodResult[];
}

export interface InstrumentAnalysis {
  symbol: string;
  name: string;
  type: string;
  market: string;
  sector: string;
  flags: {
    shariah: { status: ShariahStatus; reason: string };
    risk: "low" | "medium" | "high";
    volatilityPct: number;
    maxDrawdownPct: number;
  };
  history: {
    latest: number;
    r1m: number;
    r3m: number;
    r1y: number;
    sparkline: number[];
  };
  techniques: TechniqueResult[];
  decision: {
    action: Signal["action"];
    confidence: number; // 0..1
    aggregator: string;
    votes: { buy: number; sell: number; hold: number };
    riskFilters: { id: string; name: string; triggered: boolean; note: string }[];
    sizing: { id: string; name: string; fractionPct: number }[];
  };
}

export function analyzeInstrument(inst: Instrument): InstrumentAnalysis {
  const prices = priceHistory(inst);
  const i = prices.length - 1;
  const vol = annualizedVol(prices);
  const mdd = maxDrawdown(prices);

  const risk: "low" | "medium" | "high" =
    vol < 0.18 && mdd < 0.2 ? "low" : vol < 0.32 && mdd < 0.35 ? "medium" : "high";

  const techniques: TechniqueResult[] = TECHNIQUES.map((t) => {
    const methods: MethodResult[] = t.methods.map((m) => ({
      id: m.id,
      name: m.name,
      algorithms: m.algorithms.map((a) => {
        const s = a.run(prices);
        return { id: a.id, name: a.name, action: s.action, score: s.score, detail: s.detail };
      }),
    }));
    const algoScores = methods.flatMap((m) => m.algorithms.map((a) => a.score));
    const score = algoScores.reduce((a, b) => a + b, 0) / algoScores.length;
    return { id: t.id, name: t.name, weight: t.weight, score, action: toAction(score), methods };
  });

  // aggregator: weighted score
  const weighted = techniques.reduce((acc, t) => acc + t.score * t.weight, 0);
  let action = toAction(weighted);
  const allAlgos = techniques.flatMap((t) => t.methods.flatMap((m) => m.algorithms));
  const votes = {
    buy: allAlgos.filter((a) => a.action === "buy").length,
    sell: allAlgos.filter((a) => a.action === "sell").length,
    hold: allAlgos.filter((a) => a.action === "hold").length,
  };

  // risk filters
  const riskFilters = [
    {
      id: "volatility-cap",
      name: "Volatility Cap",
      triggered: vol > 0.45 && action === "buy",
      note: vol > 0.45 ? `Annualized volatility ${pct(vol)} exceeds the 45% cap` : `Volatility ${pct(vol)} within cap`,
    },
    {
      id: "drawdown-guard",
      name: "Drawdown Guard",
      triggered: mdd > 0.4 && action === "buy",
      note: mdd > 0.4 ? `Max drawdown ${pct(mdd)} exceeds the 40% guard` : `Max drawdown ${pct(mdd)} within guard`,
    },
  ];
  if (riskFilters.some((f) => f.triggered)) action = "hold";

  const confidence = Math.min(1, Math.abs(weighted) * 2);
  const kelly = Math.min(0.25, Math.max(0, confidence * 0.3));

  const step = Math.max(1, Math.floor(prices.length / 60));
  const sparkline = prices.filter((_, idx) => idx % step === 0).map((p) => +p.toFixed(2));

  return {
    symbol: inst.symbol,
    name: inst.name,
    type: inst.type,
    market: inst.market,
    sector: inst.sector,
    flags: {
      shariah: inst.shariah,
      risk,
      volatilityPct: +(vol * 100).toFixed(1),
      maxDrawdownPct: +(mdd * 100).toFixed(1),
    },
    history: {
      latest: +prices[i].toFixed(2),
      r1m: +((prices[i] / prices[i - 21] - 1) * 100).toFixed(1),
      r3m: +((prices[i] / prices[i - 63] - 1) * 100).toFixed(1),
      r1y: +((prices[i] / prices[i - 252] - 1) * 100).toFixed(1),
      sparkline,
    },
    techniques,
    decision: {
      action,
      confidence: +confidence.toFixed(2),
      aggregator: "weighted-score",
      votes,
      riskFilters,
      sizing: [
        { id: "fixed-fraction", name: "Fixed Fraction", fractionPct: 2 },
        { id: "volatility-target", name: "Volatility Target", fractionPct: +Math.min(10, (0.1 / vol) * 10).toFixed(1) },
        { id: "kelly-capped", name: "Capped Kelly", fractionPct: +(kelly * 100).toFixed(1) },
      ],
    },
  };
}

/** Registry tree without the run functions — safe to serialize for the UI. */
export function registryForUi() {
  return {
    techniques: TECHNIQUES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      weight: t.weight,
      methods: t.methods.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        algorithms: m.algorithms.map((a) => ({ id: a.id, name: a.name, description: a.description })),
      })),
    })),
    decisionLibrary: DECISION_LIBRARY,
  };
}
