import type { ProviderMetadata } from "../types";

/** Saxo — integration boundary only (Saxo OpenAPI, OAuth 2.0). */
export const saxoMetadata: ProviderMetadata = {
  id: "saxo",
  name: "Saxo",
  tagline: "Global multi-asset platform",
  instruments: "Stocks · ETFs · Bonds · FX · CFDs",
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
    referral: false,
  },
  configSecrets: ["SAXO_APP_KEY", "SAXO_APP_SECRET"],
  docsUrl: "https://www.developer.saxo/openapi/learn",
};
