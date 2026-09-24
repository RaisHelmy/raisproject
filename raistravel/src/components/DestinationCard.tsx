import { Link } from 'react-router-dom'
import type { Destination } from '../types'
import { INTEREST_LABELS } from '../data/destinations'
import { rm, monthNames } from '../utils/format'
import { StarRating } from './Badges'

export function DestinationCard({ dest, estPerPerson, footer }: {
  dest: Destination
  estPerPerson?: number
  footer?: React.ReactNode
}) {
  const topRatings = Object.entries(dest.ratings).sort((a, b) => b[1] - a[1]).slice(0, 2)
  return (
    <Link to={`/destinations/${dest.slug}`} className="card rt-card-hover h-100 text-reset d-block">
      <div className="rt-dest-art" style={{ background: dest.gradient }}>
        <span className="emoji" aria-hidden="true">{dest.emoji}</span>
        {dest.international && (
          <span className="badge text-bg-light fw-semibold align-self-start">{dest.country}</span>
        )}
      </div>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <h3 className="h6 fw-bold mb-1">{dest.name}</h3>
          {estPerPerson !== undefined && (
            <span className="text-end small">
              <span className="rt-muted d-block" style={{ fontSize: '0.72rem' }}>from</span>
              <span className="rt-price text-success">{rm(estPerPerson)}</span>
            </span>
          )}
        </div>
        <p className="rt-muted small mb-2">{dest.tagline}</p>
        <div className="d-flex flex-wrap gap-1 mb-2">
          {dest.tags.slice(0, 3).map((t) => (
            <span key={t} className="rt-badge-soft">
              <i className={`bi ${INTEREST_LABELS[t].icon} me-1`} aria-hidden="true" />
              {INTEREST_LABELS[t].label}
            </span>
          ))}
        </div>
        <div className="small rt-muted">
          {topRatings.map(([k, v]) => (
            <span key={k} className="me-3 text-capitalize">
              {k} <StarRating value={v} />
            </span>
          ))}
        </div>
        <div className="small rt-muted mt-1">
          <i className="bi bi-calendar3 me-1" aria-hidden="true" />
          {dest.recommendedNights[0]}–{dest.recommendedNights[1]} nights · Best {monthNames(dest.bestMonths.slice(0, 3))}
        </div>
        {footer}
      </div>
    </Link>
  )
}
