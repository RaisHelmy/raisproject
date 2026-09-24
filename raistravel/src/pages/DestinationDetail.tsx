import { Link, useNavigate, useParams } from 'react-router-dom'
import { DESTINATIONS, INTEREST_LABELS } from '../data/destinations'
import { StarRating } from '../components/Badges'
import { DEFAULT_INPUT, resetInput, getInput } from '../hooks/usePlanner'
import { monthNames, rm } from '../utils/format'

export default function DestinationDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const dest = DESTINATIONS.find((d) => d.slug === slug)
  if (!dest) {
    return (
      <div className="container py-5 text-center">
        <h1 className="h4">Destination not found</h1>
        <Link to="/destinations" className="btn btn-primary mt-2">Browse destinations</Link>
      </div>
    )
  }

  function planHere() {
    if (!dest) return
    resetInput({
      ...DEFAULT_INPUT,
      ...getInput(),
      mode: 'destination',
      stops: [dest.id],
      days: dest.recommendedNights[1] + 1,
      interests: dest.tags.slice(0, 3),
    })
    navigate('/plan/results')
  }

  const tiers = [
    ['Budget', dest.hotelPerNight.budget], ['Value', dest.hotelPerNight.value],
    ['Comfort', dest.hotelPerNight.comfort], ['Premium', dest.hotelPerNight.premium],
  ] as const

  return (
    <div>
      <div className="rt-dest-art" style={{ background: dest.gradient, height: 220, borderRadius: 0 }}>
        <div className="container d-flex justify-content-between align-items-end h-100 pb-3">
          <div className="text-white">
            <h1 className="fw-bold mb-1" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>{dest.emoji} {dest.name}</h1>
            <p className="mb-0 fw-semibold" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>{dest.tagline} · {dest.country}</p>
          </div>
          <button className="btn btn-accent btn-lg rt-no-print" onClick={planHere}>
            <i className="bi bi-stars me-2" aria-hidden="true" />Plan a trip here
          </button>
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-4">
          <div className="col-lg-8">
            <p className="fs-5">{dest.description}</p>
            <div className="d-flex flex-wrap gap-2 mb-4">
              {dest.tags.map((t) => (
                <span key={t} className="rt-badge-soft"><i className={`bi ${INTEREST_LABELS[t].icon} me-1`} aria-hidden="true" />{INTEREST_LABELS[t].label}</span>
              ))}
            </div>

            <h2 className="h5 fw-bold mb-3">Things to do</h2>
            <div className="card p-3 mb-4">
              {dest.activities.map((a) => (
                <div key={a.name} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                  <div>
                    <span className="fw-semibold">{a.name}</span>
                    <span className={`ms-2 badge ${a.category === 'mandatory' ? 'text-bg-success' : a.category === 'recommended' ? 'rt-badge-soft' : 'text-bg-light'}`}>
                      {a.category === 'mandatory' ? 'Must-do' : a.category}
                    </span>
                    <div className="small rt-muted">~{a.durationH}h · {INTEREST_LABELS[a.interest].label}</div>
                  </div>
                  <span className="rt-price">{a.price === 0 ? 'Free' : `${rm(a.price)}/pax`}</span>
                </div>
              ))}
            </div>

            <h2 className="h5 fw-bold mb-3">Typical daily food cost <span className="rt-muted fs-6 fw-normal">(per person, value tier)</span></h2>
            <div className="card p-3 mb-4">
              <div className="row text-center g-2">
                {(['Breakfast', 'Lunch', 'Dinner', 'Drinks', 'Snacks'] as const).map((label, i) => (
                  <div className="col" key={label}>
                    <div className="rt-price">{rm(dest.meals[i])}</div>
                    <div className="small rt-muted">{label}</div>
                  </div>
                ))}
                <div className="col border-start">
                  <div className="rt-price text-success">{rm(dest.meals.reduce((a, b) => a + b, 0))}</div>
                  <div className="small rt-muted">Per day</div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4 d-grid gap-3 align-content-start">
            <div className="card p-4">
              <h2 className="h6 fw-bold mb-3">At a glance</h2>
              <ul className="list-unstyled d-grid gap-2 small mb-0">
                <li><i className="bi bi-calendar3 text-primary me-2" aria-hidden="true" />Ideal stay: <b>{dest.recommendedNights[0]}–{dest.recommendedNights[1]} nights</b></li>
                <li><i className="bi bi-sun text-primary me-2" aria-hidden="true" />Best months: <b>{monthNames(dest.bestMonths)}</b></li>
                <li><i className="bi bi-speedometer2 text-primary me-2" aria-hidden="true" />Difficulty: <b className="text-capitalize">{dest.difficulty}</b></li>
                <li><i className="bi bi-people text-primary me-2" aria-hidden="true" />Family friendly: <b>{dest.familyFriendly ? 'Yes' : 'Better for adults'}</b></li>
                {dest.international && <li><i className="bi bi-passport text-primary me-2" aria-hidden="true" />Passport needed · {dest.visaRequiredForMY ? 'visa may be required' : 'visa-free for Malaysians (verify before travel)'}</li>}
                {dest.flightFromKL && <li><i className="bi bi-airplane text-primary me-2" aria-hidden="true" />Flights from KL ≈ <b>{rm(dest.flightFromKL)}</b> one-way</li>}
              </ul>
            </div>
            <div className="card p-4">
              <h2 className="h6 fw-bold mb-3">Hotel price per night <span className="rt-muted small fw-normal">(per room, est.)</span></h2>
              {tiers.map(([label, price]) => (
                <div key={label} className="d-flex justify-content-between py-1 border-bottom small">
                  <span>{label}</span><span className="rt-price">{rm(price)}</span>
                </div>
              ))}
            </div>
            <div className="card p-4">
              <h2 className="h6 fw-bold mb-2">Ratings</h2>
              {Object.entries(dest.ratings).map(([k, v]) => (
                <div key={k} className="d-flex justify-content-between small py-1">
                  <span className="text-capitalize">{k}</span><StarRating value={v} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
