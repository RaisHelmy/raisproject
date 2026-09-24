import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useGuidance } from "../ux/GuidanceContext";
import { setupPercent } from "../ux/guidance";
import { PageHeader, NextActionCard, SetupProgress, FeatureTour, StatusBadge } from "../ux/components";
import { api } from "../lib/api";

interface RewardsPeek {
  stats: { points: number; rank: number; referrals: number };
  tier: { current: { name: string; icon: string }; progressPct: number };
}

export function Dashboard() {
  const { state } = useGuidance();
  const { user, devVerifyUrl, setDevVerifyUrl } = useAuth();
  const [resent, setResent] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardsPeek | null>(null);

  // Loading rewards here also evaluates achievements, so unlocks land the
  // moment the user returns to the dashboard.
  useEffect(() => {
    api.get<RewardsPeek>("/affiliate").then(setRewards).catch(() => {});
  }, []);
  const pct = setupPercent(state);
  const firstName = (state.profileName || user?.name || "").split(" ")[0];

  const resendVerification = async () => {
    try {
      const res = await api.post<{ ok: boolean; devVerifyUrl?: string; error?: string }>(
        "/auth/resend-verification"
      );
      if (res.devVerifyUrl) setDevVerifyUrl(res.devVerifyUrl);
      setResent(res.ok ? "Verification email sent — check your inbox." : res.error ?? "Sending failed.");
    } catch (e) {
      setResent(e instanceof Error ? e.message : "Sending failed.");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={firstName ? `Assalamualaikum, ${firstName}` : "Dashboard"}
        description={
          pct < 100
            ? "Your workspace is taking shape. Follow the recommended step below — each one unlocks more of Rais Fintech."
            : "Everything is configured. Here's how your wealth is doing."
        }
      />

      {user && !user.email_verified && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <span aria-hidden>✉️</span>
          <span className="grow">
            <strong>Verify your email.</strong> We sent a link to {user.email}. Verifying keeps
            your account recoverable.{" "}
            {devVerifyUrl && (
              <>
                Email is in development mode — <a href={devVerifyUrl}>open your verification link</a>.
              </>
            )}
            {resent && <em style={{ display: "block", marginTop: 4 }}>{resent}</em>}
          </span>
          <button className="btn btn-sm btn-secondary" onClick={resendVerification}>
            Resend
          </button>
        </div>
      )}

      <NextActionCard />

      <div className="section-title">Wealth at a glance</div>
      <div className="card-grid">
        <div className="card">
          <div className="stat-label">Portfolio value</div>
          <div className="stat-value">{state.portfolioSynced ? "RM 248,530" : "—"}</div>
          <div className="stat-sub">
            {state.portfolioSynced ? (
              <StatusBadge tone="green">↑ 4.2% this month</StatusBadge>
            ) : (
              <Link to="/invest/portfolio">Connect a brokerage to see this</Link>
            )}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Connected accounts</div>
          <div className="stat-value">{state.brokerageConnected ? "1" : "0"}</div>
          <div className="stat-sub">
            {state.brokerageConnected ? "Moomoo · Malaysia" : <Link to="/connections">Set up a connection</Link>}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Family members</div>
          <div className="stat-value">{state.familyMembers.length || "—"}</div>
          <div className="stat-sub">
            {state.familyAdded ? "Roles assigned" : <Link to="/family">Add your family</Link>}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Rewards</div>
          <div className="stat-value">
            {rewards ? `${rewards.tier.current.icon} ${rewards.stats.points.toLocaleString()}` : "—"}
          </div>
          <div className="stat-sub">
            {rewards ? (
              <>
                {rewards.tier.current.name} · rank #{rewards.stats.rank} ·{" "}
                <Link to="/grow/affiliate">invite friends</Link>
              </>
            ) : (
              <Link to="/grow/affiliate">Start earning points</Link>
            )}
          </div>
        </div>
        <div className="card">
          <div className="stat-label">Legacy plan</div>
          <div className="stat-value">
            {state.legacyDone ? "Ready" : state.legacyStep >= 0 ? "In progress" : "—"}
          </div>
          <div className="stat-sub">
            {state.legacyDone ? (
              <StatusBadge tone="green">Complete</StatusBadge>
            ) : (
              <Link to="/family/legacy">{state.legacyStep >= 0 ? "Resume where you left off" : "Begin when ready"}</Link>
            )}
          </div>
        </div>
      </div>

      {pct < 100 && (
        <>
          <div className="section-title">Setup</div>
          <SetupProgress compact />
        </>
      )}

      <FeatureTour
        tourId="dashboard"
        steps={[
          {
            title: "Welcome to your dashboard",
            body: "This is home. It always shows where you are in your journey and the single most useful next step.",
          },
          {
            title: "Recommended next step",
            body: "The gold card at the top updates as you progress — connect a brokerage, add family, build your legacy plan. Follow it and you'll never wonder what to do next.",
          },
          {
            title: "Quick navigation",
            body: "Press ⌘K (or Ctrl+K) anywhere to jump to any page or action instantly.",
          },
        ]}
      />
    </>
  );
}
