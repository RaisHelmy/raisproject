import type { ProviderMetadata } from "../types";

/** Alpaca — public API-key REST API. Marked "configured" automatically when
 * the secrets below are present in the Worker environment; the adapter
 * itself is not live yet, so it never returns data either way. */
export const alpacaMetadata: ProviderMetadata = {
  id: "alpaca",
  name: "Alpaca",
  tagline: "API-first US investing",
  instruments: "US Stocks · ETFs",
  regions: "US (international sign-up)",
  capabilities: {
    portfolio: true,
    positions: true,
    transactions: true,
    dividends: false, // corporate-actions API exists but is not part of this boundary yet
    orders: true,
    trading: true,
    marketData: true,
    historicalData: true,
    oauth: true,
    apiKey: true,
    affiliate: false,
    referral: false,
  },
  configSecrets: ["ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY"],
  docsUrl: "https://docs.alpaca.markets/",
};
