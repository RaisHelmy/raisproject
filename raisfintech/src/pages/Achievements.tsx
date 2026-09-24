import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge, ErrorState } from "../ux/components";
import { api } from "../lib/api";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: "journey" | "growth" | "affiliate";
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { current: number; target: number };
}

interface AchievementsData {
  points: number;
  tier: { current: { name: string; icon: string }; next: { name: string; icon: string; min: number } | null; progressPct: number };
  newlyUnlocked: string[];
  achievements: Achievement[];
}

const CATEGORIES: { id: Achievement["category"]; title: string; sub: string }[] = [
  { id: "journey", title: "Journey", sub: "Milestones on your path through Rais Fintech" },
  { id: "growth", title: "Transaction Growth", sub: "Earned by trading and analyzing through the investment queue" },
  { id: "affiliate", title: "Affiliate", sub: "Earned by growing the community" },
];

export function Achievements() {
  const navigate = useNavigate();
  const [data, setData] = useState<AchievementsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .get<AchievementsData>("/achievements")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load achievements."));
  };
  useEffect(load, []);

  /** The single most actionable locked achievement: closest to completion. */
  const nextUp = useMemo(() => {
    if (!data) return null;
    const locked = data.achievements.filter((a) => !a.unlocked);
    if (locked.length === 0) return null;
    return locked.sort(
      (a, b) => b.progress.current / b.progress.target - a.progress.current / a.progress.target
    )[0];
  }, [data]);

  const unlockedCount = data?.achievements.filter((a) => a.unlocked).length ?? 0;

  if (error) {
    return (
      <div className="card">
        <ErrorState
          title="Unable to load achievements"
          dataSafety="Your unlocked achievements and points are safe — this is a loading problem."
          reason={error}
          actions={<button className="btn btn-primary" onClick={load}>Try Again</button>}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Grow", to: "/grow/affiliate" }, { label: "Achievements" }]}
        eyebrow="Grow"
        title="Achievements"
        description={
          data
            ? `${unlockedCount} of ${data.achievements.length} unlocked · ${data.points.toLocaleString()} points earned. Every achievement is a concrete action — nothing here depends on luck.`
            : "Every achievement is a concrete action — nothing here depends on luck."
        }
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/grow/affiliate")}>
            Back to Affiliate
          </button>
        }
      />

      {!data ? (
        <p className="muted">Loading achievements…</p>
      ) : (
        <>
          {data.newlyUnlocked.length > 0 && (
            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              <span aria-hidden>🎉</span>
              <span>
                <strong>Just unlocked:</strong>{" "}
                {data.newlyUnlocked
                  .map((id) => data.achievements.find((a) => a.id === id)?.name ?? id)
                  .join(", ")}{" "}
                — points added to your total.
              </span>
            </div>
          )}

          {nextUp && (
            <div className="next-action" style={{ marginBottom: 24 }}>
              <div className="na-icon" aria-hidden>{nextUp.icon}</div>
              <div>
                <div className="na-kicker">Closest achievement</div>
                <div className="na-title">
                  {nextUp.name} · +{nextUp.points} points
                </div>
                <p className="na-body">
                  {nextUp.description}
                  {nextUp.progress.target > 1 &&
                    ` You're at ${nextUp.progress.current} of ${nextUp.progress.target}.`}
                </p>
              </div>
            </div>
          )}

          {CATEGORIES.map((cat) => {
            const items = data.achievements.filter((a) => a.category === cat.id);
            const done = items.filter((a) => a.unlocked).length;
            return (
              <section key={cat.id}>
                <div className="section-title">
                  {cat.title} · {done}/{items.length}
                </div>
                <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>{cat.sub}</p>
                <div className="ach-grid">
                  {items.map((a) => {
                    const fresh = data.newlyUnlocked.includes(a.id);
                    const pct = Math.round((a.progress.current / a.progress.target) * 100);
                    return (
                      <div key={a.id} className={`ach-card ${a.unlocked ? "" : "locked"} ${fresh ? "fresh" : ""}`}>
                        {fresh && (
                          <span className="ach-new">
                            <StatusBadge tone="gold">NEW</StatusBadge>
                          </span>
                        )}
                        <div className="ach-icon" aria-hidden>{a.icon}</div>
                        <div className="ach-name">{a.name}</div>
                        <div className="ach-desc">{a.description}</div>
                        {!a.unlocked && a.progress.target > 1 && (
                          <div className="ach-progress">
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="apl">
                              {a.progress.current} / {a.progress.target}
                            </div>
                          </div>
                        )}
                        <div className="ach-meta">
                          <span className="ach-points">+{a.points} pts</span>
                          {a.unlocked ? (
                            <StatusBadge tone="green">✓ {a.unlockedAt?.slice(0, 10)}</StatusBadge>
                          ) : (
                            <StatusBadge tone="gray">Locked</StatusBadge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
