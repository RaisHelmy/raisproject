import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge, InfoTip, ErrorState, FeatureTour } from "../ux/components";
import { SuggestionButton } from "../ux/components/SuggestionButton";
import { api } from "../lib/api";

/* Shapes returned by /api/instruments (see worker/quant.ts) */
export interface Analysis {
  symbol: string;
  name: string;
  type: string;
  market: string;
  sector: string;
  flags: {
    shariah: { status: "compliant" | "non-compliant" | "review"; reason: string };
    risk: "low" | "medium" | "high";
    volatilityPct: number;
    maxDrawdownPct: number;
  };
  history: { latest: number; r1m: number; r3m: number; r1y: number; sparkline: number[] };
  techniques: {
    id: string;
    name: string;
    weight: number;
    score: number;
    action: string;
    methods: {
      id: string;
      name: string;
      algorithms: { id: string; name: string; action: string; score: number; detail: string }[];
    }[];
  }[];
  decision: {
    action: "buy" | "sell" | "hold";
    confidence: number;
    aggregator: string;
    votes: { buy: number; sell: number; hold: number };
    riskFilters: { id: string; name: string; triggered: boolean; note: string }[];
    sizing: { id: string; name: string; fractionPct: number }[];
  };
}

export function ShariahBadge({ status }: { status: Analysis["flags"]["shariah"]["status"] }) {
  if (status === "compliant") return <StatusBadge tone="green">☪ Compliant</StatusBadge>;
  if (status === "non-compliant") return <StatusBadge tone="red">Non-compliant</StatusBadge>;
  return <StatusBadge tone="gold">Needs review</StatusBadge>;
}

export function RiskBadge({ risk }: { risk: Analysis["flags"]["risk"] }) {
  const tone = risk === "low" ? "green" : risk === "medium" ? "gold" : "red";
  return <StatusBadge tone={tone}>{risk} risk</StatusBadge>;
}

export function SignalBadge({ action, confidence }: { action: string; confidence?: number }) {
  const tone = action === "buy" ? "green" : action === "sell" ? "red" : "gray";
  return (
    <StatusBadge tone={tone}>
      {action.toUpperCase()}
      {confidence !== undefined ? ` · ${Math.round(confidence * 100)}%` : ""}
    </StatusBadge>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 140;
  const h = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => `${((i / (points.length - 1)) * w).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={w} height={h} aria-hidden style={{ display: "block" }}>
      <polyline points={path} fill="none" stroke={up ? "var(--green-700)" : "var(--red-700)"} strokeWidth="1.5" />
    </svg>
  );
}

const Ret = ({ v }: { v: number }) => (
  <span style={{ color: v >= 0 ? "var(--green-700)" : "var(--red-700)", fontVariantNumeric: "tabular-nums" }}>
    {v >= 0 ? "+" : ""}
    {v.toFixed(1)}%
  </span>
);

export function Markets() {
  const navigate = useNavigate();
  const [data, setData] = useState<Analysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shariahOnly, setShariahOnly] = useState(false);
  const [riskFilter, setRiskFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<{ instruments: Analysis[] }>("/instruments")
      .then((r) => setData(r.instruments))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load instruments."));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(
      (a) =>
        (!shariahOnly || a.flags.shariah.status === "compliant") &&
        (riskFilter === "all" || a.flags.risk === riskFilter)
    );
  }, [data, shariahOnly, riskFilter]);

  const queueScan = async () => {
    try {
      await api.post("/robo/analyze", {});
      setQueued("Full-universe analysis queued — every algorithm will run on every instrument. Track it in the Investment Queue.");
    } catch (e) {
      setQueued(e instanceof Error ? e.message : "Could not queue the analysis.");
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Investments", to: "/invest/portfolio" }, { label: "Markets" }]}
        eyebrow="Investments"
        title="Markets"
        description="Every instrument in the universe, screened and analyzed: Shariah compliance, risk rating, past performance, and a signal from the full algorithm library."
        actions={
          <>
            <button className="btn btn-primary" onClick={queueScan}>Queue Full Analysis</button>
            <button className="btn btn-secondary" onClick={() => navigate("/invest/queue")}>View Queue</button>
            <SuggestionButton context="markets-universe" label="Suggest an instrument" />
          </>
        }
      />

      {queued && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <span aria-hidden>⏳</span>
          <span>{queued}</span>
        </div>
      )}

      <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className={`btn btn-sm ${shariahOnly ? "btn-gold" : "btn-secondary"}`}
          onClick={() => setShariahOnly(!shariahOnly)}
        >
          ☪ Shariah-compliant only
        </button>
        {(["all", "low", "medium", "high"] as const).map((r) => (
          <button
            key={r}
            className={`btn btn-sm ${riskFilter === r ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setRiskFilter(r)}
          >
            {r === "all" ? "All risk" : `${r} risk`}
          </button>
        ))}
        <span className="grow" />
        <span className="muted">{filtered.length} instrument{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {error ? (
        <div className="card">
          <ErrorState
            title="Unable to load the market universe"
            dataSafety="Nothing was changed — this is a loading problem."
            reason={error}
            actions={<button className="btn btn-primary" onClick={load}>Try Again</button>}
          />
        </div>
      ) : data === null ? (
        <p className="muted">Running the algorithm library over the universe…</p>
      ) : (
        <div className="card" style={{ padding: "10px 12px" }}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Shariah</th>
                  <th>Risk</th>
                  <th className="num">Price</th>
                  <th className="num">1M</th>
                  <th className="num">1Y</th>
                  <th>Signal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <FragmentRow
                    key={a.symbol}
                    a={a}
                    open={open === a.symbol}
                    onToggle={() => setOpen(open === a.symbol ? null : a.symbol)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FeatureTour
        tourId="markets"
        steps={[
          { title: "Screened universe", body: "Every share, ETF and REIT is flagged: Shariah compliance, risk level, and past performance." },
          { title: "The signal column", body: "BUY / HOLD / SELL comes from the full algorithm library — trend, mean reversion and momentum — combined by a weighted score with risk filters on top." },
          { title: "See the reasoning", body: "Open “Breakdown” on any row to see what every technique, method and algorithm concluded, and why." },
        ]}
      />
    </>
  );
}

function FragmentRow({ a, open, onToggle }: { a: Analysis; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr>
        <td>
          <strong>{a.symbol}</strong>
          <div className="muted">{a.name} · {a.market} {a.type.toUpperCase()}</div>
        </td>
        <td>
          <ShariahBadge status={a.flags.shariah.status} />{" "}
          <InfoTip>{a.flags.shariah.reason}</InfoTip>
        </td>
        <td>
          <RiskBadge risk={a.flags.risk} />{" "}
          <InfoTip>
            Annualized volatility {a.flags.volatilityPct}%, max drawdown {a.flags.maxDrawdownPct}%
            over the analysis window.
          </InfoTip>
        </td>
        <td className="num">{a.history.latest.toLocaleString()}</td>
        <td className="num"><Ret v={a.history.r1m} /></td>
        <td className="num"><Ret v={a.history.r1y} /></td>
        <td><SignalBadge action={a.decision.action} confidence={a.decision.confidence} /></td>
        <td style={{ textAlign: "right" }}>
          <button className="btn btn-sm btn-ghost" onClick={onToggle}>
            {open ? "Close" : "Breakdown"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} style={{ background: "var(--paper-sunken)", padding: "18px 16px" }}>
            <AnalysisBreakdown a={a} />
          </td>
        </tr>
      )}
    </>
  );
}

