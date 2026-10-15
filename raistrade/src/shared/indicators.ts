// Classic technical indicators. Every function returns a series aligned with the input
// (NaN until enough data), so strategies can index any bar directly.

export function sma(v: number[], p: number): number[] {
  const out = new Array<number>(v.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    s += v[i]!;
    if (i >= p) s -= v[i - p]!;
    if (i >= p - 1) out[i] = s / p;
  }
  return out;
}

export function ema(v: number[], p: number): number[] {
  const out = new Array<number>(v.length).fill(NaN);
  const k = 2 / (p + 1);
  let prev = NaN;
  for (let i = 0; i < v.length; i++) {
    if (i === p - 1) prev = v.slice(0, p).reduce((a, b) => a + b, 0) / p;
    else if (i >= p) prev = v[i]! * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function stdev(v: number[], p: number): number[] {
  const m = sma(v, p);
  return v.map((_, i) => {
    if (i < p - 1) return NaN;
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += (v[j]! - m[i]!) ** 2;
    return Math.sqrt(s / p);
  });
}

/** Wilder's RSI. */
export function rsi(v: number[], p: number): number[] {
  const out = new Array<number>(v.length).fill(NaN);
  let g = 0, l = 0;
  for (let i = 1; i < v.length; i++) {
    const d = v[i]! - v[i - 1]!;
    const up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= p) { g += up / p; l += dn / p; }
    else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; }
    if (i >= p) out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

export function macd(v: number[], fast: number, slow: number, signal: number) {
  const f = ema(v, fast), s = ema(v, slow);
  const line = v.map((_, i) => f[i]! - s[i]!);
  const firstValid = line.findIndex((x) => !Number.isNaN(x));
  const sig = new Array<number>(v.length).fill(NaN);
  if (firstValid >= 0) ema(line.slice(firstValid), signal).forEach((x, j) => (sig[firstValid + j] = x));
  return { line, signal: sig, hist: line.map((x, i) => x - sig[i]!) };
}

export function bollinger(v: number[], p: number, mult: number) {
  const mid = sma(v, p), sd = stdev(v, p);
  return { mid, upper: mid.map((m, i) => m + mult * sd[i]!), lower: mid.map((m, i) => m - mult * sd[i]!) };
}

export function highest(v: number[], p: number): number[] {
  return v.map((_, i) => (i < p - 1 ? NaN : Math.max(...v.slice(i - p + 1, i + 1))));
}
export function lowest(v: number[], p: number): number[] {
  return v.map((_, i) => (i < p - 1 ? NaN : Math.min(...v.slice(i - p + 1, i + 1))));
}

export function stochastic(h: number[], l: number[], c: number[], kp: number, dp: number) {
  const hh = highest(h, kp), ll = lowest(l, kp);
  const k = c.map((x, i) => (hh[i]! === ll[i]! ? 50 : ((x - ll[i]!) / (hh[i]! - ll[i]!)) * 100));
  return { k, d: sma(k.map((x) => (Number.isNaN(x) ? 0 : x)), dp).map((x, i) => (i < kp + dp - 2 ? NaN : x)) };
}

export function atr(h: number[], l: number[], c: number[], p: number): number[] {
  const tr = c.map((_, i) => (i === 0 ? h[0]! - l[0]! : Math.max(h[i]! - l[i]!, Math.abs(h[i]! - c[i - 1]!), Math.abs(l[i]! - c[i - 1]!))));
  const out = new Array<number>(c.length).fill(NaN);
  let prev = NaN;
  for (let i = 0; i < c.length; i++) {
    if (i === p - 1) prev = tr.slice(0, p).reduce((a, b) => a + b, 0) / p;
    else if (i >= p) prev = (prev * (p - 1) + tr[i]!) / p;
    out[i] = prev;
  }
  return out;
}

/** Supertrend direction: +1 uptrend, -1 downtrend. */
export function supertrend(h: number[], l: number[], c: number[], p: number, mult: number): number[] {
  const a = atr(h, l, c, p);
  const dir = new Array<number>(c.length).fill(NaN);
  let upper = NaN, lower = NaN, d = 1;
  for (let i = 0; i < c.length; i++) {
    if (Number.isNaN(a[i]!)) continue;
    const mid = (h[i]! + l[i]!) / 2;
    const bu = mid + mult * a[i]!, bl = mid - mult * a[i]!;
    upper = Number.isNaN(upper) || bu < upper || c[i - 1]! > upper ? bu : upper;
    lower = Number.isNaN(lower) || bl > lower || c[i - 1]! < lower ? bl : lower;
    if (d === 1 && c[i]! < lower) d = -1;
    else if (d === -1 && c[i]! > upper) d = 1;
    dir[i] = d;
  }
  return dir;
}

export const crossUp = (a: number[], b: number[] | number, i: number) => {
  const bi = typeof b === "number" ? b : b[i]!, bp = typeof b === "number" ? b : b[i - 1]!;
  return a[i - 1]! <= bp && a[i]! > bi;
};
export const crossDown = (a: number[], b: number[] | number, i: number) => {
  const bi = typeof b === "number" ? b : b[i]!, bp = typeof b === "number" ? b : b[i - 1]!;
  return a[i - 1]! >= bp && a[i]! < bi;
};

export function wma(v: number[], p: number): number[] {
  const den = (p * (p + 1)) / 2;
  return v.map((_, i) => {
    if (i < p - 1) return NaN;
    let s = 0;
    for (let j = 0; j < p; j++) s += v[i - j]! * (p - j);
    return s / den;
  });
}

/** EMA that tolerates leading NaNs (used for chained smoothing). */
export function emaNaN(v: number[], p: number): number[] {
  const first = v.findIndex((x) => !Number.isNaN(x));
  const out = new Array<number>(v.length).fill(NaN);
  if (first >= 0) ema(v.slice(first), p).forEach((x, j) => (out[first + j] = x));
  return out;
}

export function dema(v: number[], p: number): number[] {
  const e = ema(v, p), ee = emaNaN(e, p);
  return e.map((x, i) => 2 * x - ee[i]!);
}

export function tema(v: number[], p: number): number[] {
  const e = ema(v, p), ee = emaNaN(e, p), eee = emaNaN(ee, p);
  return e.map((x, i) => 3 * x - 3 * ee[i]! + eee[i]!);
}

export function hma(v: number[], p: number): number[] {
  const half = wma(v, Math.max(1, Math.floor(p / 2))), full = wma(v, p);
  const raw = half.map((x, i) => 2 * x - full[i]!);
  const first = raw.findIndex((x) => !Number.isNaN(x));
  const out = new Array<number>(v.length).fill(NaN);
  if (first >= 0) wma(raw.slice(first), Math.max(1, Math.round(Math.sqrt(p)))).forEach((x, j) => (out[first + j] = x));
  return out;
}

/** Wilder smoothing that tolerates leading NaNs. */
export function rma(v: number[], p: number): number[] {
  const out = new Array<number>(v.length).fill(NaN);
  let prev = NaN, n = 0, s = 0;
  for (let i = 0; i < v.length; i++) {
    if (Number.isNaN(v[i]!)) continue;
    if (n < p) { s += v[i]!; n++; if (n === p) prev = s / p; }
    else prev = (prev * (p - 1) + v[i]!) / p;
    out[i] = prev;
  }
  return out;
}

/** +DI, -DI and ADX. */
export function dmi(h: number[], l: number[], c: number[], p: number) {
  const n = c.length, pdm = new Array<number>(n).fill(NaN), mdm = new Array<number>(n).fill(NaN), tr = new Array<number>(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    const up = h[i]! - h[i - 1]!, dn = l[i - 1]! - l[i]!;
    pdm[i] = up > dn && up > 0 ? up : 0;
    mdm[i] = dn > up && dn > 0 ? dn : 0;
    tr[i] = Math.max(h[i]! - l[i]!, Math.abs(h[i]! - c[i - 1]!), Math.abs(l[i]! - c[i - 1]!));
  }
  const str = rma(tr, p), sp = rma(pdm, p), sm = rma(mdm, p);
  const plus = str.map((t, i) => (t ? (100 * sp[i]!) / t : NaN)), minus = str.map((t, i) => (t ? (100 * sm[i]!) / t : NaN));
  const dx = plus.map((x, i) => (x + minus[i]! ? (100 * Math.abs(x - minus[i]!)) / (x + minus[i]!) : NaN));
  return { plus, minus, adx: rma(dx, p) };
}

/** Parabolic SAR direction: +1 long, -1 short. */
export function psar(h: number[], l: number[], step: number, max: number): number[] {
  const dir = new Array<number>(h.length).fill(NaN);
  if (h.length < 2) return dir;
  let up = true, sar = l[0]!, ep = h[0]!, af = step;
  for (let i = 1; i < h.length; i++) {
    sar = sar + af * (ep - sar);
    if (up) {
      sar = Math.min(sar, l[i - 1]!, l[Math.max(0, i - 2)]!);
      if (l[i]! < sar) { up = false; sar = ep; ep = l[i]!; af = step; }
      else if (h[i]! > ep) { ep = h[i]!; af = Math.min(max, af + step); }
    } else {
      sar = Math.max(sar, h[i - 1]!, h[Math.max(0, i - 2)]!);
      if (h[i]! > sar) { up = true; sar = ep; ep = h[i]!; af = step; }
      else if (l[i]! < ep) { ep = l[i]!; af = Math.min(max, af + step); }
    }
    dir[i] = up ? 1 : -1;
  }
  return dir;
}

/** Slope of the least-squares line over the last p values. */
export function linregSlope(v: number[], p: number): number[] {
  const sx = (p * (p - 1)) / 2, sxx = ((p - 1) * p * (2 * p - 1)) / 6, den = p * sxx - sx * sx;
  return v.map((_, i) => {
    if (i < p - 1) return NaN;
    let sy = 0, sxy = 0;
    for (let j = 0; j < p; j++) { const y = v[i - p + 1 + j]!; sy += y; sxy += j * y; }
    return (p * sxy - sx * sy) / den;
  });
}
