import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge, EmptyState, FeatureTour } from "../ux/components";
import { SuggestionButton } from "../ux/components/SuggestionButton";
import { api } from "../lib/api";

export interface Theory {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  when_to_use: string | null;
  risk_notes: string | null;
  source: string | null;
  related_technique: string | null;
  published: number;
  updated_at: string;
}

export const CATEGORY_META: Record<string, { label: string; tone: "green" | "gold" | "red" | "blue" | "gray"; icon: string }> = {
  technical: { label: "Technical", tone: "blue", icon: "📈" },
  fundamental: { label: "Fundamental", tone: "gold", icon: "🏛️" },
  risk: { label: "Risk", tone: "red", icon: "🛡️" },
  islamic: { label: "Islamic", tone: "green", icon: "☪️" },
  behavioral: { label: "Behavioral", tone: "gray", icon: "🧠" },
  general: { label: "General", tone: "gray", icon: "📚" },
};

/** "Use this theory" — deep links from a theory into the live tools. */
function theoryActions(t: Theory, navigate: (to: string) => void) {
  const actions: { label: string; to: string }[] = [];
  if (t.related_technique) {
    actions.push({ label: "See live signals in Markets", to: "/invest/markets" });
    actions.push({ label: "Open the Strategy Library", to: "/invest/strategies" });
  }
  if (t.category === "islamic") {
    actions.push({ label: "Check Shariah flags in Markets", to: "/invest/markets" });
    actions.push({ label: "Review your dividends", to: "/invest/activity" });
  }
  if (t.category === "risk" || t.id === "t-dca") {
    actions.push({ label: "Configure Robo Trading", to: "/invest/robo" });
  }
  if (t.category === "behavioral") {
    actions.push({ label: "Automate with Robo Trading", to: "/invest/robo" });
  }
  if (actions.length === 0) actions.push({ label: "Explore Markets", to: "/invest/markets" });
  return actions.slice(0, 3).map((a) => (
    <button key={a.to + a.label} className="btn btn-sm btn-secondary" onClick={() => navigate(a.to)}>
      {a.label}
    </button>
  ));
}

export function TheoryGallery() {
  const navigate = useNavigate();
  const [theories, setTheories] = useState<Theory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ theories: Theory[] }>("/theories")
      .then((r) => setTheories(r.theories))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the gallery."));
  }, []);

  const cats = useMemo(
    () => (theories ? [...new Set(theories.map((t) => t.category))] : []),
    [theories]
  );
  const shown = useMemo(
    () => (theories ?? []).filter((t) => cat === "all" || t.category === cat),
    [theories, cat]
  );
  const open = shown.find((t) => t.id === openId) ?? null;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Investments", to: "/invest/portfolio" }, { label: "Theory Gallery" }]}
        eyebrow="Investments"
        title="Theory Gallery"
        description="The ideas behind good decisions — curated by your administrators. Read the theory, understand when it applies and what can go wrong, then act on it with the live tools."
        actions={<SuggestionButton context="theory-gallery" label="Suggest a theory" />}
      />

      {error && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <span aria-hidden>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {theories === null ? (
        <p className="muted">Loading the gallery…</p>
      ) : theories.length === 0 ? (
        <EmptyState
          icon="📚"
          title="The gallery is empty"
          body="Investment theories appear here once an administrator publishes them. Check back soon."
        />
      ) : (
        <>
          <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <button className={`btn btn-sm ${cat === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setCat("all")}>
              All
            </button>
            {cats.map((cId) => {
              const m = CATEGORY_META[cId] ?? CATEGORY_META.general;
              return (
                <button
                  key={cId}
                  className={`btn btn-sm ${cat === cId ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setCat(cId)}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}
            <span className="grow" />
            <span className="muted">{shown.length} theor{shown.length === 1 ? "y" : "ies"}</span>
          </div>

          {open ? (
            <div className="card theory-detail">
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div className="grow">
                  <StatusBadge tone={(CATEGORY_META[open.category] ?? CATEGORY_META.general).tone}>
                    {(CATEGORY_META[open.category] ?? CATEGORY_META.general).icon}{" "}
                    {(CATEGORY_META[open.category] ?? CATEGORY_META.general).label}
                  </StatusBadge>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, marginTop: 10 }}>{open.title}</h2>
                  <p className="muted" style={{ marginTop: 4 }}>{open.summary}</p>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => setOpenId(null)}>✕ Close</button>
              </div>

              <div className="td-section">
                <div className="td-label">The theory</div>
                <p style={{ maxWidth: 640 }}>{open.content}</p>
              </div>
              {open.when_to_use && (
                <div className="td-section">
                  <div className="td-label">When to use it</div>
                  <p style={{ maxWidth: 640 }}>{open.when_to_use}</p>
                </div>
              )}
              {open.risk_notes && (
                <div className="td-section">
                  <div className="td-label">What can go wrong</div>
                  <div className="alert alert-warn" style={{ maxWidth: 640 }}>
                    <span aria-hidden>⚠️</span>
                    <span>{open.risk_notes}</span>
                  </div>
                </div>
              )}
              <div className="td-section">
                <div className="td-label">Put it to work</div>
                <div className="row" style={{ flexWrap: "wrap" }}>{theoryActions(open, navigate)}</div>
              </div>
              {open.source && (
                <div className="td-section td-source">Source: {open.source}</div>
              )}
              <div className="alert alert-info" style={{ marginTop: 20 }}>
                <span aria-hidden>ⓘ</span>
                <span>Theories are educational context, not advice. The flow stays: information → recommendation → your decision.</span>
              </div>
            </div>
          ) : (
            <div className="theory-grid">
              {shown.map((t) => {
                const m = CATEGORY_META[t.category] ?? CATEGORY_META.general;
                return (
                  <button key={t.id} className="theory-card" onClick={() => setOpenId(t.id)}>
                    <span className="th-cat">
                      <StatusBadge tone={m.tone}>{m.icon} {m.label}</StatusBadge>
                    </span>
                    <span className="th-title">{t.title}</span>
                    <span className="th-summary">{t.summary}</span>
                    <span className="th-more">Read the theory →</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <FeatureTour
        tourId="theory-gallery"
        steps={[
          { title: "Why a theory gallery?", body: "Signals tell you what; theories tell you why. Each entry explains when an approach works and — just as important — how it fails." },
          { title: "From theory to action", body: "Every theory ends with 'Put it to work' links into the live tools: Markets signals, the Strategy Library, or Robo Trading." },
          { title: "Curated for you", body: "Your administrators maintain this library and add new theories over time." },
        ]}
      />
    </>
  );
}
