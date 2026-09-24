import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRoute } from '../data/routes'
import { DEST_MAP, INTEREST_LABELS } from '../data/destinations'
import { DEFAULT_INPUT, resetInput } from '../hooks/usePlanner'
import { computeLeg } from '../features/budget/engine'
import type { ComputedLeg, PlannerInput } from '../types'
import { RouteTimeline } from '../components/RouteTimeline'
import { RouteMap } from '../components/RouteMap'
import { StarRating } from '../components/Badges'
import { formatDuration, plural, rm } from '../utils/format'

export default function RouteDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const route = getRoute(slug ?? '')

  const preview = useMemo(() => {
    if (!route) return null
    const input: PlannerInput = {
      ...DEFAULT_INPUT,
      origin: route.origin,
      stops: route.stops.map((s) => s.destId),
      days: route.days,
    }
    const points = [route.origin, ...input.stops, route.origin]
    const legs: ComputedLeg[] = []
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i] === points[i + 1]) continue
      legs.push(computeLeg(points[i], points[i + 1], input, 'value'))
    }
    return { input, legs }
  }, [route])

  if (!route || !preview) {
    return (
      <div className="container py-5 text-center">
        <h1 className="h4">Route not found</h1>
        <Link to="/routes" className="btn btn-primary mt-2">Browse routes</Link>
      </div>
    )
  }

  const totalKm = preview.legs.reduce((a, l) => a + l.km, 0)
  const totalMin = preview.legs.reduce((a, l) => a + l.durationMin, 0)

  function useRoute() {
    if (!route) return
    resetInput({
      ...DEFAULT_INPUT,
      mode: 'destination',
      origin: route.origin,
      stops: route.stops.map((s) => s.destId),
      days: route.days,
      interests: route.bestFor,
    })
    navigate('/plan/results')
  }

  return (
    <div className="container py-4">
      <p className="rt-muted small mb-1"><Link to="/routes">Routes</Link> / {route.name}</p>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">{route.name}</h1>
          <p className="rt-muted mb-0">
            {route.days} Days / {route.days - 1} Nights · <StarRating value={route.popularity} />{route.popularity === 5 && ' Popular'}
          </p>
        </div>
        <div className="text-end">
          <div className="small rt-muted">Estimated from</div>
          <div className="rt-price fs-4 text-success">{rm(route.estPerPerson)}<span className="fs-6 rt-muted fw-normal">/person</span></div>
          <button className="btn btn-primary mt-1" onClick={useRoute}>
            <i className="bi bi-stars me-1" aria-hidden="true" />Customize this route
          </button>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <RouteMap origin={route.origin} stops={route.stops.map((s) => s.destId)} legs={preview.legs} />
          <div className="card p-4 mt-4">
            <p className="mb-3">{route.summary}</p>
            <div className="d-flex flex-wrap gap-2">
              {route.bestFor.map((t) => (
                <span key={t} className="rt-badge-soft"><i className={`bi ${INTEREST_LABELS[t].icon} me-1`} aria-hidden="true" />{INTEREST_LABELS[t].label}</span>
              ))}
            </div>
          </div>
          <div className="card p-4 mt-4">
            <h2 className="h6 fw-bold mb-3">Suggested stops</h2>
            {route.stops.map((s) => {
              const d = DEST_MAP[s.destId]
              if (!d) return null
              return (
                <div key={s.destId} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div>
                    <Link to={`/destinations/${d.slug}`} className="fw-semibold">{d.emoji} {d.name}</Link>
                    <div className="small rt-muted">{d.tagline}</div>
                  </div>
                  <span className="rt-badge-soft">{plural(s.nights, 'night')}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="col-lg-5 d-grid gap-4 align-content-start">
          <div className="card p-4">
            <h2 className="h6 fw-bold mb-3">Route facts</h2>
            <div className="row text-center g-2 mb-3">
              <div className="col-4"><div className="rt-price">{totalKm.toLocaleString()} km</div><div className="small rt-muted">Round trip</div></div>
              <div className="col-4"><div className="rt-price">{formatDuration(totalMin)}</div><div className="small rt-muted">Travel time</div></div>
              <div className="col-4"><div className="rt-price text-capitalize">{route.difficulty}</div><div className="small rt-muted">Difficulty</div></div>
            </div>
            <ul className="list-unstyled small d-grid gap-2 mb-0">
              <li><i className="bi bi-sun text-primary me-2" aria-hidden="true" />Best season: <b>{route.season}</b></li>
              <li><i className="bi bi-people text-primary me-2" aria-hidden="true" />Family suitability: <b className="text-capitalize">{route.familySuitability}</b></li>
              <li><i className="bi bi-signpost text-primary me-2" aria-hidden="true" />Recommended transport: <b>{route.recommendedTransport}</b></li>
            </ul>
          </div>
          <div className="card p-4">
            <h2 className="h6 fw-bold mb-3">Leg by leg</h2>
            <RouteTimeline legs={preview.legs} showCosts />
            <p className="small rt-muted mb-0 mt-2">Leg costs assume a sedan and 2 travellers at value tier — customize the route for your own numbers.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
