import { Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useApp } from "./providers";
import { AppShell } from "@/layouts/AppShell";
import { Loading } from "@/components/Panels";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Dashboard from "@/pages/dashboard/Dashboard";
import { MyActions, WaitingForOthers } from "@/pages/dashboard/MyWork";
import ChangesList from "@/pages/changes/ChangesList";
import StartChange from "@/pages/changes/StartChange";
import ChangeDetail from "@/pages/changes/ChangeDetail";
import { TasksList, TaskDetail, TaskTemplates } from "@/pages/tasks/Tasks";
import { ApprovalsList, ApprovalDetail } from "@/pages/approvals/Approvals";
import Policies from "@/pages/policies/Policies";
import { AgentsList, AgentDetail } from "@/pages/agents/Agents";
import { Environments, Servers, Applications, Deployments, DeploymentDetail } from "@/pages/infrastructure/Infrastructure";
import { Git, Provider, CiCd, Releases } from "@/pages/devops/DevOps";
import { Monitoring, Incidents, IncidentDetail, SelfHealing, Diagnostics, Backups } from "@/pages/operations/Operations";
import { Jira, Worklogs, Testing, Uat, Reports } from "@/pages/work/Work";
import { Installed, Marketplace, Schedules } from "@/pages/automations/Automations";
import { AuditLogs, Access } from "@/pages/security/Security";
import { Users, Groups, Roles, Verification, Settings } from "@/pages/organization/Organization";
import { Billing, Roi, Pricing } from "@/pages/billing/Billing";
import { MyData } from "@/pages/data/Data";
import { ConnectedAI, McpConnections, AiUsage, AiTrace, AiOptimization, ExecutionAnalytics, LearningData } from "@/pages/ai/AiPages";
import DemoLab from "@/pages/demo/DemoLab";
import { EmptyState, Panel } from "@/components/Panels";
import { Link } from "react-router-dom";

function NotFound() {
  const loc = useLocation();
  return <Panel><EmptyState icon="bi-compass" title="Page not found" body={<span>Nothing lives at <code>{loc.pathname}</code>. Use ⌘K to jump anywhere.</span>} action={<Link to="/" className="btn btn-primary btn-sm">Back to dashboard</Link>} /></Panel>;
}

export function AppRoutes() {
  const { session, loading } = useApp();
  if (loading) return <div className="d-flex align-items-center justify-content-center vh-100"><Loading label="Starting Super MCP…" /></div>;
  if (!session) return <Routes><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/pricing" element={<Pricing />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  return <Suspense fallback={<Loading />}><Routes>
    <Route path="/login" element={<Navigate to="/" replace />} />
    <Route path="/register" element={<Navigate to="/" replace />} />
    <Route path="/pricing" element={<Pricing />} />
    <Route element={<AppShell />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/my/actions" element={<MyActions />} />
      <Route path="/my/waiting" element={<WaitingForOthers />} />
      <Route path="/changes" element={<ChangesList />} />
      <Route path="/changes/new" element={<StartChange />} />
      <Route path="/changes/:id" element={<ChangeDetail />} />
      <Route path="/tasks" element={<TasksList />} />
      <Route path="/tasks/templates" element={<TaskTemplates />} />
      <Route path="/tasks/:id" element={<TaskDetail />} />
      <Route path="/approvals" element={<ApprovalsList />} />
      <Route path="/approvals/:id" element={<ApprovalDetail />} />
      <Route path="/agents" element={<AgentsList />} />
      <Route path="/agents/health" element={<AgentsList view="health" />} />
      <Route path="/agents/capabilities" element={<AgentsList view="capabilities" />} />
      <Route path="/agents/policies" element={<AgentsList view="policies" />} />
      <Route path="/agents/updates" element={<AgentsList view="updates" />} />
      <Route path="/agents/:id" element={<AgentDetail />} />
      <Route path="/infrastructure/environments" element={<Environments />} />
      <Route path="/infrastructure/servers" element={<Servers view="servers" />} />
      <Route path="/infrastructure/vms" element={<Servers view="vms" />} />
      <Route path="/infrastructure/proxmox" element={<Servers view="proxmox" />} />
      <Route path="/infrastructure/docker" element={<Servers view="docker" />} />
      <Route path="/infrastructure/applications" element={<Applications />} />
      <Route path="/infrastructure/deployments" element={<Deployments />} />
      <Route path="/deployments/:id" element={<DeploymentDetail />} />
      <Route path="/devops/git" element={<Git />} />
      <Route path="/devops/github" element={<Provider kind="GITHUB" />} />
      <Route path="/devops/gitlab" element={<Provider kind="GITLAB" />} />
      <Route path="/devops/cicd" element={<CiCd />} />
      <Route path="/devops/releases" element={<Releases />} />
      <Route path="/operations/monitoring" element={<Monitoring />} />
      <Route path="/incidents" element={<Incidents />} />
      <Route path="/incidents/:id" element={<IncidentDetail />} />
      <Route path="/operations/self-healing" element={<SelfHealing />} />
      <Route path="/operations/diagnostics" element={<Diagnostics />} />
      <Route path="/operations/backups" element={<Backups />} />
      <Route path="/work/jira" element={<Jira />} />
      <Route path="/work/worklogs" element={<Worklogs />} />
      <Route path="/work/testing" element={<Testing />} />
      <Route path="/work/uat" element={<Uat />} />
      <Route path="/work/reports" element={<Reports />} />
      <Route path="/automations" element={<Installed />} />
      <Route path="/automations/marketplace" element={<Marketplace />} />
      <Route path="/automations/schedules" element={<Schedules />} />
      <Route path="/security/policies" element={<Policies />} />
      <Route path="/security/audit" element={<AuditLogs />} />
      <Route path="/security/access" element={<Access />} />
      <Route path="/organization/users" element={<Users />} />
      <Route path="/organization/groups" element={<Groups />} />
      <Route path="/organization/roles" element={<Roles />} />
      <Route path="/organization/verification" element={<Verification />} />
      <Route path="/organization/settings" element={<Settings />} />
      <Route path="/billing" element={<Billing tab="plan" />} />
      <Route path="/billing/usage" element={<Billing tab="usage" />} />
      <Route path="/billing/ai-costs" element={<Billing tab="ai" />} />
      <Route path="/billing/invoices" element={<Billing tab="invoices" />} />
      <Route path="/billing/roi" element={<Roi />} />
      <Route path="/data" element={<MyData />} />
      <Route path="/data/export" element={<MyData exportOnly />} />
      <Route path="/ai/connected" element={<ConnectedAI />} />
      <Route path="/ai/mcp" element={<McpConnections />} />
      <Route path="/ai/usage" element={<AiUsage />} />
      <Route path="/ai/usage/:id" element={<AiTrace />} />
      <Route path="/ai/optimization" element={<AiOptimization />} />
      <Route path="/ai/execution" element={<ExecutionAnalytics />} />
      <Route path="/ai/learning" element={<LearningData />} />
      <Route path="/demo-lab" element={<DemoLab />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes></Suspense>;
}
