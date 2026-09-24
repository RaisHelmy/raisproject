import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./Shell";
import { RequireAuth } from "./RequireAuth";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { Landing } from "../features/landing/Landing";
import { AccountPage } from "../features/account/AccountPage";
import { BalancePage } from "../features/billing/BalancePage";
import { ConnectorsPage } from "../features/developer/ConnectorsPage";
import { WebhooksPage } from "../features/developer/WebhooksPage";
import { CredentialsPage } from "../features/developer/CredentialsPage";
import { AssetsPage } from "../features/assets/AssetsPage";
import { useBalance } from "../features/billing/useBalance";
import { QuickCreatePage } from "../features/generate/QuickCreatePage";
import { ProjectsPage, ProjectDetailPage } from "../features/projects/ProjectsPage";
import { TemplatesPage } from "../features/templates/TemplatesPage";
import { TemplateDetailPage } from "../features/templates/TemplateDetailPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { LibraryPage } from "../features/library/LibraryPage";
import { StudioPage } from "../features/studio/StudioPage";
import { PricingPage } from "../features/landing/PricingPage";
import { EmptyState } from "../components/EmptyState";
import { MenuPlaceholderPage } from "./header/MenuPlaceholderPage";
import { ExploreHome } from "../features/explore/ExploreHome";
import { HfStudio } from "../features/studio/HfStudio";
import { PlansPage } from "../features/pricing/PlansPage";
import { CommunityPage } from "../features/community/CommunityPage";
import { EditPage } from "../features/community/EditPage";
import { ViralPresetsPage } from "../features/pages/ViralPresetsPage";
import { McpPage } from "../features/pages/McpPage";
import { CanvasPage } from "../features/pages/CanvasPage";
import { EnterprisePage } from "../features/pages/EnterprisePage";
import { MarketingStudioPage } from "../features/pages/MarketingStudioPage";
import { SupercomputerPage } from "../features/pages/SupercomputerPage";
import { ToolStudioPage } from "../features/pages/ToolStudioPage";
import { IntroToolPage } from "../features/pages/IntroToolPage";
import { AppToolPage } from "../features/pages/AppToolPage";
import { JutsuPage } from "../features/pages/JutsuPage";
import { AcademyPage } from "../features/pages/AcademyPage";
import { OriginalsPage } from "../features/pages/OriginalsPage";
import { PluginsPage } from "../features/pages/PluginsPage";
import { ContestsPage } from "../features/pages/ContestsPage";
import { CinemaStudioPage } from "../features/pages/CinemaStudioPage";

// Highcharts and React Flow are large and rarely needed on a first visit, so
// they load only when their page is opened (§114).
const ComparePage = lazy(() => import("../features/models/ComparePage").then((m) => ({ default: m.ComparePage })));
const DeveloperDocsPage = lazy(() => import("../features/developer/DeveloperDocsPage").then((m) => ({ default: m.DeveloperDocsPage })));
const MoviesPage = lazy(() => import("../features/movies/MoviesPage").then((m) => ({ default: m.MoviesPage })));
const MoviePage = lazy(() => import("../features/movies/MoviePage").then((m) => ({ default: m.MoviePage })));
const AdminModelsPage = lazy(() => import("../features/admin/AdminModelsPage").then((m) => ({ default: m.AdminModelsPage })));
const UsagePage = lazy(() => import("../features/usage/UsagePage").then((m) => ({ default: m.UsagePage })));

function Loading() {
  return (
    <div className="d-flex justify-content-center py-5">
      <output className="spinner-border" aria-label="Loading" />
    </div>
  );
}

function Placeholder(props: { title: string }) {
  return (
    <section>
      <h1 className="h3 mb-3">{props.title}</h1>
      <EmptyState icon="hourglass-split" title={`${props.title} is coming in a later phase.`} />
    </section>
  );
}

function AuthedShell() {
  const { advancedMode, user } = useAuth();
  const { balance } = useBalance(Boolean(user));
  return <Shell advanced={advancedMode} admin={Boolean(user?.isAdmin)} balanceSen={balance?.availableSen ?? null} />;
}

