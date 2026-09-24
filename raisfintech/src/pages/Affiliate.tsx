import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge, InfoTip, FeatureTour, ErrorState } from "../ux/components";
import { api } from "../lib/api";

interface TierInfo { id: string; name: string; icon: string; min: number }

interface AffiliateData {
  code: string;
  shareUrl: string;
  stats: { points: number; rank: number; referrals: number };
  tier: { current: TierInfo; next: TierInfo | null; progressPct: number; pointsToNext: number; all: TierInfo[] };
  referrals: { name: string; verified: boolean; joined: string }[];
  leaderboard: { rank: number; name: string; points: number; referrals: number; you: boolean }[];
  ledger: { points: number; reason: string; created_at: string }[];
  newlyUnlocked: string[];
}

const REASON_LABELS: Record<string, string> = {
  "referral-joined": "A friend joined through your link",
  "welcome-referred": "Welcome bonus — you joined through a friend",
  "suggestion-approved": "Your suggestion was approved",
};

function reasonLabel(reason: string): string {
  if (reason.startsWith("achievement:")) {
    return `Achievement unlocked — ${reason.slice("achievement:".length).replace(/-/g, " ")}`;
  }
  return REASON_LABELS[reason] ?? reason;
}

export function Affiliate() {
  const navigate = useNavigate();
  const [data, setData] = useState<AffiliateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setError(null);
    api
      .get<AffiliateData>("/affiliate")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your affiliate data."));
  };
  useEffect(load, []);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable */
    }
  };

  const shareMessage = data
    ? encodeURIComponent(
        `I'm using Rais Fintech to manage my wealth and plan my family's future. Join me and we both earn rewards: ${data.shareUrl}`
      )
    : "";

  if (error) {
    return (
      <div className="card">
        <ErrorState
          title="Unable to load your affiliate workspace"
          dataSafety="Your points and referrals are safe — this is a loading problem."
          reason={error}
          actions={<button className="btn btn-primary" onClick={load}>Try Again</button>}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Grow", to: "/grow/affiliate" }, { label: "Affiliate" }]}
        eyebrow="Grow"
        title="Share Rais Fintech"
        description="Invite the people you care about. Every friend who joins earns you both rewards — and their family gets the same protection yours has."
        actions={
          <button className="btn btn-secondary" onClick={() => navigate("/grow/achievements")}>
            View Achievements
          </button>
        }
      />

      {!data ? (
        <p className="muted">Loading your affiliate workspace…</p>
      ) : (
        <>
          {/* Tier hero */}
          <div className="tier-hero">
            <div className="th-emblem" aria-hidden>{data.tier.current.icon}</div>
            <div className="grow">
              <div className="th-kicker">Your tier</div>
              <div className="th-title">{data.tier.current.name}</div>
              <div className="th-sub">
                {data.tier.next
                  ? `${data.tier.pointsToNext.toLocaleString()} points to ${data.tier.next.name} ${data.tier.next.icon}`
                  : "Highest tier reached — thank you for growing the community."}
              </div>
              <div className="progress-track" role="progressbar" aria-valuenow={data.tier.progressPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${data.tier.progressPct}%` }} />
              </div>
              <div className="tier-track" aria-hidden>
                {data.tier.all.map((t) => (
                  <div key={t.id} className={`tt-step ${data.stats.points >= t.min ? "reached" : ""}`}>
                    {t.icon} {t.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="th-stats">
              <div className="th-stat">
                <div className="v">{data.stats.points.toLocaleString()}</div>
                <div className="l">Points</div>
              </div>
              <div className="th-stat">
                <div className="v">#{data.stats.rank}</div>
                <div className="l">Rank</div>
              </div>
              <div className="th-stat">
                <div className="v">{data.stats.referrals}</div>
                <div className="l">Referrals</div>
              </div>
            </div>
          </div>

          {/* Share card */}
          <div className="card mt-16">
            <div className="card-title">
              Your invitation link{" "}
              <InfoTip>
                Anyone who signs up through this link is counted as your referral. You earn 200
                points per friend; they start with a 100-point welcome bonus.
              </InfoTip>
            </div>
            <div className="copy-field mt-16">
              <input readOnly value={data.shareUrl} onFocus={(e) => e.target.select()} aria-label="Your referral link" />
              <button className="btn btn-gold" onClick={copy}>
                {copied ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
            <div className="share-row">
              <a className="btn btn-sm btn-secondary" href={`https://wa.me/?text=${shareMessage}`} target="_blank" rel="noreferrer">
                Share on WhatsApp
              </a>
              <a className="btn btn-sm btn-secondary" href={`https://t.me/share/url?url=${encodeURIComponent(data.shareUrl)}&text=${shareMessage}`} target="_blank" rel="noreferrer">
                Share on Telegram
              </a>
              <a className="btn btn-sm btn-secondary" href={`mailto:?subject=${encodeURIComponent("Join me on Rais Fintech")}&body=${shareMessage}`}>
                Share by Email
              </a>
              <span className="muted" style={{ alignSelf: "center" }}>Code: <strong>{data.code}</strong></span>
            </div>
          </div>

          {/* How it works */}
          <div className="card">
            <div className="card-title">How it works</div>
            <div className="how-steps mt-16">
              <div className="hs">
                <div className="n">1</div>
                <strong>Share your link</strong>
                <p className="muted">Send it to family and friends who'd benefit from organized wealth and legacy planning.</p>
              </div>
              <div className="hs">
                <div className="n">2</div>
                <strong>They join free</strong>
                <p className="muted">They get a guided setup and a 100-point head start. You earn 200 points each.</p>
              </div>
              <div className="hs">
                <div className="n">3</div>
                <strong>Grow together</strong>
                <p className="muted">Referrals, transactions and milestones unlock achievements and raise your tier and rank.</p>
              </div>
            </div>
          </div>

          <div className="two-col mt-16" style={{ gap: 16 }}>
            {/* Leaderboard */}
            <div className="card" style={{ marginTop: 0 }}>
              <div className="card-title">
                Leaderboard{" "}
                <InfoTip>Ranked by total points across the community. Names are shown abbreviated for privacy.</InfoTip>
              </div>
              <div className="table-wrap mt-16">
                <table className="data">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Member</th>
                      <th className="num">Referrals</th>
                      <th className="num">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((row) => (
                      <tr key={row.rank} className={row.you ? "lb-row-you" : undefined}>
                        <td className="lb-rank">
                          {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
                        </td>
                        <td>
                          <strong>{row.name}</strong> {row.you && <StatusBadge tone="gold">You</StatusBadge>}
                        </td>
                        <td className="num">{row.referrals}</td>
                        <td className="num">{row.points.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent points */}
            <div className="card" style={{ marginTop: 0 }}>
              <div className="card-title">Recent rewards</div>
              {data.ledger.length === 0 ? (
                <p className="muted mt-16">
                  No points yet — complete your setup or invite a friend to start earning.
                </p>
              ) : (
                <div className="mt-16">
                  {data.ledger.map((l, i) => (
                    <div className="check-row ok" key={i}>
                      <span className="cr-state">+{l.points}</span>
                      <span style={{ fontSize: 13 }}>{reasonLabel(l.reason)}</span>
                      <span className="cr-action muted">{l.created_at.slice(5, 10)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Referrals */}
          <div className="card">
            <div className="card-title">Your referrals</div>
            {data.referrals.length === 0 ? (
              <p className="muted mt-16">
                Nobody yet — your first referral unlocks <strong>✨ The Spark</strong> (+100 points).
                Copy your link above and send it to one person today.
              </p>
            ) : (
              <div className="table-wrap mt-16">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Status</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.map((r, i) => (
                      <tr key={i}>
                        <td><strong>{r.name}</strong></td>
                        <td>
                          {r.verified ? (
                            <StatusBadge tone="green">Verified</StatusBadge>
                          ) : (
                            <StatusBadge tone="gold">Pending verification</StatusBadge>
                          )}
                        </td>
                        <td className="muted">{r.joined.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <FeatureTour
        tourId="affiliate"
        steps={[
          { title: "Your tier", body: "Points from referrals, transactions and milestones move you from Bronze toward Diamond. The bar shows exactly how far to the next tier." },
          { title: "One link, shared rewards", body: "Copy your invitation link or share it directly. You earn 200 points per friend; they start with 100." },
          { title: "Climb the leaderboard", body: "The community ranking updates as you and your referrals grow. Achievements on the next page show your fastest paths to points." },
        ]}
      />
    </>
  );
}
