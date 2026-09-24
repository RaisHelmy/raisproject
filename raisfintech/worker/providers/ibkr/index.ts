import type { ProviderMetadata } from "../types";

/** Interactive Brokers — integration boundary only (Client Portal API /
 * OAuth). No adapter is live; no data is simulated. */
export const ibkrMetadata: ProviderMetadata = {
  id: "ibkr",
  name: "Interactive Brokers",
  tagline: "Global investing",
  instruments: "Stocks · ETFs · Options · Futures · Forex",
  regions: "Global",
  capabilities: {
    portfolio: true,
    positions: true,
    transactions: true,
    dividends: true,
    orders: true,
    trading: true,
    marketData: true,
    historicalData: true,
    oauth: true,
    apiKey: false,
    affiliate: true,
    referral: true,
  },
  configSecrets: ["IBKR_CLIENT_ID", "IBKR_CLIENT_SECRET"],
  docsUrl: "https://www.interactivebrokers.com/campus/ibkr-api-page/",
};
