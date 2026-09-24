import { Link, NavLink, Outlet } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/services/auth";
import { useT, LOCALE_LABELS } from "@/i18n";
import { usePrefs } from "@/services/prefs";
import type { Locale } from "@xuanzhi/shared-types";

export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { locale, setLocale } = usePrefs();
  return <select className={`form-select form-select-sm ${compact ? "w-auto" : ""}`} value={locale} aria-label="Language" onChange={(e) => setLocale(e.target.value as Locale)}>{(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}</select>;
}
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = usePrefs();
  return <button className="btn btn-ghost btn-sm" aria-label="Theme" title={theme} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><i className={`bi ${resolvedTheme === "dark" ? "bi-sun" : "bi-moon"}`} /></button>;
}

export default function MarketingLayout() {
  const { user } = useAuth(); const { t } = useT();
  return (
    <div className="d-flex flex-column min-vh-100">
      <header className="border-bottom" style={{ background: "color-mix(in srgb, var(--xz-paper) 85%, transparent)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 20 }}>
        <div className="container d-flex align-items-center gap-3 py-2">
          <Brand tagline />
          <nav className="d-none d-md-flex gap-1 ms-3">
            <NavLink to="/explore" className={({ isActive }) => `btn btn-ghost btn-sm ${isActive ? "fw-semibold" : ""}`}>{t("nav.explore")}</NavLink>
            <NavLink to="/pricing" className={({ isActive }) => `btn btn-ghost btn-sm ${isActive ? "fw-semibold" : ""}`}>{t("nav.pricing")}</NavLink>
          </nav>
          <div className="ms-auto d-flex align-items-center gap-2">
            <LanguageSwitch compact /><ThemeToggle />
            {user ? <Link to="/app" className="btn btn-primary btn-sm">{t("nav.chats")}</Link> : <><Link to="/login" className="btn btn-ghost btn-sm">{t("nav.login")}</Link><Link to="/register" className="btn btn-primary btn-sm">{t("nav.register")}</Link></>}
          </div>
        </div>
      </header>
      <main className="flex-grow-1"><Outlet /></main>
      <footer className="border-top py-4 mt-5">
        <div className="container d-flex flex-column flex-md-row gap-2 justify-content-between text-muted fs-13">
          <span>© {new Date().getFullYear()} 玄知 AI · XuanZhi AI</span>
          <span className="text-faint">{t("landing.footer")}</span>
        </div>
      </footer>
    </div>
  );
}
