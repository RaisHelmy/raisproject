import { Link } from 'react-router-dom'
import type { RouteTemplate } from '../types'
import { DEST_MAP, INTEREST_LABELS } from '../data/destinations'
import { rm } from '../utils/format'

export function RouteCard({ route }: { route: RouteTemplate }) {
  const first = DEST_MAP[route.stops[0]?.destId]
  return (
    <Link to={`/routes/${route.slug}`} className="card rt-card-hover h-100 text-reset d-block">
      <div className="rt-dest-art" style={{ background: first?.gradient ?? 'linear-gradient(135deg,#134e5e,#71b280)', height: 110 }}>
        <span className="emoji" style={{ fontSize: '2.2rem' }} aria-hidden="true">
          {route.stops.map((s) => DEST_MAP[s.destId]?.emoji).join(' ')}
        </span>
        {route.popularity === 5 && <span className="badge text-bg-light fw-semibold align-self-start">★ Popular</span>}
      </div>
      <div className="card-body">
        <h3 className="h6 fw-bold mb-1">{route.name}</h3>
        <p className="rt-muted small mb-2">
          {route.days} Days / {route.days - 1} Nights · {route.season}
        </p>
        <div className="d-flex flex-wrap gap-1 mb-3">
          {route.bestFor.slice(0, 3).map((t) => (
            <span key={t} className="rt-badge-soft">{INTEREST_LABELS[t].label}</span>
          ))}
        </div>
        <div className="d-flex justify-content-between align-items-end">
          <span>
            <span className="rt-muted d-block" style={{ fontSize: '0.72rem' }}>Estimated from</span>
            <span className="rt-price text-success">{rm(route.estPerPerson)}<span className="rt-muted fw-normal small">/person</span></span>
          </span>
          <span className="btn btn-sm btn-outline-primary">View Route</span>
        </div>
      </div>
    </Link>
  )
}
