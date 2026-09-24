import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { GuidanceProvider, useGuidance } from "./ux/GuidanceContext";
import { AppShell } from "./ux/components";
import { LoginPage, SignupPage, VerifyEmailPage } from "./pages/auth/AuthPages";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { Portfolio } from "./pages/Portfolio";
import { RoboTrading } from "./pages/RoboTrading";
import { Connections, ProviderWizard } from "./pages/Connections";
import { Holdings } from "./pages/Holdings";
import { InvestActivity } from "./pages/InvestActivity";
import { InvestmentProvider } from "./InvestmentContext";
import { TheoryGallery } from "./pages/TheoryGallery";
import { Family } from "./pages/Family";
import { LegacyWizard } from "./pages/LegacyWizard";
import { Documents } from "./pages/Documents";
import { Zakat } from "./pages/Zakat";
import { AdminPage } from "./pages/Admin";
import { SetupPage, SecurityPage, SettingsPage } from "./pages/System";
import { Markets } from "./pages/Markets";
import { Strategies } from "./pages/Strategies";
import { Queue } from "./pages/Queue";
import { Affiliate } from "./pages/Affiliate";
import { Achievements } from "./pages/Achievements";
import { GuidedStub } from "./pages/GuidedStub";

function CenteredNote({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p className="muted">{children}</p>
    </div>
  );
}

