import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { DashboardDTO, NotificationDTO, SearchResultDTO } from "@rais/shared-types";
import { useAuth } from "@/services/auth";
import { api } from "@/services/api";
import { useApi, useDebounced } from "@/hooks/useApi";
import { fmtDateTime } from "@/services/format";

interface NavItem { to: string; label: string; icon: string; count?: number; end?: boolean }
interface NavSection { title: string; items: NavItem[] }

export default function AppLayout() {
  const { user, logout, isApprover, isAdmin, demo } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const dash = useApi<DashboardDTO>("/dashboard", undefined, { poll: 60000 });
  useEffect(() => setOpen(false), [loc.pathname]);
  const k = dash.data?.kpis;

  const sections: NavSection[] = [
    { title: "", items: [{ to: "/", label: "Dashboard", icon: "speedometer2", end: true }] },
    { title: "My Work", items: [
      { to: "/timesheets", label: "My Timesheets", icon: "journal-text", end: true },
      { to: "/timesheets/drafts", label: "Drafts", icon: "pencil-square", count: k?.drafts },
      { to: "/timesheets/submitted", label: "Submitted", icon: "send" },
      { to: "/timesheets/approved", label: "Approved", icon: "check2-circle" },
      { to: "/timesheets/rejected", label: "Rejected", icon: "x-circle" },
    ] },
    { title: "Import Work", items: [
      { to: "/imports/new", label: "WhatsApp Import", icon: "whatsapp" },
      { to: "/imports", label: "Import History", icon: "clock-history", count: k?.ai_review_pending, end: true },
    ] },
    ...(isApprover ? [{ title: "Approvals", items: [
      { to: "/approvals", label: "Pending Approval", icon: "inbox", count: k?.pending_approval, end: true },
      { to: "/approvals/history", label: "Approval History", icon: "archive" },
    ] }] : []),
    { title: "Jira", items: [
      { to: "/jira", label: "Sync Center", icon: "arrow-repeat", end: true, count: (k?.jira_pending ?? 0) + (k?.sync_errors ?? 0) || undefined },
      { to: "/jira/tasks", label: "My Jira Tasks", icon: "kanban" },
      { to: "/jira/reconciliation", label: "Reconciliation", icon: "diagram-3" },
      { to: "/jira/ready", label: "Ready to Sync", icon: "cloud-upload" },
      { to: "/jira/synced", label: "Synced", icon: "cloud-check" },
      { to: "/jira/errors", label: "Sync Errors", icon: "exclamation-octagon", count: k?.sync_errors },
    ] },
    { title: "Reports", items: [{ to: "/reports", label: "Report Center", icon: "file-earmark-bar-graph" }, { to: "/reports/hr", label: "HR Timesheet", icon: "calendar-week" }] },
    { title: "Settings", items: [
      { to: "/settings/profile", label: "Profile", icon: "person" },
      { to: "/settings/jira", label: "Jira Connection", icon: "plug" },
      ...(isAdmin ? [{ to: "/settings/projects", label: "Projects", icon: "folder2-open" }, { to: "/settings/admin", label: "Administration", icon: "shield-lock" }] : []),
    ] },
  ];

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop${open ? " show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`app-sidebar${open ? " open" : ""}`} aria-label="Main navigation">
        <Link to="/" className="brand"><span className="brand-mark"><i className="bi bi-stopwatch" /></span><span>Rais Timesheet</span></Link>
        <nav>
          {sections.map((s, i) => (
            <div key={i}>
              {s.title && <div className="nav-section">{s.title}</div>}
              {s.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `nav-item-link${isActive ? " active" : ""}`}>
                  <i className={`bi bi-${it.icon}`} aria-hidden="true" /><span>{it.label}</span>{!!it.count && <span className="nav-count" aria-label={`${it.count} items`}>{it.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">Signed in as <strong className="text-white">{user?.name}</strong><br />{user?.roles.join(" · ")}</div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button className="btn btn-outline-secondary d-lg-none" aria-label="Open navigation" onClick={() => setOpen(true)}><i className="bi bi-list" /></button>
          <GlobalSearch />
          <div className="ms-auto d-flex align-items-center gap-2">
            <Notifications />
            <div className="dropdown-simple position-relative">
              <UserMenu name={user?.name ?? ""} onLogout={logout} />
            </div>
          </div>
        </header>
        {(demo.ai || demo.jira) && (
          <div className="demo-banner no-print"><i className="bi bi-info-circle me-1" /> Demo mode: {demo.ai && <span>AI uses the heuristic (rule-based) provider</span>}{demo.ai && demo.jira && " · "}{demo.jira && <span>Jira uses the built-in demo adapter</span>}. {isAdmin ? <Link to="/settings/admin">Configure real integrations</Link> : "Ask an administrator to configure real integrations."}</div>
        )}
        <main className="app-content" id="main"><Outlet context={{ dashboard: dash }} /></main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 250);
  const res = useApi<SearchResultDTO[]>(dq.length >= 2 ? "/search" : null, { q: dq });
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div className="search-box" ref={box}>
      <label htmlFor="global-search" className="visually-hidden">Search timesheets, Jira keys, imports</label>
      <div className="input-group input-group-sm">
        <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
        <input id="global-search" className="form-control" placeholder="Search timesheets, Jira keys, imports…" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={(e) => { if (e.key === "Enter" && res.data?.[0]) { nav(res.data[0].link); setOpen(false); } if (e.key === "Escape") setOpen(false); }} autoComplete="off" />
      </div>
      {open && dq.length >= 2 && (
        <div className="search-results" role="listbox">
          {res.loading && <div className="p-2 small text-secondary">Searching…</div>}
          {!res.loading && !res.data?.length && <div className="p-2 small text-secondary">No results for “{dq}”.</div>}
          {res.data?.map((r) => <Link key={`${r.type}-${r.id}`} to={r.link} onClick={() => setOpen(false)} role="option"><div className="result-type">{r.type}</div><div>{r.title}</div><div className="small text-secondary">{r.subtitle}</div></Link>)}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const list = useApi<{ items: NotificationDTO[]; unread: number }>("/notifications", { page_size: 8 }, { poll: 60000 });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const markAll = async () => { await api("/notifications/read", { body: { ids: "all" } }); list.reload(); };
  const unread = list.data?.unread ?? 0;
  return (
    <div className="position-relative" ref={box}>
      <button className="btn btn-outline-secondary position-relative" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <i className="bi bi-bell" />{unread > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">{unread}</span>}
      </button>
      {open && (
        <div className="notif-menu">
          <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"><strong>Notifications</strong>{unread > 0 && <button className="btn btn-link btn-sm p-0" onClick={markAll}>Mark all read</button>}</div>
          {!list.data?.items.length && <div className="p-3 small text-secondary">You're all caught up.</div>}
          {list.data?.items.map((n) => (
            <Link key={n.id} to={n.link} className={`notif-item${n.is_read ? "" : " unread"}`} onClick={async () => { setOpen(false); if (!n.is_read) { await api("/notifications/read", { body: { ids: [n.id] } }); list.reload(); } }}>
              <div className="fw-semibold small">{n.title}</div>
              {n.body && <div className="small text-secondary text-truncate">{n.body}</div>}
              <div className="small text-secondary">{fmtDateTime(n.created_at)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({ name, onLogout }: { name: string; onLogout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div ref={box} className="position-relative">
      <button className="btn btn-outline-secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}><i className="bi bi-person-circle me-1" /><span className="d-none d-sm-inline">{name}</span></button>
      {open && (
        <div className="notif-menu" style={{ width: 220 }}>
          <Link to="/settings/profile" className="notif-item" onClick={() => setOpen(false)}><i className="bi bi-person me-2" />Profile</Link>
          <Link to="/onboarding" className="notif-item" onClick={() => setOpen(false)}><i className="bi bi-signpost me-2" />Getting started</Link>
          <button className="notif-item w-100 text-start border-0 bg-transparent" onClick={onLogout}><i className="bi bi-box-arrow-right me-2" />Sign out</button>
        </div>
      )}
    </div>
  );
}
