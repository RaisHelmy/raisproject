import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Hotel, PlannerInput, TravelStyle, TripPlan } from '../types'
import { DEST_MAP, INTEREST_LABELS, ORIGINS } from '../data/destinations'
import { decodeInput, encodeInput, resetInput, updateInput, usePlanner } from '../hooks/usePlanner'
import { generatePlans } from '../features/trip-planner/generator'
import { suggestSavings } from '../features/budget/optimizer'
import { headCount, totalBudget, TIER_FACTORS } from '../features/budget/engine'
import { searchAllProviders, bestQuote } from '../services/accommodationApi'
import { flightProvider } from '../services/flightApi'
import type { FlightOption } from '../types'
import { getVehicle, VEHICLES, fuelCostForKm, evChargeStops } from '../data/vehicles'
import { affiliateUrl } from '../services/providers'
import { saveTrip } from '../hooks/useTrips'
import { formatInCurrency, RATES_UPDATED_AT } from '../services/currencyApi'
import { rm, plural, formatDuration, timeAgo } from '../utils/format'
import { BudgetDonut, DailySpendChart, CompareBars } from '../components/charts'
import { BudgetHealth } from '../components/BudgetHealth'
import { RouteTimeline } from '../components/RouteTimeline'
import { RouteMap } from '../components/RouteMap'
import { ConfidenceBadge, ProviderBadge, StarRating } from '../components/Badges'
import { SkeletonLines, SkeletonCards } from '../components/Skeletons'

const TABS = ['Overview', 'Itinerary', 'Hotels', 'Transport', 'Food & Activities', 'Budget', 'Bookings'] as const
type Tab = typeof TABS[number]

