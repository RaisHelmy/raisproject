import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/services/auth";
import AppLayout from "@/layouts/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TimesheetListPage from "@/pages/timesheets/TimesheetListPage";
import TimesheetDetailPage from "@/pages/timesheets/TimesheetDetailPage";
import TimesheetFormPage from "@/pages/timesheets/TimesheetFormPage";
import ImportPage from "@/pages/imports/ImportPage";
import ImportHistoryPage from "@/pages/imports/ImportHistoryPage";
import ImportDetailPage from "@/pages/imports/ImportDetailPage";
import AIReviewPage from "@/pages/imports/AIReviewPage";
import ApprovalsPage from "@/pages/approvals/ApprovalsPage";
import ApprovalHistoryPage from "@/pages/approvals/ApprovalHistoryPage";
import JiraSyncCenterPage from "@/pages/jira/JiraSyncCenterPage";
import JiraTasksPage from "@/pages/jira/JiraTasksPage";
import JiraTaskDetailPage from "@/pages/jira/JiraTaskDetailPage";
import ReconciliationPage from "@/pages/jira/ReconciliationPage";
import JiraConnectionPage from "@/pages/jira/JiraConnectionPage";
import ReportCenterPage from "@/pages/reports/ReportCenterPage";
import ReportPrintPage from "@/pages/reports/ReportPrintPage";
import HrReportPage from "@/pages/reports/HrReportPage";
import ProfilePage from "@/pages/settings/ProfilePage";
import ProjectsPage from "@/pages/settings/ProjectsPage";
import AdminPage from "@/pages/settings/AdminPage";
import OnboardingPage from "@/pages/OnboardingPage";
import { Spinner } from "@/components/ui";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-5"><Spinner label="Signing you in…" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  // Onboarding itself links out to /settings/jira ("Connect your Jira site")
  // and the demo banner links to /settings/admin ("Configure real
  // integrations"), so those must stay reachable while onboarding is
  // incomplete — otherwise the guard bounces the user straight back and the
  // links look like dead buttons that do nothing.
  const allowedDuringOnboarding = loc.pathname === "/onboarding" || loc.pathname.startsWith("/settings");
  if (!user.onboarding_completed && !allowedDuringOnboarding) return <Navigate to="/onboarding" replace />;
  return children;
}

function RequireRole({ roles, children }: { roles: ("ADMIN" | "APPROVER" | "USER")[]; children: React.ReactElement }) {
  const { hasRole } = useAuth();
  if (!hasRole(...roles)) return <div className="alert alert-warning">You don't have permission to view this page.</div>;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reports/print" element={<RequireAuth><ReportPrintPage /></RequireAuth>} />
      <Route path="/reports/hr/print" element={<RequireAuth><HrReportPage print /></RequireAuth>} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="timesheets" element={<TimesheetListPage view="all" />} />
        <Route path="timesheets/drafts" element={<TimesheetListPage view="DRAFT" />} />
        <Route path="timesheets/submitted" element={<TimesheetListPage view="SUBMITTED" />} />
        <Route path="timesheets/approved" element={<TimesheetListPage view="APPROVED" />} />
        <Route path="timesheets/rejected" element={<TimesheetListPage view="REJECTED" />} />
        <Route path="timesheets/new" element={<TimesheetFormPage />} />
        <Route path="timesheets/:id" element={<TimesheetDetailPage />} />
        <Route path="timesheets/:id/edit" element={<TimesheetFormPage />} />
        <Route path="imports" element={<ImportHistoryPage />} />
        <Route path="imports/new" element={<ImportPage />} />
        <Route path="imports/:id" element={<ImportDetailPage />} />
        <Route path="imports/:id/review" element={<AIReviewPage />} />
        <Route path="approvals" element={<RequireRole roles={["ADMIN", "APPROVER"]}><ApprovalsPage /></RequireRole>} />
        <Route path="approvals/history" element={<RequireRole roles={["ADMIN", "APPROVER"]}><ApprovalHistoryPage /></RequireRole>} />
        <Route path="approvals/:id" element={<RequireRole roles={["ADMIN", "APPROVER"]}><TimesheetDetailPage approvalMode /></RequireRole>} />
        <Route path="jira" element={<JiraSyncCenterPage />} />
        <Route path="jira/tasks" element={<JiraTasksPage />} />
        <Route path="jira/tasks/:key" element={<JiraTaskDetailPage />} />
        <Route path="jira/reconciliation" element={<ReconciliationPage view="needs_action" />} />
        <Route path="jira/ready" element={<ReconciliationPage view="ready_to_sync" />} />
        <Route path="jira/synced" element={<ReconciliationPage view="synced" />} />
        <Route path="jira/errors" element={<ReconciliationPage view="errors" />} />
        <Route path="reports" element={<ReportCenterPage />} />
        <Route path="reports/hr" element={<HrReportPage />} />
        <Route path="settings/profile" element={<ProfilePage />} />
        <Route path="settings/jira" element={<JiraConnectionPage />} />
        <Route path="settings/projects" element={<RequireRole roles={["ADMIN"]}><ProjectsPage /></RequireRole>} />
        <Route path="settings/admin" element={<RequireRole roles={["ADMIN"]}><AdminPage /></RequireRole>} />
        <Route path="*" element={<div className="text-center py-5"><h1 className="h4">Page not found</h1><p className="text-secondary">The page you're looking for doesn't exist.</p></div>} />
      </Route>
    </Routes>
  );
}
