import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth-context";
import { AppLayout } from "./components/AppLayout";
import { AgentLogin } from "./pages/AgentLogin";
import { ContactLogin } from "./pages/ContactLogin";
import { MagicLinkVerify } from "./pages/MagicLinkVerify";
import { TicketList } from "./pages/TicketList";
import { TicketDetail } from "./pages/TicketDetail";
import { NewTicket } from "./pages/NewTicket";
import { AcceptInvite } from "./pages/AcceptInvite";
import { AccountsPage } from "./pages/admin/AccountsPage";
import { AccountDetail } from "./pages/admin/AccountDetail";
import { RolesPage } from "./pages/admin/RolesPage";
import { AgentsPage } from "./pages/admin/AgentsPage";
import { TemplatesPage } from "./pages/admin/TemplatesPage";

function RequireSession({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-4">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * UI-only convenience gate. The real authorisation is enforced server-side
 * on every admin route (CLAUDE.md §8) — this just avoids flashing an admin
 * screen at a Contact who'll get a 403 the moment it fetches data.
 */
function RequireAgent({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (session?.subjectType !== "agent") return <Navigate to="/tickets" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AgentLogin />} />
      <Route path="/portal/login" element={<ContactLogin />} />
      <Route path="/auth/magic" element={<MagicLinkVerify />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route
        path="/"
        element={
          <RequireSession>
            <AppLayout />
          </RequireSession>
        }
      >
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="tickets" element={<TicketList />} />
        <Route path="tickets/new" element={<NewTicket />} />
        <Route path="tickets/:id" element={<TicketDetail />} />

        <Route path="admin/accounts" element={<RequireAgent><AccountsPage /></RequireAgent>} />
        <Route path="admin/accounts/:id" element={<RequireAgent><AccountDetail /></RequireAgent>} />
        <Route path="admin/roles" element={<RequireAgent><RolesPage /></RequireAgent>} />
        <Route path="admin/agents" element={<RequireAgent><AgentsPage /></RequireAgent>} />
        <Route path="admin/templates" element={<RequireAgent><TemplatesPage /></RequireAgent>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
