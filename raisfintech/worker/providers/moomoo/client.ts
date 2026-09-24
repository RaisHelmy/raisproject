/**
 * Moomoo adapter — the implemented provider in this build.
 *
 * Data source: the same deterministic simulation that powers the whole
 * market layer (worker/instruments.ts). Positions, transactions and
 * dividends are generated reproducibly per user from real price series, so
 * the complete pipeline — adapter → mapper → sync → D1 → API → React — is
 * genuinely exercised. Swapping this file's internals for Moomoo's OpenAPI
 * changes nothing downstream.
 */

import type {
  InvestmentProviderClient,
  NormalizedAccount,
  NormalizedDividend,
  NormalizedPosition,
  NormalizedTransaction,
} from "../types";
import { findInstrument, priceHistory } from "../../instruments";
import { mapPosition } from "./mapper";
import type { MoomooRawPosition } from "./types";

interface AccountSpec {
  providerAccountId: string;
  name: string;
  type: NormalizedAccount["type"];
  currency: string;
  cashBalance: number;
  holdings: { symbol: string; qty: number }[];
  dividends: { symbol: string; amount: number; monthsAgo: number }[];
}

const ACCOUNTS: AccountSpec[] = [
  {
    providerAccountId: "MMU-MY-CASH-001",
    name: "Moomoo MY — Cash Account",
    type: "cash",
    currency: "MYR",
    cashBalance: 25_000,
    holdings: [
      { symbol: "MAYBANK", qty: 2000 },
      { symbol: "TENAGA", qty: 800 },
      { symbol: "MISC", qty: 1500 },
      { symbol: "KLCC", qty: 1200 },
      { symbol: "AAPL", qty: 50 }, // deliberately duplicated across accounts
    ],
    dividends: [
      { symbol: "MAYBANK", amount: 640, monthsAgo: 1 },
      { symbol: "TENAGA", amount: 368, monthsAgo: 2 },
      { symbol: "KLCC", amount: 420, monthsAgo: 3 },
    ],
  },
  {
    providerAccountId: "MMU-GLB-USD-002",
    name: "Moomoo — Global (USD)",
    type: "margin",
    currency: "USD",
    cashBalance: 5_000,
    holdings: [
      { symbol: "AAPL", qty: 70 },
      { symbol: "MSFT", qty: 45 },
      { symbol: "TSLA", qty: 10 },
      { symbol: "SPUS", qty: 200 },
      { symbol: "HLAL", qty: 150 },
    ],
    dividends: [
      { symbol: "MSFT", amount: 33.75, monthsAgo: 1 },
      { symbol: "SPUS", amount: 96.4, monthsAgo: 2 },
    ],
  },
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

export class MoomooClient implements InvestmentProviderClient {
  constructor(private userId: string) {}

  async getAccounts(): Promise<NormalizedAccount[]> {
    return ACCOUNTS.map((a) => ({
      providerAccountId: a.providerAccountId,
      name: a.name,
      type: a.type,
      currency: a.currency,
      cashBalance: a.cashBalance,
    }));
  }

  async getPositions(providerAccountId: string): Promise<NormalizedPosition[]> {
    const acct = ACCOUNTS.find((a) => a.providerAccountId === providerAccountId);
    if (!acct) return [];
    return acct.holdings.flatMap((h) => {
      const inst = findInstrument(h.symbol);
      if (!inst) return [];
      const prices = priceHistory(inst);
      const raw: MoomooRawPosition = {
        stock_code: inst.symbol,
        stock_name: inst.name,
        qty: h.qty,
        cost_price: +prices[prices.length - 61].toFixed(2),
        market_price: +prices[prices.length - 1].toFixed(2),
        currency: inst.market === "MY" ? "MYR" : "USD",
      };
      return [mapPosition(raw, inst)];
    });
  }

  async getTransactions(providerAccountId: string): Promise<NormalizedTransaction[]> {
    const acct = ACCOUNTS.find((a) => a.providerAccountId === providerAccountId);
    if (!acct) return [];
    const txs: NormalizedTransaction[] = [];
    // Opening deposit + a reproducible buy history that led to today's book.
    txs.push({
      providerTransactionId: `${acct.providerAccountId}-DEP-1`,
      type: "deposit",
      amount: acct.cashBalance * 3,
      currency: acct.currency,
      occurredAt: isoDaysAgo(120),
    });
    acct.holdings.forEach((h, i) => {
      const inst = findInstrument(h.symbol);
      if (!inst) return;
      const prices = priceHistory(inst);
      const daysAgo = 90 - i * 12;
      const price = +prices[prices.length - 1 - daysAgo].toFixed(2);
      txs.push({
        providerTransactionId: `${acct.providerAccountId}-BUY-${h.symbol}`,
        type: "buy",
        symbol: h.symbol,
        quantity: h.qty,
        price,
        amount: +(h.qty * price).toFixed(2),
        currency: inst.market === "MY" ? "MYR" : "USD",
        occurredAt: isoDaysAgo(daysAgo),
      });
    });
    return txs;
  }

  async getDividends(providerAccountId: string): Promise<NormalizedDividend[]> {
    const acct = ACCOUNTS.find((a) => a.providerAccountId === providerAccountId);
    if (!acct) return [];
    return acct.dividends.map((d, i) => {
      const inst = findInstrument(d.symbol);
      return {
        providerDividendId: `${acct.providerAccountId}-DIV-${d.symbol}-${i}`,
        symbol: d.symbol,
        amount: d.amount,
        currency: inst?.market === "MY" ? "MYR" : "USD",
        payDate: isoDaysAgo(d.monthsAgo * 30),
      };
    });
  }
}
