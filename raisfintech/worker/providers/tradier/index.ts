import type { ProviderMetadata } from "../types";

/** Tradier — public token-based REST API. Boundary only. */
export const tradierMetadata: ProviderMetadata = {
  id: "tradier",
  name: "Tradier",
  tagline: "US brokerage with a market-data API",
  instruments: "US Stocks · ETFs · Options",
  regions: "US",
  capabilities: {
    portfolio: true,
    positions: true,
    transactions: true,
    dividends: false,
    orders: true,
    trading: true,
    marketData: true,
    historicalData: true,
    oauth: true,
    apiKey: true,
    affiliate: false,
    referral: false,
  },
  configSecrets: ["TRADIER_ACCESS_TOKEN"],
  docsUrl: "https://documentation.tradier.com/",
};
