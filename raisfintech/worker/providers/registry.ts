/**
 * Central provider registry — the single source of provider truth. React
 * never hardcodes provider lists; it reads GET /api/investments/providers,
 * which is built from here plus D1 affiliate configuration.
 */

import type { Env } from "../types";
import type { IntegrationStatus, InvestmentProviderClient, ProviderMetadata } from "./types";
import { pendingClient } from "./pending";
import { MoomooClient } from "./moomoo/client";
import { ibkrMetadata } from "./ibkr";
import { saxoMetadata } from "./saxo";
import { alpacaMetadata } from "./alpaca";
import { tradierMetadata } from "./tradier";
import { trading212Metadata } from "./trading212";

const moomooMetadata: ProviderMetadata = {
  id: "moomoo",
  name: "Moomoo",
  tagline: "Malaysia & global markets",
  instruments: "Stocks · ETFs · REITs",
  regions: "MY · US · SG · AU",
  capabilities: {
    portfolio: true,
    positions: true,
    transactions: true,
    dividends: true,
    orders: true,
    trading: true,
    marketData: true,
    historicalData: true,
    oauth: false,
    apiKey: true,
    affiliate: true,
    referral: true,
  },
  configSecrets: [],
  docsUrl: "https://openapi.moomoo.com/",
};

interface RegistryEntry {
  metadata: ProviderMetadata;
  /** Fixed floor for this provider's status. */
  baseStatus: "implemented" | "available" | "coming_soon";
  makeClient: (env: Env, userId: string) => InvestmentProviderClient;
}

export const PROVIDER_REGISTRY: RegistryEntry[] = [
  {
    metadata: moomooMetadata,
    baseStatus: "implemented",
    makeClient: (_env, userId) => new MoomooClient(userId),
  },
  {
    metadata: ibkrMetadata,
    baseStatus: "coming_soon",
    makeClient: () => pendingClient("ibkr", "Interactive Brokers"),
  },
  {
    metadata: saxoMetadata,
    baseStatus: "coming_soon",
    makeClient: () => pendingClient("saxo", "Saxo"),
  },
  {
    metadata: alpacaMetadata,
    baseStatus: "available",
    makeClient: () => pendingClient("alpaca", "Alpaca"),
  },
  {
    metadata: tradierMetadata,
    baseStatus: "available",
    makeClient: () => pendingClient("tradier", "Tradier"),
  },
  {
    metadata: trading212Metadata,
    baseStatus: "available",
    makeClient: () => pendingClient("trading212", "Trading 212"),
  },
];

export function getProviderEntry(providerId: string): RegistryEntry | undefined {
  return PROVIDER_REGISTRY.find((p) => p.metadata.id === providerId);
}

/** "available" providers upgrade to "configured" when their secrets exist.
 * Only "implemented" providers can actually sync data. */
export function integrationStatus(entry: RegistryEntry, env: Env): IntegrationStatus {
  if (entry.baseStatus === "implemented") return "implemented";
  if (entry.baseStatus === "coming_soon") return "coming_soon";
  const e = env as unknown as Record<string, unknown>;
  const configured =
    entry.metadata.configSecrets.length > 0 &&
    entry.metadata.configSecrets.every((k) => typeof e[k] === "string" && e[k] !== "");
  return configured ? "configured" : "available";
}