export function AnalysisBreakdown({ a }: { a: Analysis }) {
  return (
    <div>
      <div className="row" style={{ flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div>
          <div className="stat-label">Past performance</div>
          <Sparkline points={a.history.sparkline} />
          <p className="muted" style={{ marginTop: 6 }}>
            1M <Ret v={a.history.r1m} /> · 3M <Ret v={a.history.r3m} /> · 1Y <Ret v={a.history.r1y} />
          </p>
        </div>
        <div>
          <div className="stat-label">Votes across all algorithms</div>
          <p style={{ marginTop: 6 }}>
            <StatusBadge tone="green">{a.decision.votes.buy} buy</StatusBadge>{" "}
            <StatusBadge tone="gray">{a.decision.votes.hold} hold</StatusBadge>{" "}
            <StatusBadge tone="red">{a.decision.votes.sell} sell</StatusBadge>
          </p>
          <p className="muted" style={{ marginTop: 6 }}>
            Aggregator: weighted score · confidence {Math.round(a.decision.confidence * 100)}%
          </p>
        </div>
        <div>
          <div className="stat-label">Risk filters</div>
          {a.decision.riskFilters.map((f) => (
            <p key={f.id} style={{ marginTop: 6, fontSize: 13 }}>
              {f.triggered ? "⛔" : "✓"} <strong>{f.name}</strong>
              <span className="muted"> — {f.note}</span>
            </p>
          ))}
        </div>
        <div>
          <div className="stat-label">Position sizing</div>
          {a.decision.sizing.map((s) => (
            <p key={s.id} style={{ marginTop: 6, fontSize: 13 }}>
              <strong>{s.name}:</strong> {s.fractionPct}% of capital
            </p>
          ))}
        </div>
      </div>

      <div className="stat-label" style={{ marginTop: 18 }}>Technique → method → algorithm</div>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="data" style={{ background: "var(--paper-raised)", borderRadius: 8 }}>
          <thead>
            <tr>
              <th>Technique</th>
              <th>Method</th>
              <th>Algorithm</th>
              <th>Signal</th>
              <th>Reading</th>
            </tr>
          </thead>
          <tbody>
            {a.techniques.flatMap((t) =>
              t.methods.flatMap((m) =>
                m.algorithms.map((alg, i) => (
                  <tr key={alg.id}>
                    <td>{i === 0 && m.id === t.methods[0].id ? <strong>{t.name}</strong> : ""}</td>
                    <td>{i === 0 ? m.name : ""}</td>
                    <td>{alg.name}</td>
                    <td><SignalBadge action={alg.action} /></td>
                    <td className="muted">{alg.detail}</td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
