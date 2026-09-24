import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/services/auth";
import { AppDataProvider, useAppData } from "@/services/appdata";
import { useT } from "@/i18n";
import { LanguageSwitch, ThemeToggle } from "./MarketingLayout";
import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";

function Shell() {
  const { user, me, logout, isAdmin, refresh } = useAuth(); const { t } = useT(); const nav = useNavigate(); const loc = useLocation(); const toast = useToast();
  const [open, setOpen] = useState(false); const [palette, setPalette] = useState(false);
  const { refreshConversations } = useAppData();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); } if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); nav("/app/chat"); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [nav]);
  const items = [
    { to: "/app/chat", icon: "bi-chat-left-text", label: t("nav.chats") }, { to: "/app/explore", icon: "bi-compass", label: t("nav.explore") }, { to: "/app/knowledge", icon: "bi-journal-bookmark", label: t("nav.knowledge") },
    { to: "/app/saved", icon: "bi-bookmark", label: t("nav.saved") }, { to: "/app/profile", icon: "bi-person", label: t("nav.profile") },
  ];
  return (
    <div className="xz-app">
      {open && <div className="xz-backdrop d-lg-none" onClick={() => setOpen(false)} />}
      <aside className={`xz-sidebar ${open ? "open" : ""}`}>
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom"><Brand to="/app" /><button className="btn btn-ghost btn-sm d-lg-none" onClick={() => setOpen(false)} aria-label="Close"><i className="bi bi-x-lg" /></button></div>
        <div className="px-2 pt-2"><Link to="/app/chat" className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-between"><span><i className="bi bi-plus-lg me-2" />{t("nav.new_chat")}</span><kbd className="d-none d-lg-inline">⌘⇧O</kbd></Link></div>
        <div className="px-2 pt-2"><button className="btn btn-ghost w-100 d-flex align-items-center gap-2 text-muted" onClick={() => setPalette(true)}><i className="bi bi-search" /><span className="flex-grow-1 text-start fs-14">{t("nav.search")}</span><kbd>⌘K</kbd></button></div>
        <nav className="xz-nav px-2 pt-2">
          {items.slice(1, 4).map((i) => <NavLink key={i.to} to={i.to} className={({ isActive }) => (isActive ? "active" : "")}><i className={`bi ${i.icon}`} />{i.label}</NavLink>)}
        </nav>
        <div className="px-3 pt-3 pb-1 text-faint fs-13 text-uppercase" style={{ letterSpacing: ".06em" }}>{t("nav.chats")}</div>
        <Sidebar onRefresh={() => refreshConversations()} />
        <div className="border-top p-2">
          <div className="dropdown dropup w-100">
            <button className="btn btn-ghost w-100 d-flex align-items-center gap-2 text-start" onClick={(e) => e.currentTarget.nextElementSibling?.classList.toggle("show")} onBlur={(e) => { const m = e.currentTarget.nextElementSibling; setTimeout(() => m?.classList.remove("show"), 150); }}>
              <span className="xz-seal" style={{ background: "var(--xz-paper-3)", color: "var(--xz-ink-2)", fontFamily: "inherit", fontSize: 13 }}>{user?.name.slice(0, 1).toUpperCase()}</span>
              <span className="flex-grow-1 min-w-0"><span className="d-block text-truncate fs-14">{user?.name}</span><span className="d-block text-faint fs-13">{me?.entitlements.plan.name}</span></span><i className="bi bi-three-dots" />
            </button>
            <ul className="dropdown-menu w-100">
              <li><Link className="dropdown-item" to="/app/profile"><i className="bi bi-person me-2" />{t("nav.profile")}</Link></li>
              <li><Link className="dropdown-item" to="/app/settings"><i className="bi bi-gear me-2" />{t("nav.settings")}</Link></li>
              <li><Link className="dropdown-item" to="/app/subscription"><i className="bi bi-gem me-2" />{t("nav.subscription")}</Link></li>
              {isAdmin && <li><Link className="dropdown-item" to="/admin"><i className="bi bi-shield-lock me-2" />{t("nav.admin")}</Link></li>}
              <li><hr className="dropdown-divider" /></li>
              <li className="px-3 py-1 d-flex gap-2 align-items-center"><LanguageSwitch compact /><ThemeToggle /></li>
              <li><button className="dropdown-item" onClick={() => logout().then(() => nav("/"))}><i className="bi bi-box-arrow-right me-2" />{t("nav.logout")}</button></li>
            </ul>
          </div>
        </div>
      </aside>
      <div className="xz-main">
        <div className="xz-topbar d-lg-none">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Menu"><i className="bi bi-list fs-5" /></button>
          <Brand to="/app" />
          <div className="ms-auto"><button className="btn btn-ghost btn-sm" onClick={() => setPalette(true)} aria-label="Search"><i className="bi bi-search" /></button></div>
        </div>
        {user && !user.email_verified && me?.features.email && (
          <div className="alert alert-warning rounded-0 border-0 mb-0 py-2 fs-14 d-flex align-items-center gap-2"><i className="bi bi-envelope" />{t("auth.verify_banner")}<button className="btn btn-link btn-sm p-0" onClick={() => api("/auth/resend-verification", { body: {} }).then(() => toast.success("Sent")).catch((e) => toast.error((e as Error).message))}>{t("auth.resend")}</button><button className="btn btn-link btn-sm p-0 ms-auto" onClick={() => refresh()}><i className="bi bi-arrow-clockwise" /></button></div>
        )}
        <div className="xz-content"><Outlet /></div>
        <nav className="xz-bottomnav">{items.map((i) => <NavLink key={i.to} to={i.to} className={({ isActive }) => (isActive ? "active" : "")}><i className={`bi ${i.icon} fs-5`} />{i.label}</NavLink>)}</nav>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
export default function AppLayout() { return <AppDataProvider><Shell /></AppDataProvider>; }
