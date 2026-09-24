/**
 * Instrument universe with compliance and risk metadata.
 *
 * Price history is generated deterministically per symbol (seeded PRNG,
 * geometric random walk) so every analysis is reproducible. In production
 * this module would be backed by a market-data provider; the analysis
 * pipeline on top is unchanged.
 */

export type ShariahStatus = "compliant" | "non-compliant" | "review";

export interface Instrument {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "reit";
  market: "MY" | "US";
  sector: string;
  shariah: { status: ShariahStatus; reason: string };
  /** simulation parameters */
  base: number;
  drift: number; // annual drift
  vol: number; // annual volatility
}

export const UNIVERSE: Instrument[] = [
  { symbol: "MAYBANK", name: "Malayan Banking Bhd", type: "stock", market: "MY", sector: "Financials",
    shariah: { status: "non-compliant", reason: "Core business is conventional (riba-based) banking." },
    base: 9.9, drift: 0.06, vol: 0.16 },
  { symbol: "CIMB", name: "CIMB Group Holdings", type: "stock", market: "MY", sector: "Financials",
    shariah: { status: "non-compliant", reason: "Conventional banking group; Islamic subsidiary not separately listed." },
    base: 6.7, drift: 0.05, vol: 0.20 },
  { symbol: "MISC", name: "MISC Bhd", type: "stock", market: "MY", sector: "Energy logistics",
    shariah: { status: "compliant", reason: "SC Malaysia Shariah-compliant list." },
    base: 7.6, drift: 0.07, vol: 0.22 },
  { symbol: "TENAGA", name: "Tenaga Nasional Bhd", type: "stock", market: "MY", sector: "Utilities",
    shariah: { status: "compliant", reason: "SC Malaysia Shariah-compliant list." },
    base: 13.8, drift: 0.05, vol: 0.18 },
  { symbol: "TOPGLOV", name: "Top Glove Corp", type: "stock", market: "MY", sector: "Healthcare",
    shariah: { status: "compliant", reason: "SC Malaysia Shariah-compliant list." },
    base: 1.1, drift: 0.02, vol: 0.48 },
  { symbol: "KLCC", name: "KLCC Property & REIT", type: "reit", market: "MY", sector: "Real estate",
    shariah: { status: "compliant", reason: "Stapled Islamic REIT structure." },
    base: 7.9, drift: 0.05, vol: 0.12 },
  { symbol: "AAPL", name: "Apple Inc.", type: "stock", market: "US", sector: "Technology",
    shariah: { status: "compliant", reason: "Passes common business-activity and financial-ratio screens." },
    base: 230, drift: 0.10, vol: 0.26 },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "stock", market: "US", sector: "Technology",
    shariah: { status: "compliant", reason: "Passes common business-activity and financial-ratio screens." },
    base: 425, drift: 0.11, vol: 0.24 },
  { symbol: "TSLA", name: "Tesla Inc.", type: "stock", market: "US", sector: "Automotive",
    shariah: { status: "compliant", reason: "Generally passes screens; monitor debt ratios." },
    base: 250, drift: 0.08, vol: 0.55 },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "stock", market: "US", sector: "Financials",
    shariah: { status: "non-compliant", reason: "Conventional banking — core interest-based income." },
    base: 215, drift: 0.08, vol: 0.22 },
  { symbol: "KO", name: "The Coca-Cola Company", type: "stock", market: "US", sector: "Consumer staples",
    shariah: { status: "review", reason: "Halal products, but financial-ratio screens vary by methodology — verify with your screener." },
    base: 63, drift: 0.05, vol: 0.14 },
  { symbol: "SPUS", name: "SP Funds S&P 500 Shariah ETF", type: "etf", market: "US", sector: "Diversified",
    shariah: { status: "compliant", reason: "Tracks the S&P 500 Shariah index; AAOIFI-screened." },
    base: 38, drift: 0.09, vol: 0.19 },
  { symbol: "HLAL", name: "Wahed FTSE USA Shariah ETF", type: "etf", market: "US", sector: "Diversified",
    shariah: { status: "compliant", reason: "FTSE Shariah USA index; board-supervised." },
    base: 52, drift: 0.09, vol: 0.20 },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "etf", market: "US", sector: "Diversified",
    shariah: { status: "non-compliant", reason: "Holds conventional financials and other non-screened constituents." },
    base: 560, drift: 0.09, vol: 0.17 },
  { symbol: "GLD", name: "SPDR Gold Shares", type: "etf", market: "US", sector: "Commodities",
    shariah: { status: "review", reason: "Gold exposure is permissible in principle; paper-gold structures require scholarly review." },
    base: 240, drift: 0.06, vol: 0.15 },
];

export function findInstrument(symbol: string): Instrument | undefined {
  return UNIVERSE.find((i) => i.symbol === symbol.toUpperCase());
}

/* ---------------- deterministic price history ---------------- */

function seedFromSymbol(symbol: string): number {
  let h = 2166136261;
  for (const ch of symbol) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = 280;

/** Daily closes, oldest → newest. Deterministic per symbol. */
export function priceHistory(inst: Instrument): number[] {
  const rand = mulberry32(seedFromSymbol(inst.symbol));
  const dt = 1 / 252;
  const prices: number[] = [inst.base];
  for (let i = 1; i < DAYS; i++) {
    // Box-Muller gaussian
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const prev = prices[i - 1];
    const next = prev * Math.exp((inst.drift - (inst.vol * inst.vol) / 2) * dt + inst.vol * Math.sqrt(dt) * g);
    prices.push(next);
  }
  return prices;
}