export default function Results() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { input, displayCurrency } = usePlanner()
  const [tab, setTab] = useState<Tab>('Overview')
  const [tier, setTier] = useState<TravelStyle | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  // Shared link support: /plan/results?t=<encoded input>
  useEffect(() => {
    const t = params.get('t')
    if (t) {
      const decoded = decodeInput(t)
      if (decoded) resetInput(decoded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const plans = useMemo(() => (input.stops.length > 0 ? generatePlans(input) : []), [input])
  const selected = plans.find((p) => p.tier === tier) ?? plans.find((p) => p.recommended) ?? plans[0]
  const budget = totalBudget(input)
  const suggestions = useMemo(
    () => (selected && budget > 0 && selected.breakdown.total > budget ? suggestSavings(input, selected.tier) : []),
    [input, selected, budget],
  )

  if (input.stops.length === 0) {
    return (
      <div className="container py-5 text-center">
        <i className="bi bi-signpost-split fs-1 rt-muted" aria-hidden="true" />
        <h1 className="h4 mt-3">No destinations selected yet</h1>
        <p className="rt-muted">Start the planner to build your trip.</p>
        <Link to="/plan" className="btn btn-primary">Open trip planner</Link>
      </div>
    )
  }
  if (!selected) return null

  const heads = headCount(input.travellers)
  const originName = ORIGINS.find((o) => o.id === input.origin)?.name ?? input.origin
  const routeName = input.stops.map((s) => DEST_MAP[s]?.name ?? s).join(' + ')

  function onSave() {
    if (!selected) return
    const trip = saveTrip(`${routeName} · ${plural(input.days, 'day')}`, input, selected.tier, selected.breakdown)
    setSaved(trip.id)
  }

  function onShare() {
    const url = `${location.origin}/plan/results?t=${encodeInput(input)}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  return (
    <div className="container py-4">
      {/* ---------- Header ---------- */}
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <div>
          <p className="rt-muted small mb-1">
            <Link to="/plan">Trip planner</Link> / Results
          </p>
          <h1 className="h3 fw-bold mb-1">Your {input.days}-Day {routeName} Trip</h1>
          <p className="rt-muted mb-0">
            From {originName} · {plural(heads, 'traveller')}
            {input.startDate ? ` · departing ${input.startDate}${input.flexibleDates ? ' (±3 days)' : ''}` : ''}
          </p>
        </div>
        <div className="text-lg-end">
          <div className="rt-price fs-3">{rm(selected.breakdown.total)}
            <span className="fs-6 rt-muted fw-normal"> total</span>
          </div>
          <div className="rt-muted small">
            {rm(selected.breakdown.perPerson)}/person
            {displayCurrency !== 'MYR' && (
              <span title={`Rates updated ${timeAgo(RATES_UPDATED_AT)} (demo rates)`}>
                {' '}≈ {formatInCurrency(selected.breakdown.total, displayCurrency)} total
              </span>
            )}
          </div>
          <div className="d-flex gap-2 mt-2 justify-content-lg-end rt-no-print">
            <button className="btn btn-sm btn-primary" onClick={onSave} disabled={!!saved}>
              <i className="bi bi-bookmark-plus me-1" aria-hidden="true" />{saved ? 'Saved' : 'Save Trip'}
            </button>
            <button className="btn btn-sm btn-outline-primary" onClick={onShare}>
              <i className="bi bi-share me-1" aria-hidden="true" />{shareCopied ? 'Link copied!' : 'Share'}
            </button>
            <button className="btn btn-sm btn-outline-primary" onClick={() => window.print()}>
              <i className="bi bi-printer me-1" aria-hidden="true" />Print / PDF
            </button>
          </div>
        </div>
      </div>
      {saved && (
        <div className="alert alert-success py-2 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-check-circle me-2" aria-hidden="true" />Trip saved to <b>My Trips</b> — track bookings and actual expenses there.</span>
          <Link to={`/trips/${saved}`} className="btn btn-sm btn-success">Open trip</Link>
        </div>
      )}

      {/* ---------- Plan tier comparison ---------- */}
      <div className="row g-3 mb-4">
        {plans.map((p) => (
          <div className="col-6 col-lg-3" key={p.tier}>
            <button
              className={`rt-mode-card h-100 position-relative ${selected.tier === p.tier ? 'active' : ''}`}
              onClick={() => setTier(p.tier)}
              aria-pressed={selected.tier === p.tier}
            >
              {p.recommended && (
                <span className="badge text-bg-success position-absolute top-0 start-50 translate-middle">Recommended</span>
              )}
              <div className="fw-bold">{p.label}</div>
              <div className="rt-price fs-5">{rm(p.breakdown.perPerson)}<span className="small rt-muted fw-normal">/person</span></div>
              <div className="small rt-muted">{rm(p.breakdown.total)} total</div>
              {budget > 0 && (
                <div className={`small fw-semibold mt-1 ${p.breakdown.total <= budget ? 'text-success' : 'text-danger'}`}>
                  {p.breakdown.total <= budget
                    ? <><i className="bi bi-check-circle me-1" aria-hidden="true" />{Math.round((p.breakdown.total / budget) * 100)}% of budget</>
                    : <><i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />{rm(p.breakdown.total - budget)} over</>}
                </div>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* ---------- Over-budget optimizer ---------- */}
      {suggestions.length > 0 && (
        <div className="card border-warning mb-4 p-3" style={{ background: '#fffdf5' }}>
          <div className="fw-bold mb-2">
            <i className="bi bi-lightbulb text-warning me-2" aria-hidden="true" />
            You're {rm(selected.breakdown.total - budget)} over budget — we found {suggestions.length} ways to reduce the cost:
          </div>
          <div className="row g-2">
            {suggestions.map((s) => (
              <div className="col-md-6" key={s.id}>
                <div className="d-flex justify-content-between align-items-center border rounded-3 p-2 bg-white h-100">
                  <div className="me-2">
                    <div className="fw-semibold small">{s.label}</div>
                    <div className="small rt-muted">{s.detail}</div>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <div className="text-success fw-bold small">Save {rm(s.saving)}</div>
                    <button
                      className="btn btn-sm btn-outline-success mt-1"
                      onClick={() => { updateInput(s.apply); if (s.apply.style) setTier(s.apply.style) }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Tabs ---------- */}
      <ul className="nav nav-tabs mb-4 rt-no-print" role="tablist">
        {TABS.map((t) => (
          <li className="nav-item" role="presentation" key={t}>
            <button
              className={`nav-link ${tab === t ? 'active' : ''}`}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'Overview' && <OverviewTab plan={selected} input={input} budget={budget} />}
      {tab === 'Itinerary' && <ItineraryTab plan={selected} input={input} />}
      {tab === 'Hotels' && <HotelsTab plan={selected} input={input} />}
      {tab === 'Transport' && <TransportTab plan={selected} input={input} />}
      {tab === 'Food & Activities' && <FoodActivitiesTab plan={selected} input={input} />}
      {tab === 'Budget' && <BudgetTab plan={selected} input={input} budget={budget} />}
      {tab === 'Bookings' && <BookingsTab plan={selected} input={input} onSave={onSave} savedId={saved} />}

      <div className="rt-no-print mt-4 text-center">
        <button className="btn btn-outline-primary" onClick={() => navigate('/plan')}>
          <i className="bi bi-pencil me-1" aria-hidden="true" />Adjust trip details
        </button>
      </div>
    </div>
  )
}

// ---------- Overview ----------

function OverviewTab({ plan, input, budget }: { plan: TripPlan; input: PlannerInput; budget: number }) {
  const fat = plan.fatigue
  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <RouteMap origin={input.origin} stops={input.stops} legs={plan.transport.legs} />
        <div className="card p-4 mt-4">
          <h2 className="h6 fw-bold mb-3"><i className="bi bi-stars text-primary me-2" aria-hidden="true" />Why we recommend this plan</h2>
          <ul className="mb-0 d-grid gap-1">
            {plan.explanations.map((e, i) => <li key={i}>{e}</li>)}
            {input.interests.length > 0 && (
              <li>Matches your interests: {input.interests.slice(0, 4).map((i) => INTEREST_LABELS[i].label).join(', ')}</li>
            )}
          </ul>
          <p className="small rt-muted mt-3 mb-0">
            <i className="bi bi-info-circle me-1" aria-hidden="true" />
            Smart recommendation based on your inputs and typical prices — not a live AI or live quotes.
          </p>
        </div>
      </div>
      <div className="col-lg-5 d-grid gap-4 align-content-start">
        {budget > 0 && (
          <div className="card p-4">
            <h2 className="h6 fw-bold mb-3">Budget health</h2>
            <BudgetHealth spent={plan.breakdown.total} budget={budget} />
          </div>
        )}
        <div className="card p-4">
          <h2 className="h6 fw-bold mb-3">Trip Score</h2>
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="rt-icon-circle" style={{ width: 64, height: 64, fontSize: '1.4rem', fontWeight: 800 }}>
              {plan.score.total}
            </div>
            <div>
              <div className="fw-bold">{plan.score.total} / 100</div>
              <div className="small rt-muted">{plan.score.total >= 85 ? 'Excellent plan' : plan.score.total >= 70 ? 'Solid plan' : 'Workable, with trade-offs'}</div>
            </div>
          </div>
          {[
            ['Budget', plan.score.budget], ['Convenience', plan.score.convenience],
            ['Experience', plan.score.experience], ['Travel time', plan.score.travelTime],
          ].map(([label, v]) => (
            <div key={label as string} className="d-flex align-items-center gap-2 mb-1">
              <span className="small rt-muted" style={{ width: 96 }}>{label}</span>
              <div className="progress flex-grow-1" style={{ height: 7 }}>
                <div className="progress-bar" style={{ width: `${v}%` }} />
              </div>
              <span className="small fw-semibold" style={{ width: 28 }}>{v}</span>
            </div>
          ))}
        </div>
        <div className={`card p-4 border-${fat.level === 'high' ? 'danger' : fat.level === 'moderate' ? 'warning' : 'success'}`}>
          <h2 className="h6 fw-bold mb-2">
            Travel intensity:{' '}
            <span className={`text-${fat.level === 'high' ? 'danger' : fat.level === 'moderate' ? 'warning' : 'success'} text-uppercase`}>{fat.level}</span>
          </h2>
          <p className="small mb-1">{fat.transportHours}h total transportation · {plural(fat.hotelChanges, 'hotel change')}</p>
          {fat.advice && <p className="small rt-muted mb-0"><i className="bi bi-lightbulb me-1" aria-hidden="true" />{fat.advice}</p>}
        </div>
      </div>
    </div>
  )
}

// ---------- Itinerary ----------

function ItineraryTab({ plan, input }: { plan: TripPlan; input: PlannerInput }) {
  const [activeDay, setActiveDay] = useState(1)
  const day = plan.itinerary.find((d) => d.day === activeDay) ?? plan.itinerary[0]
  const pax = headCount(input.travellers) - input.travellers.infants
  return (
    <div>
      <div className="d-flex gap-2 flex-wrap mb-4 rt-no-print" role="tablist" aria-label="Days">
        {plan.itinerary.map((d) => (
          <button
            key={d.day}
            className={`rt-chip ${d.day === day.day ? 'active' : ''}`}
            role="tab"
            aria-selected={d.day === day.day}
            onClick={() => setActiveDay(d.day)}
          >
            Day {d.day}
          </button>
        ))}
      </div>
      <div className="row g-4">
        <div className="col-lg-6">
          <h2 className="h5 fw-bold mb-1">Day {day.day} — {day.heading}</h2>
          <p className="small rt-muted mb-3">
            Est. day cost: {rm(day.items.reduce((a, i) => a + (i.costPerPerson ?? 0), 0) * pax)} for the group
          </p>
          <div className="rt-timeline">
            {day.items.map((item, i) => (
              <div className="rt-timeline-item" key={i}>
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <span className="fw-bold me-2">{item.time}</span>
                    <i className={`bi ${item.icon} text-primary me-1`} aria-hidden="true" />
                    <span className="fw-semibold">{item.title}</span>
                    <div className="small rt-muted">
                      {item.durationH ? `~${item.durationH}h` : ''}
                      {item.note ? `${item.durationH ? ' · ' : ''}${item.note}` : ''}
                    </div>
                  </div>
                  {item.costPerPerson !== undefined && item.costPerPerson > 0 && (
                    <span className="rt-badge-soft flex-shrink-0">{rm(item.costPerPerson)}/pax</span>
                  )}
                  {item.costPerPerson === 0 && <span className="rt-badge-soft flex-shrink-0">Free</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="small rt-muted rt-no-print">
            <i className="bi bi-info-circle me-1" aria-hidden="true" />
            Want to change something? Swap activities in the <b>Food &amp; Activities</b> tab, or adjust the trip to regenerate.
          </p>
        </div>
        <div className="col-lg-6">
          <RouteMap
            origin={input.origin}
            stops={[day.destId]}
            height={300}
          />
          <div className="card p-3 mt-3">
            <div className="small fw-bold text-uppercase rt-muted mb-2" style={{ letterSpacing: '0.05em' }}>Day {day.day} anchors</div>
            <ul className="small mb-0 list-unstyled d-grid gap-1">
              <li><i className="bi bi-building text-primary me-2" aria-hidden="true" />Hotel in {DEST_MAP[day.destId]?.name}</li>
              {day.items.filter((i) => i.kind === 'activity').slice(0, 3).map((i, k) => (
                <li key={k}><i className="bi bi-star text-primary me-2" aria-hidden="true" />{i.title}</li>
              ))}
              {day.items.filter((i) => i.kind === 'meal').slice(0, 2).map((i, k) => (
                <li key={k}><i className="bi bi-cup-hot text-primary me-2" aria-hidden="true" />{i.title}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Hotels ----------

function HotelsTab({ plan, input }: { plan: TripPlan; input: PlannerInput }) {
  const [destId, setDestId] = useState(input.stops[0])
  const [hotels, setHotels] = useState<Hotel[] | null>(null)
  const [error, setError] = useState(false)
  const stay = plan.hotelSummary.find((h) => h.destId === destId)

  useEffect(() => {
    let cancelled = false
    setHotels(null)
    setError(false)
    searchAllProviders({ destId, style: plan.tier, nights: stay?.nights ?? 2, rooms: stay?.rooms ?? 1 })
      .then((h) => { if (!cancelled) setHotels(h) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [destId, plan.tier, stay?.nights, stay?.rooms])

  const providers = ['Booking.com', 'Agoda', 'Expedia']
  const nights = stay?.nights ?? 2
  const rooms = stay?.rooms ?? 1
  const pax = headCount(input.travellers) - input.travellers.infants

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        {input.stops.map((s) => (
          <button key={s} className={`rt-chip ${s === destId ? 'active' : ''}`} onClick={() => setDestId(s)} aria-pressed={s === destId}>
            {DEST_MAP[s]?.emoji} {DEST_MAP[s]?.name}
          </button>
        ))}
        <span className="rt-muted small ms-auto">
          {plural(nights, 'night')} · {plural(rooms, 'room')} · {TIER_FACTORS[plan.tier].label} tier
        </span>
      </div>

      {error && <p className="alert alert-warning">We couldn't retrieve hotel prices. Your budget estimate of {rm(stay ? stay.perNight * nights * rooms : 0)} still applies.</p>}
      {!hotels && !error && <SkeletonCards count={3} message={`Searching hotels in ${DEST_MAP[destId]?.name} · comparing 3 providers…`} />}

      {hotels && (
        <>
          <div className="table-responsive card p-0">
            <table className="table table-hover align-middle mb-0">
              <caption className="visually-hidden">Hotel price comparison across providers, per night per room</caption>
              <thead>
                <tr>
                  <th scope="col">Hotel</th>
                  {providers.map((p) => <th scope="col" key={p} className="text-end">{p}</th>)}
                  <th scope="col" className="text-end">Total stay*</th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((h) => {
                  const best = bestQuote(h)
                  const totalStay = best.totalPrice * nights * rooms
                  return (
                    <tr key={h.id}>
                      <td>
                        <div className="fw-semibold">{h.name}</div>
                        <div className="small rt-muted">
                          <StarRating value={h.stars} /> · {h.rating}/10 ({h.reviews.toLocaleString()} reviews) · {h.roomType} (sleeps {h.sleeps})
                        </div>
                        <div className="small d-flex flex-wrap gap-2 mt-1">
                          {h.freeCancellation && <span className="rt-badge-soft">Free cancellation</span>}
                          {h.breakfastIncluded && <span className="rt-badge-soft">Breakfast included</span>}
                          {h.locationScore >= 9 && <span className="rt-badge-soft">Great location</span>}
                        </div>
                      </td>
                      {providers.map((p) => {
                        const q = h.quotes.find((x) => x.provider === p)
                        const isBest = q && q.provider === best.provider
                        return (
                          <td key={p} className={`text-end ${isBest ? 'rt-compare-highlight' : ''}`}>
                            {q ? (
                              <>
                                <div className="rt-price">{rm(q.totalPrice)}</div>
                                <div className="small rt-muted">/night · incl. {rm(q.taxes + q.fees)} taxes &amp; fees</div>
                                {isBest && <span className="badge text-bg-success mt-1">Lowest</span>}
                              </>
                            ) : <span className="rt-muted">—</span>}
                          </td>
                        )
                      })}
                      <td className="text-end">
                        <div className="rt-price">{rm(totalStay)}</div>
                        <div className="small rt-muted">{rm(Math.round(totalStay / pax))}/person</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-center mt-2 small rt-muted">
            <span>*Total for {plural(nights, 'night')} × {plural(rooms, 'room')}, best provider price.</span>
            <ConfidenceBadge confidence="estimated" />
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Transport ----------

function TransportTab({ plan, input }: { plan: TripPlan; input: PlannerInput }) {
  const vehicle = getVehicle(input.vehicleId)
  const [flights, setFlights] = useState<FlightOption[] | null>(null)
  const [flightSort, setFlightSort] = useState<'cheapest' | 'fastest'>('cheapest')
  const flightLeg = plan.transport.legs.find((l) => l.mode === 'flight')
  const pax = headCount(input.travellers) - input.travellers.infants
  const driveKm = plan.transport.legs.filter((l) => l.mode === 'car' || l.mode === 'ev' || l.mode === 'ferry').reduce((a, l) => a + l.km, 0)

  useEffect(() => {
    if (!flightLeg) { setFlights(null); return }
    let cancelled = false
    setFlights(null)
    const fromId = input.origin
    const toId = input.stops.find((s) => DEST_MAP[s]?.name === flightLeg.toName) ?? input.stops[input.stops.length - 1]
    flightProvider.searchFlights({ fromId, toId, fromName: flightLeg.fromName })
      .then((f) => { if (!cancelled) setFlights(f) })
      .catch(() => { if (!cancelled) setFlights([]) })
    return () => { cancelled = true }
  }, [flightLeg, input.origin, input.stops])

  const sortedFlights = flights ? [...flights].sort((a, b) =>
    flightSort === 'cheapest' ? a.quote.totalPrice - b.quote.totalPrice : a.durationMin - b.durationMin,
  ) : null

  const evVehicle = VEHICLES.find((v) => v.id === 'ev')!
  const petrolVehicle = VEHICLES.find((v) => v.id === 'sedan')!

  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <div className="card p-4">
          <h2 className="h6 fw-bold mb-3">Route &amp; legs</h2>
          <RouteTimeline legs={plan.transport.legs} showCosts />
          <div className="rt-divider mt-3 pt-3 row text-center g-2">
            <div className="col-4"><div className="rt-price">{plan.transport.totalKm.toLocaleString()} km</div><div className="small rt-muted">Total distance</div></div>
            <div className="col-4"><div className="rt-price">{formatDuration(plan.transport.totalDriveMin)}</div><div className="small rt-muted">Travel time</div></div>
            <div className="col-4"><div className="rt-price">{rm(plan.transport.totalCost)}</div><div className="small rt-muted">{rm(Math.round(plan.transport.totalCost / pax))}/person</div></div>
          </div>
        </div>
        <div className="card p-4 mt-4">
          <h2 className="h6 fw-bold mb-3">Transport mode</h2>
          <div className="btn-group w-100" role="group" aria-label="Transport preference">
            {([['best', 'Best mix'], ['drive', 'Drive'], ['public', 'Bus/train'], ['fly', 'Fly']] as const).map(([id, label]) => (
              <button
                key={id}
                className={`btn ${input.transportPreference === id ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => updateInput({ transportPreference: id })}
                aria-pressed={input.transportPreference === id}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="small rt-muted mt-2 mb-0">Changing this recalculates the whole trip cost.</p>
        </div>
      </div>

      <div className="col-lg-6 d-grid gap-4 align-content-start">
        <div className="card p-4">
          <h2 className="h6 fw-bold mb-3"><i className="bi bi-fuel-pump me-2 text-primary" aria-hidden="true" />Driving cost calculator</h2>
          <label className="form-label" htmlFor="veh">Vehicle</label>
          <select id="veh" className="form-select mb-3" value={input.vehicleId} onChange={(e) => updateInput({ vehicleId: e.target.value })}>
            {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <table className="table table-sm mb-0">
            <tbody>
              <tr><td>Driving distance</td><td className="text-end rt-price">{driveKm.toLocaleString()} km</td></tr>
              <tr>
                <td>{vehicle.kind === 'ev' ? 'Consumption' : 'Fuel consumption'}</td>
                <td className="text-end">{vehicle.consumption} {vehicle.kind === 'ev' ? 'kWh/100km' : 'km/L'}</td>
              </tr>
              <tr>
                <td>{vehicle.kind === 'ev' ? 'Charging price' : 'Fuel price'}</td>
                <td className="text-end">RM{vehicle.fuelPrice.toFixed(2)}/{vehicle.kind === 'ev' ? 'kWh' : 'L'}</td>
              </tr>
              <tr><td>{vehicle.kind === 'ev' ? 'Charging cost' : 'Fuel cost'}</td><td className="text-end rt-price">{rm(Math.round(fuelCostForKm(vehicle, driveKm)))}</td></tr>
              {vehicle.kind === 'ev' && (
                <tr><td>Charging stops (est.)</td><td className="text-end">{evChargeStops(driveKm)} × ~35 min</td></tr>
              )}
              <tr><td>Tolls (est.)</td><td className="text-end rt-price">{rm(plan.transport.tollCost)}</td></tr>
              <tr><td>Parking (est.)</td><td className="text-end rt-price">{rm(plan.transport.parkingCost)}</td></tr>
              <tr className="fw-bold border-top"><td>Total driving cost</td><td className="text-end rt-price">{rm(Math.round(fuelCostForKm(vehicle, driveKm)) + plan.transport.tollCost + plan.transport.parkingCost)}</td></tr>
              <tr><td className="rt-muted">Per person ({pax})</td><td className="text-end rt-muted">{rm(Math.round((fuelCostForKm(vehicle, driveKm) + plan.transport.tollCost + plan.transport.parkingCost) / pax))}</td></tr>
            </tbody>
          </table>
          {driveKm > 0 && (
            <div className="alert alert-light border small mb-0 mt-3">
              <b>EV vs petrol on this route:</b>{' '}
              EV ≈ {rm(Math.round(fuelCostForKm(evVehicle, driveKm)))} (public DC) vs sedan ≈ {rm(Math.round(fuelCostForKm(petrolVehicle, driveKm)))} fuel —
              {' '}{fuelCostForKm(evVehicle, driveKm) < fuelCostForKm(petrolVehicle, driveKm)
                ? `save ${rm(Math.round(fuelCostForKm(petrolVehicle, driveKm) - fuelCostForKm(evVehicle, driveKm)))} with EV`
                : 'similar cost'}; home charging cuts the EV cost roughly in half again.
            </div>
          )}
        </div>

        {flightLeg && (
          <div className="card p-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h6 fw-bold mb-0"><i className="bi bi-airplane me-2 text-primary" aria-hidden="true" />Flights: {flightLeg.fromName} → {flightLeg.toName}</h2>
              <select className="form-select form-select-sm" style={{ width: 120 }} value={flightSort} onChange={(e) => setFlightSort(e.target.value as 'cheapest' | 'fastest')} aria-label="Sort flights">
                <option value="cheapest">Cheapest</option>
                <option value="fastest">Fastest</option>
              </select>
            </div>
            {!sortedFlights && <SkeletonLines count={4} message="Comparing airlines…" />}
            {sortedFlights?.map((f, i) => (
              <div key={f.id} className={`d-flex justify-content-between align-items-center py-2 ${i > 0 ? 'border-top' : ''}`}>
                <div>
                  <div className="fw-semibold"><ProviderBadge name={f.airline} /> <span className="ms-1">{f.departTime} → {f.arriveTime}</span></div>
                  <div className="small rt-muted">{formatDuration(f.durationMin)} · {f.stops === 0 ? 'Direct' : `${f.stops} stop`} · {f.baggageKg}kg baggage</div>
                </div>
                <div className="text-end">
                  <div className="rt-price">{rm(f.quote.totalPrice)}</div>
                  <div className="small rt-muted">/person one-way</div>
                </div>
              </div>
            ))}
            <div className="small mt-2"><ConfidenceBadge confidence="estimated" /></div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Food & Activities ----------

function FoodActivitiesTab({ plan, input }: { plan: TripPlan; input: PlannerInput }) {
  const pax = headCount(input.travellers) - input.travellers.infants
  const factor = TIER_FACTORS[plan.tier].food
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Drinks', 'Snacks']
  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <h2 className="h5 fw-bold mb-3">Food budget per person</h2>
        {plan.hotelSummary.map((s) => {
          const d = DEST_MAP[s.destId]
          if (!d) return null
          const daily = d.meals.reduce((a, b) => a + b * factor, 0)
          return (
            <div className="card p-3 mb-3" key={s.destId}>
              <div className="fw-bold mb-2">{d.emoji} {d.name} <span className="rt-muted fw-normal small">· {TIER_FACTORS[plan.tier].label} dining</span></div>
              <table className="table table-sm mb-2">
                <tbody>
                  {d.meals.map((m, i) => (
                    <tr key={i}><td>{MEALS[i]}</td><td className="text-end">{rm(Math.round(m * factor))}</td></tr>
                  ))}
                  <tr className="fw-bold border-top"><td>Est. food/day</td><td className="text-end">{rm(Math.round(daily))}/person</td></tr>
                </tbody>
              </table>
              <div className="small rt-muted">
                {s.nights + 0.5} days here → {rm(Math.round(daily * (s.nights + 0.5)))}/person · {rm(Math.round(daily * (s.nights + 0.5) * pax))} group
                {input.muslimFriendly && !['MY', 'ID'].includes(d.countryCode) && (
                  <div className="mt-1"><i className="bi bi-moon me-1" aria-hidden="true" />Halal options: community-reported availability in {d.name} — verify locally.</div>
                )}
              </div>
            </div>
          )
        })}
        <p className="small rt-muted">Estimates use typical local prices; street food can cost less, mall dining more.</p>
      </div>
      <div className="col-lg-7">
        <h2 className="h5 fw-bold mb-3">Activities &amp; experiences</h2>
        {plan.hotelSummary.map((s) => {
          const d = DEST_MAP[s.destId]
          if (!d) return null
          return (
            <div className="card p-3 mb-3" key={s.destId}>
              <div className="fw-bold mb-2">{d.emoji} {d.name}</div>
              {(['mandatory', 'recommended', 'optional'] as const).map((cat) => {
                const acts = d.activities.filter((a) => a.category === cat)
                if (acts.length === 0) return null
                return (
                  <div key={cat} className="mb-2">
                    <div className="small fw-bold text-uppercase rt-muted" style={{ letterSpacing: '0.05em' }}>
                      {cat === 'mandatory' ? 'Must-do' : cat === 'recommended' ? 'Recommended' : 'Optional (not in base budget)'}
                    </div>
                    {acts.map((a) => (
                      <div key={a.name} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                        <span>
                          <i className={`bi ${INTEREST_LABELS[a.interest].icon} text-primary me-2`} aria-hidden="true" />
                          {a.name} <span className="rt-muted small">· ~{a.durationH}h</span>
                        </span>
                        <span className="rt-price">{a.price === 0 ? 'Free' : `${rm(a.price)}/pax`}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Budget ----------

function BudgetTab({ plan, input, budget }: { plan: TripPlan; input: PlannerInput; budget: number }) {
  const b = plan.breakdown
  const donutData = [
    { name: 'Accommodation', y: b.accommodation },
    { name: 'Transport', y: b.transport },
    { name: 'Food', y: b.food },
    { name: 'Activities', y: b.activities },
    { name: 'Other', y: b.other + b.contingency },
  ].filter((x) => x.y > 0)

  const dailyLabels = plan.itinerary.map((d) => `Day ${d.day}`)
  const pax = headCount(input.travellers) - input.travellers.infants
  const perNight = b.accommodation / Math.max(1, input.days - 1)
  const foodPerDay = b.food / input.days
  const travelDays = plan.itinerary.filter((d) => d.heading.includes('→')).length || 1
  const daily = plan.itinerary.map((d) => {
    const items = d.items.reduce((a, i) => a + (i.costPerPerson ?? 0), 0) * pax
    const isTravel = d.heading.includes('→')
    return Math.round(items + (d.day < input.days ? perNight : 0) + foodPerDay * 0.4 + (isTravel ? b.transport / travelDays : 0))
  })

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="card p-4">
          <h2 className="h6 fw-bold mb-2">Where the money goes</h2>
          <BudgetDonut data={donutData} />
        </div>
        {budget > 0 && (
          <div className="card p-4 mt-4">
            <h2 className="h6 fw-bold mb-2">Budget vs estimate</h2>
            <CompareBars
              categories={['Total trip']}
              series={[
                { name: 'Budget', data: [budget], color: '#bcd9d2' },
                { name: 'Estimated', data: [b.total], color: '#0e7c66' },
              ]}
            />
          </div>
        )}
      </div>
      <div className="col-lg-7">
        <div className="card p-4">
          <h2 className="h6 fw-bold mb-2">Estimated daily spending (group)</h2>
          <DailySpendChart days={dailyLabels} values={daily} />
        </div>
        <div className="card p-4 mt-4">
          <h2 className="h6 fw-bold mb-3">Full cost breakdown</h2>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>Item</th><th className="text-end">Amount</th><th className="text-end d-none d-sm-table-cell">Status</th></tr></thead>
              <tbody>
                {b.detail.map((line, i) => (
                  <tr key={i}>
                    <td><span className="text-capitalize rt-muted small me-2">{line.category}</span>{line.label}</td>
                    <td className="text-end rt-price">{rm(line.amount)}</td>
                    <td className="text-end d-none d-sm-table-cell"><ConfidenceBadge confidence={line.confidence} /></td>
                  </tr>
                ))}
                <tr className="fw-bold border-top fs-6">
                  <td>Total trip cost</td>
                  <td className="text-end rt-price">{rm(b.total)}</td>
                  <td className="d-none d-sm-table-cell" />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="row text-center mt-3 g-2">
            <div className="col-6 col-md-3"><div className="rt-price">{rm(b.total)}</div><div className="small rt-muted">Total trip</div></div>
            <div className="col-6 col-md-3"><div className="rt-price">{rm(b.perPerson)}</div><div className="small rt-muted">Per person</div></div>
            <div className="col-6 col-md-3"><div className="rt-price">{rm(b.perDayGroup)}</div><div className="small rt-muted">Per day (group)</div></div>
            <div className="col-6 col-md-3"><div className="rt-price">{rm(b.perDayPerson)}</div><div className="small rt-muted">Per day/person</div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Bookings ----------

function BookingsTab({ plan, input, onSave, savedId }: { plan: TripPlan; input: PlannerInput; onSave: () => void; savedId: string | null }) {
  const intl = input.stops.some((s) => DEST_MAP[s]?.international)
  const visaNeeded = input.stops.some((s) => DEST_MAP[s]?.visaRequiredForMY)
  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <h2 className="h5 fw-bold mb-1">Ready to book?</h2>
        <p className="rt-muted small mb-3">
          We never book for you. Each link opens the provider with your dates — review price, room and cancellation policy there before paying.
        </p>
        {plan.hotelSummary.map((s) => {
          const d = DEST_MAP[s.destId]
          if (!d) return null
          return (
            <div className="card p-3 mb-3" key={s.destId}>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <div className="fw-bold">{d.emoji} Hotel in {d.name}</div>
                  <div className="small rt-muted">{plural(s.nights, 'night')} · {plural(s.rooms, 'room')} · budgeted {rm(s.perNight)}/night ({TIER_FACTORS[plan.tier].label})</div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  {['Booking.com', 'Agoda', 'Expedia'].map((p) => (
                    <a key={p} className="btn btn-sm btn-outline-primary" href={affiliateUrl(p, d.name)} target="_blank" rel="noopener noreferrer">
                      {p} <i className="bi bi-box-arrow-up-right ms-1" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        {plan.transport.legs.filter((l) => l.mode === 'flight').map((l, i) => (
          <div className="card p-3 mb-3" key={i}>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <div className="fw-bold"><i className="bi bi-airplane me-2 text-primary" aria-hidden="true" />Flight: {l.fromName} → {l.toName}</div>
                <div className="small rt-muted">Budgeted {rm(l.cost)} for the group</div>
              </div>
              <div className="d-flex gap-2">
                <a className="btn btn-sm btn-outline-primary" href="https://www.airasia.com" target="_blank" rel="noopener noreferrer">AirAsia <i className="bi bi-box-arrow-up-right ms-1" aria-hidden="true" /></a>
                <a className="btn btn-sm btn-outline-primary" href="https://www.malaysiaairlines.com" target="_blank" rel="noopener noreferrer">Malaysia Airlines <i className="bi bi-box-arrow-up-right ms-1" aria-hidden="true" /></a>
              </div>
            </div>
          </div>
        ))}
        <div className="card p-3">
          <div className="fw-bold mb-1"><i className="bi bi-shield-check me-2 text-primary" aria-hidden="true" />Travel insurance</div>
          <p className="small rt-muted mb-0">
            Budgeted as an estimate only — actual premium depends on provider, age and coverage. Compare policies before {intl ? 'international travel' : 'your trip'}.
          </p>
        </div>
      </div>
      <div className="col-lg-5">
        <div className="card p-4">
          <h2 className="h6 fw-bold mb-3">Travel document checklist</h2>
          <ul className="list-unstyled d-grid gap-2 mb-2 small">
            <li><i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true" />MyKad / Passport {intl && <b>(6+ months validity for international)</b>}</li>
            <li><i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true" />Hotel booking confirmations</li>
            <li><i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true" />Transport tickets</li>
            <li><i className="bi bi-circle text-warning me-2" aria-hidden="true" />Travel insurance</li>
            {intl && <li><i className="bi bi-circle text-warning me-2" aria-hidden="true" />Arrival/immigration card (check destination requirements)</li>}
            {visaNeeded && <li><i className="bi bi-exclamation-circle text-danger me-2" aria-hidden="true" />Visa may be required — verify with the embassy</li>}
            {intl && <li><i className="bi bi-circle rt-muted me-2" aria-hidden="true" />International driving permit (if renting a car)</li>}
          </ul>
          <p className="small rt-muted mb-0">
            Entry requirements change — always confirm with official sources such as{' '}
            <a href="https://www.imi.gov.my" target="_blank" rel="noopener noreferrer">imi.gov.my</a> and the destination's embassy.
          </p>
        </div>
        <div className="card p-4 mt-4 text-center">
          <p className="mb-2 fw-semibold">Save this trip to track bookings &amp; expenses</p>
          <button className="btn btn-primary" onClick={onSave} disabled={!!savedId}>
            <i className="bi bi-bookmark-plus me-1" aria-hidden="true" />{savedId ? 'Saved to My Trips' : 'Save Trip'}
          </button>
        </div>
      </div>
    </div>
  )
}