export function App() {
  return (
    <Routes>
      {/* "/" is the Explore home for visitors and signed-in users alike; the old marketing landing lives on at /landing. */}
      <Route path="/" element={<ExploreHome />} />
      <Route path="/landing" element={<Landing />} />
      {/* Plans replica; the balance-based page that quotes live API prices stays at /pricing/live. */}
      <Route path="/pricing" element={<PlansPage />} />
      <Route path="/pricing/live" element={<PricingPage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/community/:tab" element={<CommunityPage />} />
      <Route path="/layers" element={<EditPage />} />
      <Route path="/viral-presets" element={<ViralPresetsPage />} />
      <Route path="/mcp" element={<McpPage />} />
      <Route path="/canvas" element={<CanvasPage />} />
      <Route path="/canvas/:id" element={<CanvasPage />} />
      <Route path="/3d-jutsu" element={<JutsuPage />} />
      <Route path="/academy" element={<AcademyPage />} />
      <Route path="/original-series" element={<OriginalsPage />} />
      <Route path="/plugins/:slug" element={<PluginsPage />} />
      <Route path="/plugins" element={<PluginsPage />} />
      <Route path="/contests" element={<ContestsPage />} />
      <Route path="/contests/:slug" element={<ContestsPage />} />
      <Route path="/generate" element={<CinemaStudioPage />} />
      <Route path="/enterprise" element={<EnterprisePage />} />
      <Route path="/marketing-studio" element={<MarketingStudioPage />} />
      <Route path="/supercomputer" element={<SupercomputerPage />} />
      <Route path="/lipsync-studio" element={<ToolStudioPage slug="lipsync-studio" />} />
      <Route path="/shorts-studio" element={<ToolStudioPage slug="shorts-studio" />} />
      <Route path="/explainer" element={<ToolStudioPage slug="explainer" />} />
      <Route path="/mixed-media" element={<ToolStudioPage slug="mixed-media" />} />
      <Route path="/faceless-studio" element={<ToolStudioPage slug="faceless-studio" />} />
      <Route path="/character" element={<IntroToolPage slug="character" />} />
      <Route path="/moodboard" element={<IntroToolPage slug="moodboard" />} />
      <Route path="/apps/:slug" element={<AppToolPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/create" element={<Navigate to="/" replace />} />
      <Route element={<RequireAuth />}> 
        <Route element={<AuthedShell />}> 
          {/* The studio replicas are UI only; the wired-up generation form stays at /create/<kind>/classic. */}
          <Route path="/create/image" element={<HfStudio kind="image" />} />
          <Route path="/create/video" element={<HfStudio kind="video" />} />
          <Route path="/create/audio" element={<HfStudio kind="audio" />} />
          <Route path="/create/image/classic" element={<QuickCreatePage category="image" />} />
          <Route path="/create/video/classic" element={<QuickCreatePage category="video" />} />
          <Route path="/create/audio/classic" element={<QuickCreatePage category="audio" />} />
          <Route path="/create/text" element={<QuickCreatePage category="text" />} />
          <Route path="/movies" element={<Suspense fallback={<Loading />}><MoviesPage /></Suspense>} />
          <Route path="/movies/:id" element={<Suspense fallback={<Loading />}><MoviePage /></Suspense>} />
          <Route path="/create/movie" element={<Navigate to="/movies" replace />} />
          <Route path="/create/compare" element={<Suspense fallback={<Loading />}><ComparePage /></Suspense>} />
          <Route path="/create/studio/:type" element={<StudioPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/create/*" element={<Placeholder title="Quick Create" />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/:id" element={<TemplateDetailPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/usage" element={<Suspense fallback={<Loading />}><UsagePage /></Suspense>} />
          <Route path="/developer/api-keys" element={<CredentialsPage kind="api-keys" />} />
          <Route path="/developer/mcp" element={<CredentialsPage kind="mcp-tokens" />} />
          <Route path="/developer/webhooks" element={<WebhooksPage />} />
          <Route path="/developer/connectors" element={<ConnectorsPage />} />
          <Route path="/developer/docs" element={<Suspense fallback={<Loading />}><DeveloperDocsPage /></Suspense>} />
          <Route path="/developer/*" element={<Placeholder title="Developer" />} />
          <Route path="/balance" element={<BalancePage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin/models" element={<Suspense fallback={<Loading />}><AdminModelsPage /></Suspense>} />
          <Route path="*" element={<MenuPlaceholderPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
