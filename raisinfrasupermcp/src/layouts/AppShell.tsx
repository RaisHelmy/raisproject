import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "@/app/providers";
import { CommandBar } from "@/components/CommandBar";
import { Drawer } from "@/components/Dialogs";
import { useHotkey, useAsync } from "@/hooks/useAsync";
import type { Permission } from "@/domain/types";
import { timeAgo } from "@/utils/format";

interface NavItem { label: string; href: string; icon?: string; perm?: Permission; badge?: string }
interface NavGroup { title: string; icon: string; items: NavItem[]; perm?: Permission }

const NAV: NavGroup[] = [
  { title: "AI & MCP", icon: "bi-robot", items: [{ label: "Connected AI", href: "/ai/connected" }, { label: "MCP Connections", href: "/ai/mcp" }, { label: "AI Usage", href: "/ai/usage", perm: "analytics.read" }, { label: "AI Optimization", href: "/ai/optimization", perm: "analytics.read" }, { label: "Execution Analytics", href: "/ai/execution", perm: "analytics.read" }, { label: "Learning Data", href: "/ai/learning", perm: "analytics.read" }] },
  { title: "My Work", icon: "bi-person-workspace", items: [{ label: "My Actions", href: "/my/actions" }, { label: "Active Changes", href: "/changes?view=mine" }, { label: "Waiting for Others", href: "/my/waiting" }] },
  { title: "Changes", icon: "bi-arrow-left-right", perm: "change.read", items: [{ label: "All Changes", href: "/changes" }, { label: "My Changes", href: "/changes?view=mine" }, { label: "Blocked", href: "/changes?view=blocked" }, { label: "Awaiting Approval", href: "/changes?view=awaiting" }, { label: "Completed", href: "/changes?view=completed" }] },
  { title: "Tasks", icon: "bi-gear", perm: "change.read", items: [{ label: "Active", href: "/tasks?status=active" }, { label: "Scheduled", href: "/tasks?status=scheduled" }, { label: "Completed", href: "/tasks?status=completed" }, { label: "Failed / Healing", href: "/tasks?status=failed" }, { label: "Templates", href: "/tasks/templates" }] },
  { title: "Agents", icon: "bi-hdd-network", perm: "agent.read", items: [{ label: "My Agents", href: "/agents" }, { label: "Agent Health", href: "/agents/health" }, { label: "Capabilities", href: "/agents/capabilities" }, { label: "Policies", href: "/agents/policies" }, { label: "Updates", href: "/agents/updates" }] },
  { title: "Infrastructure", icon: "bi-diagram-3", perm: "environment.read", items: [{ label: "Environments", href: "/infrastructure/environments" }, { label: "Servers", href: "/infrastructure/servers" }, { label: "VMs", href: "/infrastructure/vms" }, { label: "Proxmox", href: "/infrastructure/proxmox" }, { label: "Docker", href: "/infrastructure/docker" }, { label: "Applications", href: "/infrastructure/applications" }, { label: "Deployments", href: "/infrastructure/deployments" }] },
  { title: "DevOps", icon: "bi-git", perm: "repository.read", items: [{ label: "Git", href: "/devops/git" }, { label: "GitHub", href: "/devops/github" }, { label: "GitLab", href: "/devops/gitlab" }, { label: "CI/CD", href: "/devops/cicd" }, { label: "Releases", href: "/devops/releases" }] },
  { title: "Operations", icon: "bi-activity", perm: "environment.read", items: [{ label: "Monitoring", href: "/operations/monitoring" }, { label: "Incidents", href: "/incidents" }, { label: "Self-Healing", href: "/operations/self-healing" }, { label: "Diagnostics", href: "/operations/diagnostics" }, { label: "Backups", href: "/operations/backups" }] },
  { title: "Work", icon: "bi-kanban", items: [{ label: "Jira", href: "/work/jira", perm: "jira.read" }, { label: "Worklogs", href: "/work/worklogs", perm: "jira.read" }, { label: "Testing", href: "/work/testing" }, { label: "UAT", href: "/work/uat" }, { label: "Reports", href: "/work/reports", perm: "analytics.read" }] },
  { title: "Automations", icon: "bi-lightning-charge", items: [{ label: "Installed", href: "/automations" }, { label: "Marketplace", href: "/automations/marketplace" }, { label: "Schedules", href: "/automations/schedules" }] },
  { title: "Security", icon: "bi-shield-lock", items: [{ label: "Policies", href: "/security/policies" }, { label: "Approvals", href: "/approvals" }, { label: "Audit Logs", href: "/security/audit", perm: "audit.read" }, { label: "Access", href: "/security/access", perm: "security.manage" }] },
  { title: "Organization", icon: "bi-building", perm: "organization.read", items: [{ label: "Users", href: "/organization/users", perm: "user.read" }, { label: "Groups", href: "/organization/groups", perm: "group.read" }, { label: "Roles", href: "/organization/roles", perm: "role.read" }, { label: "Verification", href: "/organization/verification" }, { label: "Settings", href: "/organization/settings", perm: "organization.manage" }] },
  { title: "Billing", icon: "bi-credit-card", perm: "billing.read", items: [{ label: "Plan", href: "/billing" }, { label: "Usage", href: "/billing/usage" }, { label: "AI Costs", href: "/billing/ai-costs" }, { label: "Invoices", href: "/billing/invoices" }] },
  { title: "Data", icon: "bi-database", perm: "data.export", items: [{ label: "My Data", href: "/data" }, { label: "Export", href: "/data/export" }] },
];

