import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge, InfoTip } from "../ux/components";
import { SuggestionButton } from "../ux/components/SuggestionButton";
import { api } from "../lib/api";

interface Registry {
  techniques: {
    id: string;
    name: string;
    description: string;
    weight: number;
    methods: {
      id: string;
      name: string;
      description: string;
      algorithms: { id: string; name: string; description: string }[];
    }[];
  }[];
  decisionLibrary: {
    aggregators: { id: string; name: string; description: string }[];
    riskFilters: { id: string; name: string; description: string }[];
    positionSizing: { id: string; name: string; description: string }[];
  };
}

/**
 * The strategy library page shows exactly how robo decisions are made:
 * techniques → methods → algorithms, then the decision library that turns
 * many signals into one action. Nothing here is a black box.
 */
export function Strategies() {
  const navigate = useNavigate();
  const [reg, setReg] = useState<Registry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Registry>("/robo/registry")
      .then(setReg)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the registry."));
  }, []);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Investments", to: "/invest/portfolio" }, { label: "Strategies" }]}
        eyebrow="Investments"
        title="Strategy Library"
        description="How robo decisions are made. Each mechanical technique contains methods, each method contains concrete algorithms, and a decision library combines their signals into one action — always visible, never a black box."
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => navigate("/invest/markets")}>
              See Signals on Markets
            </button>
            <SuggestionButton context="strategy-library" label="Suggest a strategy" />
          </>
        }
      />

      {error && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <span aria-hidden>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!reg ? (
        <p className="muted">Loading the strategy library…</p>
      ) : (
        <>
          <div className="section-title">Mechanical techniques</div>
          {reg.techniques.map((t) => (
            <div className="card" key={t.id}>
              <div className="row">
                <div className="card-title" style={{ marginBottom: 0 }}>{t.name}</div>
                <StatusBadge tone="gold">{Math.round(t.weight * 100)}% weight</StatusBadge>
                <InfoTip>
                  This technique's share in the weighted-score aggregator that produces the
                  final signal.
                </InfoTip>
              </div>
              <p className="muted" style={{ marginTop: 4 }}>{t.description}</p>
              {t.methods.map((m) => (
                <div key={m.id} style={{ marginTop: 16, paddingLeft: 14, borderLeft: "2px solid var(--line)" }}>
                  <strong>{m.name}</strong>
                  <span className="muted"> — {m.description}</span>
                  <div className="mt-16" style={{ display: "grid", gap: 8 }}>
                    {m.algorithms.map((a) => (
                      <div key={a.id} className="row" style={{ alignItems: "flex-start" }}>
                        <StatusBadge tone="blue">{a.id}</StatusBadge>
                        <span>
                          <strong>{a.name}</strong>
                          <span className="muted"> · {a.description}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="section-title">Decision-making library</div>
          <div className="card-grid">
            {(
              [
                ["Aggregators", "How many signals become one decision", reg.decisionLibrary.aggregators],
                ["Risk filters", "When a decision gets overruled", reg.decisionLibrary.riskFilters],
                ["Position sizing", "How much capital a decision commits", reg.decisionLibrary.positionSizing],
              ] as const
            ).map(([title, sub, items]) => (
              <div className="card" key={title}>
                <div className="card-title">{title}</div>
                <p className="muted">{sub}</p>
                <div className="mt-16" style={{ display: "grid", gap: 10 }}>
                  {items.map((x) => (
                    <p key={x.id} style={{ fontSize: 13 }}>
                      <strong>{x.name}</strong>
                      <span className="muted"> — {x.description}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="alert alert-info mt-24">
            <span aria-hidden>ⓘ</span>
            <span>
              Signals are information, not advice. The flow is always: information →
              recommendation → your decision → (for live trading) explicit confirmation.
            </span>
          </div>
        </>
      )}
    </>
  );
}
