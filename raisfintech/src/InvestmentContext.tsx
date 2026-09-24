import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./lib/api";
import { useAuth } from "./AuthContext";
import { useGuidance } from "./ux/GuidanceContext";

/* ---- shapes served by /api/investments/* ---- */

export interface ProviderInfo {
  id: string;
  name: string;
  tagline: string;
  instruments: string;
  regions: string;
  capabilities: Record<string, boolean>;
  integrationStatus: "implemented" | "configured" | "available" | "coming_soon";
  connectable: boolean;
  affiliate: { available: boolean; registrationUrl?: string; disclosure?: string; termsUrl?: string | null };
}

export interface ConnectionInfo {
  id: string;
  provider_id: string;
  status: string;
  environment: string;
  label: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  created_at: string;
}

export interface AccountInfo {
  id: string;
  name: string;
  type: string;
  currency: string;
  cash_balance: number;
  provider_id: string;
  connection_id: string;
}

/** Global account scope: all accounts, one provider, or one account.
 * Persists per device so the user never re-selects across pages. */
export type InvestScope =
  | { type: "all" }
  | { type: "provider"; id: string }
  | { type: "account"; id: string };

export function scopeQuery(scope: InvestScope): string {
  if (scope.type === "provider") return `?accountId=all&providerId=${scope.id}`;
  if (scope.type === "account") return `?accountId=${scope.id}`;
  return "?accountId=all";
}

const SCOPE_KEY = "rais.invest.scope";

interface InvestmentApi {
  providers: ProviderInfo[];
  connections: ConnectionInfo[];
  accounts: AccountInfo[];
  loading: boolean;
  scope: InvestScope;
  setScope: (s: InvestScope) => void;
  refresh: () => Promise<void>;
  providerName: (id: string) => string;
}

const InvestmentContext = createContext<InvestmentApi | null>(null);

export function InvestmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { state, update, ready } = useGuidance();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScopeState] = useState<InvestScope>(() => {
    try {
      const raw = localStorage.getItem(SCOPE_KEY);
      return raw ? (JSON.parse(raw) as InvestScope) : { type: "all" };
    } catch {
      return { type: "all" };
    }
  });

  const setScope = useCallback((s: InvestScope) => {
    setScopeState(s);
    try {
      localStorage.setItem(SCOPE_KEY, JSON.stringify(s));
    } catch { /* per-device convenience only */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [prov, conns, accts] = await Promise.all([
      api.get<{ providers: ProviderInfo[] }>("/investments/providers").catch(() => ({ providers: [] })),
      api.get<{ connections: ConnectionInfo[] }>("/investments/connections").catch(() => ({ connections: [] })),
      api.get<{ accounts: AccountInfo[] }>("/investments/accounts").catch(() => ({ accounts: [] })),
    ]);
    setProviders(prov.providers);
    setConnections(conns.connections);
    setAccounts(accts.accounts);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setConnections([]);
      setAccounts([]);
      setLoading(true);
      return;
    }
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user?.id, refresh]);

  // Keep the guided journey consistent with reality: a live connection means
  // "brokerage connected" even if the flag predates the multi-broker schema.
  useEffect(() => {
    if (ready && connections.length > 0 && !state.brokerageConnected) {
      update({ brokerageConnected: true });
    }
  }, [ready, connections.length, state.brokerageConnected, update]);

  const providerName = useCallback(
    (id: string) => providers.find((p) => p.id === id)?.name ?? id,
    [providers]
  );

  const value = useMemo(
    () => ({ providers, connections, accounts, loading, scope, setScope, refresh, providerName }),
    [providers, connections, accounts, loading, scope, setScope, refresh, providerName]
  );

  return <InvestmentContext.Provider value={value}>{children}</InvestmentContext.Provider>;
}

export function useInvestments(): InvestmentApi {
  const ctx = useContext(InvestmentContext);
  if (!ctx) throw new Error("useInvestments must be used inside <InvestmentProvider>");
  return ctx;
}