export function AppShell() {
  const { session, api, setSession, can, toast } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem("supermcp.nav") ?? "{}"); } catch { return {}; } });
  useHotkey("k", useCallback(() => setCmdOpen((o) => !o), []));
  useEffect(() => { setSideOpen(false); }, [loc.pathname]);
  const notifications = useAsync(() => api.platform.notifications(), [loc.pathname]);
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  const groups = useMemo(() => NAV.filter((g) => !g.perm || can(g.perm)).map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) })).filter((g) => g.items.length), [can]);
  const toggle = (t: string) => setExpanded((e) => { const n = { ...e, [t]: !e[t] }; localStorage.setItem("supermcp.nav", JSON.stringify(n)); return n; });
  const isGroupActive = (g: NavGroup) => g.items.some((i) => loc.pathname + loc.search === i.href || (loc.pathname.startsWith(i.href.split("?")[0]) && i.href.split("?")[0] !== "/"));
  if (!session) return null;
  return <div className="app-shell">
    {sideOpen && <div className="sidebar-backdrop" onClick={() => setSideOpen(false)} />}
    <aside className={`app-sidebar${sideOpen ? " open" : ""}`} aria-label="Main navigation">
      <Link to="/" className="brand"><span className="logo"><i className="bi bi-lightning-charge-fill" /></span>SUPER MCP</Link>
      <nav className="nav-section"><NavLink to="/" end className={({ isActive }) => `nav-link-smcp${isActive ? " active" : ""}`}><i className="bi bi-grid-1x2" />Dashboard</NavLink>
        <NavLink to="/changes/new" className={({ isActive }) => `nav-link-smcp${isActive ? " active" : ""}`}><i className="bi bi-plus-circle" />Start a Change</NavLink>
        <NavLink to="/demo-lab" className={({ isActive }) => `nav-link-smcp${isActive ? " active" : ""}`}><i className="bi bi-flask" />Demo Lab{session.organization.demo && <span className="badge text-bg-warning">DEMO</span>}</NavLink></nav>
      {groups.map((g) => { const open = expanded[g.title] ?? isGroupActive(g); return <div key={g.title} className="nav-section">
        <button className={`nav-link-smcp w-100 border-0 bg-transparent${isGroupActive(g) && !open ? " active" : ""}`} onClick={() => toggle(g.title)} aria-expanded={open}><i className={`bi ${g.icon}`} />{g.title}<i className={`bi ms-auto small ${open ? "bi-chevron-down" : "bi-chevron-right"}`} /></button>
        {open && <div className="nav-sub">{g.items.map((i) => { const [path, search] = i.href.split("?"); const active = loc.pathname === path && (!search || loc.search === "?" + search) && !(path === "/changes" && !search && loc.search); return <NavLink key={i.href} to={i.href} className={`nav-link-smcp${active ? " active" : ""}`}>{i.label}</NavLink>; })}</div>}
      </div>; })}
      <div className="sidebar-footer"><div className="d-flex align-items-center gap-2"><span className="avatar sm">{session.user.avatarInitials}</span><div className="flex-grow-1 text-truncate"><div className="fw-semibold text-body">{session.user.name}</div><div className="text-truncate">{session.actor.roleKeys.map((r) => r.replace(/_/g, " ")).join(", ")}</div></div><button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={async () => { await api.auth.logout(); setSession(null); nav("/login"); }}><i className="bi bi-box-arrow-right" /></button></div></div>
    </aside>
    <header className="app-topbar">
      <button className="icon-btn d-xl-none" aria-label="Open navigation" onClick={() => setSideOpen(true)}><i className="bi bi-list" /></button>
      <button className="org-switcher" onClick={() => setOrgOpen(true)} aria-haspopup="dialog"><i className={`bi ${session.organization.type === "PERSONAL" ? "bi-person" : "bi-building"}`} /><span className="text-truncate" style={{ maxWidth: 180 }}>{session.organization.name}</span>{session.organization.demo && <span className="badge text-bg-warning">DEMO</span>}<i className="bi bi-chevron-expand small" /></button>
      <button className="command-trigger" onClick={() => setCmdOpen(true)} aria-label="Open command center"><i className="bi bi-search" /><span className="text">Ask Super MCP or search…</span><kbd>⌘K</kbd></button>
      <div className="ms-auto d-flex align-items-center gap-1">
        <span className="status tone-neutral d-none d-md-inline-flex" title="Client mode"><i className={`bi ${session.mode === "DEMO" ? "bi-flask" : "bi-plug-fill"}`} />{session.mode === "DEMO" ? "Demo mode" : "Connected"}</span>
        <button className="icon-btn" aria-label={`Notifications (${unread} unread)`} onClick={() => setNotifOpen(true)}><i className="bi bi-bell" />{unread > 0 && <span className="dot" />}</button>
        <Link className="icon-btn" to="/organization/settings" aria-label="Settings"><i className="bi bi-gear" /></Link>
      </div>
    </header>
    <div>
      {session.organization.demo && <div className="demo-banner"><i className="bi bi-flask" /><span><strong>DEMO ENVIRONMENT</strong> — ABC Sdn Bhd runs on MockAgent, MockGitHub, MockGitLab, MockJira and MockProxmox. Nothing touches real infrastructure.</span><Link to="/demo-lab" className="ms-auto">Open Demo Lab →</Link></div>}
      <main className="app-main" id="main"><Outlet /></main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {[{ to: "/", icon: "bi-grid-1x2", label: "Home" }, { to: "/my/actions", icon: "bi-check2-square", label: "Actions" }, { to: "/changes", icon: "bi-arrow-left-right", label: "Changes" }, { to: "/approvals", icon: "bi-person-check", label: "Approvals" }, { to: "/ai/connected", icon: "bi-robot", label: "AI" }].map((i) => <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => isActive ? "active" : ""}><i className={`bi ${i.icon}`} />{i.label}</NavLink>)}
      <a href="#" onClick={(e) => { e.preventDefault(); setNotifOpen(true); }}><i className="bi bi-bell" />Alerts</a>
    </nav>
    <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />
    <Drawer open={notifOpen} onClose={() => setNotifOpen(false)} title={<span>Notifications {unread > 0 && <span className="badge text-bg-danger ms-1">{unread}</span>}</span>} footer={<button className="btn btn-sm btn-outline-secondary" onClick={async () => { await api.platform.markNotifications("all"); notifications.reload(true); }}>Mark all as read</button>}>
      {(notifications.data ?? []).length === 0 ? <div className="text-secondary">No notifications yet. Approvals, deployments, incidents and agent alerts land here (and by email once configured).</div> : (notifications.data ?? []).map((n) => <div key={n.id} className="py-2 border-bottom"><div className="d-flex gap-2 align-items-start">{!n.read && <span className="mt-1" style={{ width: 8, height: 8, borderRadius: 4, background: "var(--smcp-accent)", flexShrink: 0 }} />}<div className="flex-grow-1"><div className="fw-semibold">{n.title}</div><div className="small text-secondary">{n.body}</div><div className="small text-secondary mt-1 d-flex gap-2">{timeAgo(n.createdAt)}{n.href && <a href={n.href} onClick={async (e) => { e.preventDefault(); await api.platform.markNotifications([n.id]); setNotifOpen(false); nav(n.href!); }}>Open →</a>}</div></div></div></div>)}
    </Drawer>
    <Drawer open={orgOpen} onClose={() => setOrgOpen(false)} title="Switch organization">
      {session.organizations.map((o) => <button key={o.id} className={`list-row w-100 border-0 text-start bg-transparent${o.id === session.organization.id ? " fw-semibold" : ""}`} onClick={async () => { try { setSession(await api.auth.switchOrganization(o.id)); setOrgOpen(false); nav("/"); } catch (e) { toast((e as Error).message, "error"); } }}><i className={`bi ${o.type === "PERSONAL" ? "bi-person" : "bi-building"}`} /><div><div className="title">{o.name}</div><div className="meta">{o.type.toLowerCase()} · {o.roleKeys.map((r) => r.replace(/_/g, " ")).join(", ")} · plan {o.planId}</div></div>{o.id === session.organization.id && <i className="bi bi-check-lg ms-auto text-primary" />}</button>)}
      <Link to="/register?org=new" className="btn btn-outline-secondary btn-sm mt-3" onClick={() => setOrgOpen(false)}><i className="bi bi-plus me-1" />Create organization</Link>
    </Drawer>
  </div>;
}
