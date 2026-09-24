import { useState } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import { DemoPill } from '../components/Badges'
import { setDisplayCurrency, usePlanner } from '../hooks/usePlanner'
import { SUPPORTED_CURRENCIES } from '../services/currencyApi'

const NAV = [
  { to: '/plan', label: 'Plan Trip' },
  { to: '/destinations', label: 'Destinations' },
  { to: '/routes', label: 'Routes' },
  { to: '/trips', label: 'My Trips' },
  { to: '/alerts', label: 'Price Alerts' },
]

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const { displayCurrency } = usePlanner()
  const location = useLocation()

  return (
    <div className="d-flex flex-column min-vh-100">
      <a href="#main" className="visually-hidden-focusable position-absolute p-2 bg-white">Skip to content</a>
      <nav className="navbar navbar-expand-lg rt-navbar sticky-top" aria-label="Main navigation">
        <div className="container">
          <Link to="/" className="rt-brand navbar-brand">
            <i className="bi bi-compass me-1" aria-hidden="true" />RaisTravel
          </Link>
          <button
            className="navbar-toggler border-0"
            type="button"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen(!open)}
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className={`collapse navbar-collapse ${open ? 'show' : ''}`}>
            <ul className="navbar-nav mx-auto gap-1">
              {NAV.map((n) => (
                <li className="nav-item" key={n.to}>
                  <NavLink
                    to={n.to}
                    className={({ isActive }) => `nav-link ${isActive || (n.to === '/plan' && location.pathname.startsWith('/plan')) ? 'active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="d-flex align-items-center gap-2">
              <DemoPill />
              <label className="visually-hidden" htmlFor="currency-select">Display currency</label>
              <select
                id="currency-select"
                className="form-select form-select-sm"
                style={{ width: 90 }}
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Link to="/providers" className="btn btn-sm btn-outline-primary" title="Provider status">
                <i className="bi bi-gear" aria-hidden="true" /><span className="visually-hidden">Provider status</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main id="main" className="flex-grow-1">
        <Outlet />
      </main>
      <footer className="border-top py-4 mt-5" style={{ background: '#fff' }}>
        <div className="container d-flex flex-wrap justify-content-between align-items-center gap-2 small rt-muted">
          <span><i className="bi bi-compass me-1" aria-hidden="true" />RaisTravel — plan your DIY trip and know your cost before you go.</span>
          <span>Demo build · prices are estimates, not live quotes · <Link to="/providers">Provider status</Link></span>
        </div>
      </footer>
    </div>
  )
}
