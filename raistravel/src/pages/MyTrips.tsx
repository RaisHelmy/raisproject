import { Link } from 'react-router-dom'
import { useTrips, deleteTrip } from '../hooks/useTrips'
import { DEST_MAP } from '../data/destinations'
import { headCount } from '../features/budget/engine'
import { plural, rm } from '../utils/format'
import { STATUS_META } from '../utils/tripStatus'

export default function MyTrips() {
  const { trips } = useTrips()

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <h1 className="h3 fw-bold mb-0">My Trips</h1>
        <Link to="/plan" className="btn btn-primary"><i className="bi bi-plus-lg me-1" aria-hidden="true" />Plan a new trip</Link>
      </div>
      <p className="rt-muted mb-4">Saved plans, bookings and actual spending — all in one place.</p>

      {trips.length === 0 ? (
        <div className="card p-5 text-center">
          <i className="bi bi-suitcase fs-1 rt-muted" aria-hidden="true" />
          <h2 className="h5 mt-3">No trips saved yet</h2>
          <p className="rt-muted">Plan a trip and hit "Save Trip" — it'll appear here with expense tracking.</p>
          <div><Link to="/plan" className="btn btn-primary">Start planning</Link></div>
        </div>
      ) : (
        <div className="row g-3">
          {trips.map((t) => {
            const spent = t.expenses.reduce((a, e) => a + e.amount, 0)
            const heads = Math.max(1, headCount(t.input.travellers) - t.input.travellers.infants)
            const first = DEST_MAP[t.input.stops[0]]
            return (
              <div className="col-md-6 col-lg-4" key={t.id}>
                <div className="card rt-card-hover h-100 d-flex flex-column">
                  <div className="rt-dest-art" style={{ background: first?.gradient ?? 'linear-gradient(135deg,#134e5e,#71b280)', height: 84 }}>
                    <span className="emoji" style={{ fontSize: '1.8rem' }} aria-hidden="true">
                      {t.input.stops.map((s) => DEST_MAP[s]?.emoji).join(' ')}
                    </span>
                    <span className={`badge ${STATUS_META[t.status].class} align-self-start`}>{STATUS_META[t.status].label}</span>
                  </div>
                  <div className="card-body d-flex flex-column">
                    <h2 className="h6 fw-bold mb-1"><Link to={`/trips/${t.id}`} className="text-reset stretched-link">{t.name}</Link></h2>
                    <div className="small rt-muted mb-2">
                      {plural(t.input.days, 'day')} · {plural(heads, 'traveller')} · {rm(Math.round(t.estimatedTotal / heads))}/person
                    </div>
                    <div className="small mt-auto d-flex justify-content-between align-items-center">
                      <span>Est. <b>{rm(t.estimatedTotal)}</b>{spent > 0 && <> · Spent <b>{rm(spent)}</b></>}</span>
                      <button
                        className="btn btn-sm btn-outline-danger position-relative rt-no-print"
                        style={{ zIndex: 2 }}
                        onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${t.name}"?`)) deleteTrip(t.id) }}
                        aria-label={`Delete ${t.name}`}
                      >
                        <i className="bi bi-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
