import type { ProviderMetadata } from "../types";

/** Trading 212 — public API-key REST API (beta, read-oriented). Boundary only. */
export const trading212Metadata: ProviderMetadata = {
  id: "trading212",
  name: "Trading 212",
  tagline: "UK & EU investing",
  instruments: "Stocks · ETFs",
  regions: "UK · EU",
  capabilities: {
    portfolio: true,
    positions: true,
    transactions: true,
    dividends: true,
    orders: true,
    trading: false, // public API is read/limited-order beta; don't overstate
    marketData: false,
    historicalData: false,
    oauth: false,
    apiKey: true,
    affiliate: false,
    referral: true,
  },
  configSecrets: ["TRADING212_API_KEY"],
  docsUrl: "https://t212public-api-docs.redoc.ly/",
};
