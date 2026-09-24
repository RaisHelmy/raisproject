import { NavLink, Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const NAV = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/discover', label: 'Discover', icon: '🍽️' },
  { to: '/meal-plan', label: 'Plan', icon: '📅' },
  { to: '/pantry', label: 'Pantry', icon: '🧊' },
  { to: '/shopping', label: 'Shopping', icon: '🛒' },
];

const SIDE_EXTRA = [
  { to: '/travel', label: 'Travel Food', icon: '🚗' },
  { to: '/budget', label: 'Budget', icon: '💰' },
  { to: '/compare', label: 'Cook vs Buy', icon: '⚖️' },
  { to: '/favorites', label: 'Favorites', icon: '❤️' },
  { to: '/history', label: 'History', icon: '🕘' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar d-none d-lg-flex flex-column">
        <Link to="/" className="brand text-decoration-none">
          <span className="brand-mark">🍚</span>
          <span className="brand-name">rais<b>eat</b></span>
        </Link>
        <nav className="nav flex-column gap-1 mt-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="side-link">
              <span className="me-2">{n.icon}</span>{n.label}
            </NavLink>
          ))}
          <hr className="my-2" />
          {SIDE_EXTRA.map((n) => (
            <NavLink key={n.to} to={n.to} className="side-link">
              <span className="me-2">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto small text-muted px-3 pb-3">
          <span className="badge text-bg-light border">Demo data</span>
          <div className="mt-1">Prices are local estimates, not live.</div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar d-lg-none">
          <Link to="/" className="brand text-decoration-none">
            <span className="brand-mark">🍚</span>
            <span className="brand-name">rais<b>eat</b></span>
          </Link>
          <div className="d-flex gap-2">
            <Link to="/travel" className="btn btn-sm btn-outline-secondary" aria-label="Travel food">🚗</Link>
            <Link to="/settings" className="btn btn-sm btn-outline-secondary" aria-label="Settings">⚙️</Link>
          </div>
        </header>

        <main className="app-content">{children}</main>

        <nav className="bottom-nav d-lg-none" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="bottom-link">
              <span className="bn-icon" aria-hidden>{n.icon}</span>
              <span className="bn-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
