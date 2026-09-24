import { useMemo, useState } from 'react'
import type { Interest } from '../types'
import { DESTINATIONS, INTEREST_LABELS } from '../data/destinations'
import { DestinationCard } from '../components/DestinationCard'

const FILTERS: Interest[] = ['beach', 'food', 'nature', 'family', 'adventure', 'culture', 'shopping', 'themeparks']

export default function DestinationsPage() {
  const [scope, setScope] = useState<'all' | 'my' | 'intl'>('all')
  const [interests, setInterests] = useState<Interest[]>([])
  const [maxBudget, setMaxBudget] = useState(0)

  const list = useMemo(() => DESTINATIONS.filter((d) => {
    if (d.id === 'kuala-lumpur') return false
    if (scope === 'my' && d.international) return false
    if (scope === 'intl' && !d.international) return false
    if (interests.length > 0 && !interests.some((i) => d.tags.includes(i))) return false
    const est = estPerPerson(d)
    if (maxBudget > 0 && est > maxBudget) return false
    return true
  }), [scope, interests, maxBudget])

  function estPerPerson(d: typeof DESTINATIONS[number]): number {
    const nights = Math.round((d.recommendedNights[0] + d.recommendedNights[1]) / 2)
    const hotel = (d.hotelPerNight.value * nights) / 2
    const food = d.meals.reduce((a, b) => a + b, 0) * (nights + 1)
    const transport = d.flightFromKL ? d.flightFromKL * 2 : 180
    const acts = d.activities.filter((a) => a.category !== 'optional').reduce((a, x) => a + x.price, 0)
    return Math.round(hotel + food + transport + acts)
  }

  return (
    <div className="container py-4">
      <h1 className="h3 fw-bold mb-1">Discover destinations</h1>
      <p className="rt-muted mb-4">Filter by what you love and what you can spend — every card shows a realistic per-person estimate.</p>

      <div className="card p-3 mb-4">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div className="btn-group" role="group" aria-label="Scope">
            {([['all', 'All'], ['my', 'Malaysia'], ['intl', 'International']] as const).map(([id, label]) => (
              <button key={id} className={`btn btn-sm ${scope === id ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setScope(id)} aria-pressed={scope === id}>{label}</button>
            ))}
          </div>
          <div className="vr d-none d-md-block" />
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`rt-chip ${interests.includes(f) ? 'active' : ''}`}
              onClick={() => setInterests((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
              aria-pressed={interests.includes(f)}
            >
              <i className={`bi ${INTEREST_LABELS[f].icon}`} aria-hidden="true" />{INTEREST_LABELS[f].label}
            </button>
          ))}
          <div className="ms-md-auto d-flex align-items-center gap-2">
            <label htmlFor="max-budget" className="small rt-muted mb-0">Max RM/person</label>
            <select id="max-budget" className="form-select form-select-sm" style={{ width: 110 }} value={maxBudget} onChange={(e) => setMaxBudget(Number(e.target.value))}>
              <option value={0}>Any</option>
              <option value={800}>RM800</option>
              <option value={1500}>RM1,500</option>
              <option value={2500}>RM2,500</option>
              <option value={4000}>RM4,000</option>
            </select>
          </div>
        </div>
      </div>

      <p className="small rt-muted mb-3" aria-live="polite">{list.length} destination{list.length === 1 ? '' : 's'} match</p>
      {list.length === 0 ? (
        <div className="card p-5 text-center">
          <i className="bi bi-binoculars fs-1 rt-muted" aria-hidden="true" />
          <p className="mt-3 mb-1 fw-semibold">No destinations match those filters.</p>
          <p className="rt-muted small mb-0">Try removing an interest or raising the budget cap.</p>
        </div>
      ) : (
        <div className="row g-3">
          {list.map((d) => (
            <div className="col-sm-6 col-lg-4 col-xl-3" key={d.id}>
              <DestinationCard dest={d} estPerPerson={estPerPerson(d)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
