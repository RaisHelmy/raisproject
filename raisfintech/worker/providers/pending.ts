import { IntegrationPendingError, type InvestmentProviderClient } from "./types";

/**
 * Client for providers whose integration boundary exists but whose API is
 * not wired up. Every method throws — pending providers never return fake
 * data, so nothing upstream can mistake them for live integrations.
 */
export function pendingClient(providerId: string, name: string): InvestmentProviderClient {
  const fail = () => {
    throw new IntegrationPendingError(providerId, name);
  };
  return {
    getAccounts: async () => fail(),
    getPositions: async () => fail(),
    getTransactions: async () => fail(),
    getDividends: async () => fail(),
  };
}
