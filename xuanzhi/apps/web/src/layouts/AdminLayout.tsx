import { NavLink, Outlet, Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { useT } from "@/i18n";
import { LanguageSwitch, ThemeToggle } from "./MarketingLayout";
import { useState } from "react";

export default function AdminLayout() {
  const { t } = useT(); const [open, setOpen] = useState(false);
  const items = [
    ["/admin", "bi-speedometer2", t("admin.dashboard")], ["/admin/users", "bi-people", t("admin.users")], ["/admin/organizations", "bi-building", t("admin.organizations")], ["/admin/models", "bi-cpu", t("admin.models")], ["/admin/plans", "bi-gem", t("admin.plans")],
    ["/admin/knowledge", "bi-journal-bookmark", t("admin.knowledge")], ["/admin/categories", "bi-tags", t("admin.categories")], ["/admin/prompts", "bi-chat-square-quote", t("admin.prompts")], ["/admin/usage", "bi-bar-chart", t("admin.usage")], ["/admin/analytics", "bi-graph-up", t("admin.analytics")], ["/admin/settings", "bi-sliders", t("admin.settings")], ["/admin/audit", "bi-shield-check", t("admin.audit")],
  ] as const;
  return (
    <div className="xz-app">
      {open && <div className="xz-backdrop d-lg-none" onClick={() => setOpen(false)} />}
      <aside className={`xz-sidebar ${open ? "open" : ""}`}>
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom"><Brand to="/admin" /><span className="badge badge-cinnabar">Admin</span></div>
        <nav className="xz-nav list">{items.map(([to, icon, label]) => <NavLink key={to} to={to} end={to === "/admin"} className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setOpen(false)}><i className={`bi ${icon}`} />{label}</NavLink>)}</nav>
        <div className="border-top p-2 d-flex align-items-center gap-2"><Link to="/app" className="btn btn-ghost btn-sm flex-grow-1 text-start"><i className="bi bi-arrow-left me-2" />{t("admin.back")}</Link><LanguageSwitch compact /><ThemeToggle /></div>
      </aside>
      <div className="xz-main">
        <div className="xz-topbar d-lg-none"><button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><i className="bi bi-list fs-5" /></button><Brand to="/admin" /></div>
        <div className="xz-content"><div className="xz-page" style={{ maxWidth: 1200 }}><Outlet /></div></div>
      </div>
    </div>
  );
}