/** Requires a signed-in user; sends new users through onboarding first. */
function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { state, ready } = useGuidance();
  const location = useLocation();

  if (loading) return <CenteredNote>Opening your workspace…</CenteredNote>;
  if (!user) return <Navigate to="/login" replace />;
  if (!ready) return <CenteredNote>Loading your journey…</CenteredNote>;
  if (!state.onboarded && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />

      {/* Onboarding (signed in, outside the shell) */}
      <Route
        path="/welcome"
        element={
          <Protected>
            <Onboarding />
          </Protected>
        }
      />

      {/* Main application */}
      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />

        {/* Money */}
        <Route
          path="/money/wealth"
          element={
            <GuidedStub
              crumbs={[{ label: "Money", to: "/money/wealth" }, { label: "Wealth" }]}
              eyebrow="Money"
              title="Wealth Overview"
              description="Your net worth across every connected account, in one picture."
              icon="💠"
              emptyTitle="Your wealth picture is being assembled"
              emptyBody="Wealth combines your connected accounts, portfolio and recorded assets. Connect a brokerage to see it take shape."
              steps={["Connect your accounts", "Sync your portfolio", "Record other assets"]}
              ctaLabel="Go to Connections"
              ctaRoute="/connections"
            />
          }
        />
        <Route
          path="/money/cashflow"
          element={
            <GuidedStub
              crumbs={[{ label: "Money", to: "/money/wealth" }, { label: "Cash Flow" }]}
              eyebrow="Money"
              title="Cash Flow"
              description="Track what comes in and what goes out."
              icon="💸"
              emptyTitle="Cash flow arrives with bank connections"
              emptyBody="Bank account connections are on the roadmap. Once available, income and spending will appear here automatically."
            />
          }
        />
        <Route
          path="/money/goals"
          element={
            <GuidedStub
              crumbs={[{ label: "Money", to: "/money/wealth" }, { label: "Goals" }]}
              eyebrow="Money"
              title="Financial Goals"
              description="Set targets and track progress toward them."
              icon="🎯"
              emptyTitle="No goals yet"
              emptyBody="Goals link your wealth to what it's for — a home, education, umrah. Goal creation opens after your portfolio is synced."
              ctaLabel="Sync Portfolio First"
              ctaRoute="/invest/portfolio"
            />
          }
        />

        {/* Invest */}
        <Route path="/invest/portfolio" element={<Portfolio />} />
        <Route path="/invest/holdings" element={<Holdings />} />
        <Route path="/invest/activity" element={<InvestActivity />} />
        <Route path="/invest/markets" element={<Markets />} />
        <Route path="/invest/robo" element={<RoboTrading />} />
        <Route path="/invest/strategies" element={<Strategies />} />
        <Route path="/invest/theories" element={<TheoryGallery />} />
        <Route path="/invest/queue" element={<Queue />} />

        {/* Islamic Wealth */}
        <Route path="/islamic/zakat" element={<Zakat />} />
        <Route
          path="/islamic/shariah"
          element={
            <GuidedStub
              crumbs={[{ label: "Islamic Wealth", to: "/islamic/zakat" }, { label: "Shariah" }]}
              eyebrow="Islamic Wealth"
              title="Shariah Screening"
              description="See which of your holdings are Shariah-compliant."
              icon="☪️"
              emptyTitle="Screening needs your portfolio"
              emptyBody="Once your portfolio is synced, each holding is screened against Shariah criteria and labelled here."
              steps={["Connect your brokerage", "Sync your portfolio", "Review the screening results"]}
              ctaLabel="Go to Portfolio"
              ctaRoute="/invest/portfolio"
            />
          }
        />
        <Route
          path="/islamic/estate"
          element={
            <GuidedStub
              crumbs={[{ label: "Islamic Wealth", to: "/islamic/zakat" }, { label: "Estate Planning" }]}
              eyebrow="Islamic Wealth"
              title="Islamic Estate Planning"
              description="Wasiat, hibah and faraid information, organized for your family and advisors."
              icon="📜"
              emptyTitle="Estate planning lives in your Legacy Plan"
              emptyBody="The legacy plan walks you through wasiat, hibah and faraid step by step, with clear explanations along the way."
              ctaLabel="Open Legacy Plan"
              ctaRoute="/family/legacy"
            />
          }
        />

        {/* Family */}
        <Route path="/family" element={<Family />} />
        <Route path="/family/legacy" element={<LegacyWizard />} />
        <Route path="/family/documents" element={<Documents />} />

        {/* Analytics */}
        <Route
          path="/analytics/performance"
          element={
            <GuidedStub
              crumbs={[{ label: "Analytics", to: "/analytics/performance" }, { label: "Performance" }]}
              eyebrow="Analytics"
              title="Performance"
              description="How your investments have performed over time."
              icon="📈"
              emptyTitle="Performance history builds after your first sync"
              emptyBody="Each portfolio sync adds a data point. Charts appear after a few days of history."
              ctaLabel="Sync Portfolio"
              ctaRoute="/invest/portfolio"
            />
          }
        />
        <Route
          path="/analytics/risk"
          element={
            <GuidedStub
              crumbs={[{ label: "Analytics", to: "/analytics/performance" }, { label: "Risk" }]}
              eyebrow="Analytics"
              title="Risk"
              description="Understand the concentration and volatility in your portfolio."
              icon="🧮"
              emptyTitle="Risk analysis needs your holdings"
              emptyBody="Once your portfolio is synced, we analyze concentration, sector exposure and drawdown risk here."
              ctaLabel="Go to Portfolio"
              ctaRoute="/invest/portfolio"
            />
          }
        />

        {/* Automation */}
        <Route
          path="/automation/rules"
          element={
            <GuidedStub
              crumbs={[{ label: "Automation", to: "/automation/rules" }, { label: "Rules" }]}
              eyebrow="Automation"
              title="Rules"
              description="Automate routine actions with simple if-this-then-that rules."
              icon="⚙️"
              emptyTitle="No rules yet"
              emptyBody="Rules act on your synced data — for example, alert me when a holding falls 10%. Create your first rule from a template."
              steps={["Pick a template", "Set the threshold", "Choose how to be notified"]}
            />
          }
        />
        <Route
          path="/automation/alerts"
          element={
            <GuidedStub
              crumbs={[{ label: "Automation", to: "/automation/rules" }, { label: "Alerts" }]}
              eyebrow="Automation"
              title="Alerts"
              description="Everything Rais Fintech has notified you about."
              icon="🔔"
              emptyTitle="No alerts yet"
              emptyBody="When a rule fires or something needs your attention, it appears here — quiet by default."
            />
          }
        />

        {/* Grow */}
        <Route path="/grow/affiliate" element={<Affiliate />} />
        <Route path="/grow/achievements" element={<Achievements />} />

        {/* Connections — /connections/moomoo keeps working via :provider */}
        <Route path="/connections" element={<Connections />} />
        <Route path="/connections/:provider" element={<ProviderWizard />} />

        {/* System */}
        <Route path="/system/setup" element={<SetupPage />} />
        <Route path="/system/security" element={<SecurityPage />} />
        <Route path="/system/settings" element={<SettingsPage />} />
        <Route
          path="/system/admin"
          element={
            <AdminOnly>
              <AdminPage />
            </AdminOnly>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GuidanceProvider>
          <InvestmentProvider>
            <AppRoutes />
          </InvestmentProvider>
        </GuidanceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
