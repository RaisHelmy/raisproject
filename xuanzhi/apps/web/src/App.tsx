import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/services/auth";
import MarketingLayout from "@/layouts/MarketingLayout";
import AppLayout from "@/layouts/AppLayout";
import AdminLayout from "@/layouts/AdminLayout";
import LandingPage from "@/pages/marketing/LandingPage";
import PricingPage from "@/pages/marketing/PricingPage";
import { LoginPage, RegisterPage, ForgotPage, ResetPage, VerifyPage } from "@/pages/auth/AuthPages";
import ChatPage from "@/pages/app/ChatPage";
import ExplorePage from "@/pages/app/ExplorePage";
import { Skeleton } from "@/components/ui";

const KnowledgePage = lazy(() => import("@/pages/app/KnowledgePage"));
const KnowledgeDocumentPage = lazy(() => import("@/pages/app/KnowledgeDocumentPage"));
const SavedPage = lazy(() => import("@/pages/app/SavedPage"));
const ProfilePage = lazy(() => import("@/pages/app/ProfilePage"));
const SettingsPage = lazy(() => import("@/pages/app/SettingsPage"));
const SubscriptionPage = lazy(() => import("@/pages/app/SubscriptionPage"));
const OnboardingPage = lazy(() => import("@/pages/app/OnboardingPage"));
const SharePage = lazy(() => import("@/pages/app/SharePage"));
const Admin = {
  Dashboard: lazy(() => import("@/pages/admin/DashboardPage")), Users: lazy(() => import("@/pages/admin/UsersPage")), Organizations: lazy(() => import("@/pages/admin/OrganizationsPage")), Models: lazy(() => import("@/pages/admin/ModelsPage")),
  Plans: lazy(() => import("@/pages/admin/PlansPage")), Knowledge: lazy(() => import("@/pages/admin/KnowledgePage")), Document: lazy(() => import("@/pages/admin/DocumentPage")), Categories: lazy(() => import("@/pages/admin/CategoriesPage")),
  Prompts: lazy(() => import("@/pages/admin/PromptsPage")), Usage: lazy(() => import("@/pages/admin/UsagePage")), Analytics: lazy(() => import("@/pages/admin/AnalyticsPage")), Settings: lazy(() => import("@/pages/admin/SettingsPage")), Audit: lazy(() => import("@/pages/admin/AuditPage")),
};

function Loading() { return <div className="xz-page"><Skeleton h={28} w="40%" className="mb-3" /><Skeleton h={14} className="mb-2" /><Skeleton h={14} w="80%" /></div>; }

function RequireAuth() {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!user.onboarding_completed && !loc.pathname.startsWith("/app/onboarding")) return <Navigate to="/app/onboarding" replace />;
  return <Outlet />;
}
function RequireAdmin() { const { isAdmin, loading, user } = useAuth(); if (loading) return <Loading />; if (!user) return <Navigate to="/login?redirect=/admin" replace />; if (!isAdmin) return <Navigate to="/app" replace />; return <Outlet />; }

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/explore" element={<ExplorePage publicView />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPage />} />
          <Route path="/reset-password" element={<ResetPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/share/:token" element={<SharePage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/app/onboarding" element={<OnboardingPage />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="/app/chat" replace />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="chat/:id" element={<ChatPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="knowledge/:id" element={<KnowledgeDocumentPage />} />
            <Route path="saved" element={<SavedPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
          </Route>
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Admin.Dashboard />} />
            <Route path="users" element={<Admin.Users />} />
            <Route path="organizations" element={<Admin.Organizations />} />
            <Route path="models" element={<Admin.Models />} />
            <Route path="plans" element={<Admin.Plans />} />
            <Route path="knowledge" element={<Admin.Knowledge />} />
            <Route path="knowledge/:id" element={<Admin.Document />} />
            <Route path="categories" element={<Admin.Categories />} />
            <Route path="prompts" element={<Admin.Prompts />} />
            <Route path="usage" element={<Admin.Usage />} />
            <Route path="analytics" element={<Admin.Analytics />} />
            <Route path="settings" element={<Admin.Settings />} />
            <Route path="audit" element={<Admin.Audit />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
