import { useInvestments, type InvestScope } from "../../InvestmentContext";

/**
 * Global account scope selector — shown on every investment page. The
 * selection (all / one provider / one account) persists across Portfolio,
 * Holdings, Activity and Performance so the user never re-picks a broker.
 */
export function AccountSelector() {
  const { accounts, providers, connections, scope, setScope, providerName } = useInvestments();
  if (connections.length === 0) return null;

  const encode = (s: InvestScope) =>
    s.type === "all" ? "all" : `${s.type}:${s.id}`;
  const decode = (v: string): InvestScope => {
    if (v === "all") return { type: "all" };
    const [type, id] = v.split(":");
    return type === "provider" ? { type: "provider", id } : { type: "account", id };
  };

  const connectedProviders = providers.filter((p) =>
    connections.some((c) => c.provider_id === p.id)
  );

  return (
    <label className="row" style={{ gap: 8 }}>
      <span className="stat-label" style={{ whiteSpace: "nowrap" }}>Account</span>
      <select
        value={encode(scope)}
        onChange={(e) => setScope(decode(e.target.value))}
        aria-label="Investment account scope"
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--line)",
          fontFamily: "inherit",
          fontSize: 13.5,
          background: "var(--paper-raised)",
          maxWidth: 280,
        }}
      >
        <option value="all">All Accounts</option>
        {connectedProviders.map((p) => (
          <optgroup key={p.id} label={p.name}>
            <option value={`provider:${p.id}`}>All {p.name} accounts</option>
            {accounts
              .filter((a) => a.provider_id === p.id)
              .map((a) => (
                <option key={a.id} value={`account:${a.id}`}>
                  {a.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {scope.type !== "all" && (
        <button className="btn btn-sm btn-ghost" onClick={() => setScope({ type: "all" })}>
          Clear
        </button>
      )}
    </label>
  );
}
