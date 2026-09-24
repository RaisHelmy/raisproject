/**
 * Provider-agnostic investment types. Every broker adapter maps its native
 * API responses into these normalized shapes; nothing downstream (sync
 * engine, D1, React) knows provider specifics.
 */

export interface NormalizedAccount {
  providerAccountId: string;
  name: string;
  type: "brokerage" | "cash" | "margin" | "retirement";
  currency: string;
  cashBalance: number;
}

export interface NormalizedPosition {
  providerSecurityId?: string;
  symbol: string;
  name: string;
  quantity: number;
  avgCost?: number;
  lastPrice: number;
  currency: string;
  assetClass?: string;
  shariahStatus?: "compliant" | "non-compliant" | "review";
}

export interface NormalizedTransaction {
  providerTransactionId: string;
  type: "buy" | "sell" | "deposit" | "withdrawal" | "fee";
  symbol?: string;
  quantity?: number;
  price?: number;
  amount: number;
  currency: string;
  occurredAt: string; // ISO date
}

export interface NormalizedDividend {
  providerDividendId: string;
  symbol: string;
  amount: number;
  currency: string;
  payDate: string; // ISO date
}

/** A connected-provider client. Implemented adapters return real data for
 * their connection; pending adapters must throw IntegrationPendingError —
 * never fake success. */
export interface InvestmentProviderClient {
  getAccounts(): Promise<NormalizedAccount[]>;
  getPositions(providerAccountId: string): Promise<NormalizedPosition[]>;
  getTransactions(providerAccountId: string): Promise<NormalizedTransaction[]>;
  getDividends(providerAccountId: string): Promise<NormalizedDividend[]>;
}

export type InvestmentProviderCapabilities = {
  portfolio: boolean;
  positions: boolean;
  transactions: boolean;
  dividends: boolean;
  orders: boolean;
  trading: boolean;
  marketData: boolean;
  historicalData: boolean;
  oauth: boolean;
  apiKey: boolean;
  affiliate: boolean;
  referral: boolean;
};

/**
 * Honest integration states:
 *  - implemented: adapter works end-to-end in this build
 *  - configured:  API credentials/secrets are present, adapter not yet live
 *  - available:   provider has a public API; credentials not configured
 *  - coming_soon: integration boundary defined only
 */
export type IntegrationStatus = "implemented" | "configured" | "available" | "coming_soon";

export interface ProviderMetadata {
  id: string;
  name: string;
  tagline: string;
  instruments: string; // e.g. "Stocks · ETFs · Options"
  regions: string;
  capabilities: InvestmentProviderCapabilities;
  /** env secret names that mark this provider "configured" when all present */
  configSecrets: string[];
  docsUrl?: string;
}

export class IntegrationPendingError extends Error {
  providerId: string;
  constructor(providerId: string, name: string) {
    super(
      `${name} integration is not live yet. The connection boundary exists, but no data can be fetched — no simulated responses are produced for pending providers.`
    );
    this.providerId = providerId;
  }
}
