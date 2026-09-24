import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DESTINATIONS, ORIGINS } from '../data/destinations'
import { ROUTES } from '../data/routes'
import { RouteCard } from '../components/RouteCard'
import { DestinationCard } from '../components/DestinationCard'
import { DEFAULT_INPUT, resetInput } from '../hooks/usePlanner'
import type { PlannerInput } from '../types'
import { rm } from '../utils/format'

const STEPS = [
  { icon: 'bi-wallet2', title: 'Tell us your budget', text: 'Total, per person or per day — we work with what you have.' },
  { icon: 'bi-geo-alt', title: 'Choose your destination', text: 'Pick a place, a curated route, or let us suggest one.' },
  { icon: 'bi-arrow-left-right', title: 'Compare travel options', text: 'Drive, fly, bus or ferry — with real cost per person.' },
  { icon: 'bi-calendar2-week', title: 'Build your itinerary', text: 'A realistic day-by-day plan you can rearrange freely.' },
  { icon: 'bi-bookmark-check', title: 'Book when you’re ready', text: 'We link you to providers — you stay in control.' },
]

const SCENARIOS: { title: string; sub: string; input: Partial<PlannerInput> }[] = [
  {
    title: 'Family trip · KL → Penang → Langkawi',
    sub: '7 days · 4 people · RM5,000',
    input: { mode: 'destination', stops: ['penang', 'langkawi'], days: 7, budget: 5000, travellers: { adults: 2, children: 2, infants: 0 }, groupType: 'family', interests: ['food', 'beach', 'family'] },
  },
  {
    title: 'Couple getaway · KL → Bangkok',
    sub: '5 days · 2 people · RM3,500',
    input: { mode: 'destination', stops: ['bangkok'], days: 5, budget: 3500, travellers: { adults: 2, children: 0, infants: 0 }, groupType: 'couple', interests: ['food', 'shopping'], transportPreference: 'fly' },
  },
  {
    title: 'Road trip · KL → Cameron → Ipoh → Penang',
    sub: '6 days · 4 people · RM4,000',
    input: { mode: 'destination', stops: ['cameron-highlands', 'ipoh', 'penang'], days: 6, budget: 4000, travellers: { adults: 4, children: 0, infants: 0 }, groupType: 'friends', interests: ['nature', 'food', 'roadtrip'], transportPreference: 'drive' },
  },
  {
    title: 'Budget challenge · RM2,000',
    sub: '5 days · 2 people · where can we go?',
    input: { mode: 'budget', stops: [], days: 5, budget: 2000, travellers: { adults: 2, children: 0, infants: 0 }, groupType: 'couple' },
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const [origin, setOrigin] = useState('kuala-lumpur')
  const [destination, setDestination] = useState('')
  const [days, setDays] = useState(5)
  const [pax, setPax] = useState(2)
  const [budget, setBudget] = useState(3000)

  function planTrip(e: React.FormEvent) {
    e.preventDefault()
    resetInput({
      ...DEFAULT_INPUT,
      mode: destination ? 'destination' : 'budget',
      origin,
      stops: destination ? [destination] : [],
      days,
      budget,
      travellers: { adults: pax, children: 0, infants: 0 },
      groupType: pax === 1 ? 'solo' : pax === 2 ? 'couple' : 'friends',
    })
    navigate('/plan')
  }

  function runScenario(patch: Partial<PlannerInput>) {
    resetInput({ ...DEFAULT_INPUT, origin: 'kuala-lumpur', ...patch })
    navigate(patch.mode === 'budget' ? '/plan' : '/plan/results')
  }

  const featured = ROUTES.filter((r) => r.popularity === 5).slice(0, 4)
  const discover = DESTINATIONS.filter((d) => ['langkawi', 'penang', 'kota-kinabalu', 'bali'].includes(d.id))

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="rt-hero py-5">
        <div className="container py-lg-4">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <h1 className="rt-hero-title mb-3">
                Plan Your Trip.<br />
                <span className="accent">Know Your Cost</span> Before You Go.
              </h1>
              <p className="rt-muted fs-5 mb-4" style={{ maxWidth: 480 }}>
                Build a DIY itinerary, compare accommodation and transport,
                and understand your total cost per person — before you spend a ringgit.
              </p>
              <div className="d-flex flex-wrap gap-3 small rt-muted">
                <span><i className="bi bi-check-circle-fill text-success me-1" />Made for Malaysian travellers</span>
                <span><i className="bi bi-check-circle-fill text-success me-1" />Fuel, tolls &amp; ferries included</span>
                <span><i className="bi bi-check-circle-fill text-success me-1" />No booking pressure</span>
              </div>
            </div>
            <div className="col-lg-6">
              <form className="card p-4 shadow-lg border-0" onSubmit={planTrip} aria-label="Quick trip planner">
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="hero-origin">Where are you starting from?</label>
                    <select id="hero-origin" className="form-select" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                      {ORIGINS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="hero-dest">Where do you want to go?</label>
                    <select id="hero-dest" className="form-select" value={destination} onChange={(e) => setDestination(e.target.value)}>
                      <option value="">Not sure yet — suggest for me</option>
                      <optgroup label="Malaysia">
                        {DESTINATIONS.filter((d) => !d.international).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </optgroup>
                      <optgroup label="International">
                        {DESTINATIONS.filter((d) => d.international).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <div className="col-4">
                    <label className="form-label" htmlFor="hero-days">Days</label>
                    <input id="hero-days" type="number" min={2} max={21} className="form-control" value={days} onChange={(e) => setDays(Math.max(2, Number(e.target.value)))} />
                  </div>
                  <div className="col-4">
                    <label className="form-label" htmlFor="hero-pax">Travellers</label>
                    <input id="hero-pax" type="number" min={1} max={12} className="form-control" value={pax} onChange={(e) => setPax(Math.max(1, Number(e.target.value)))} />
                  </div>
                  <div className="col-4">
                    <label className="form-label" htmlFor="hero-budget">Budget (RM)</label>
                    <input id="hero-budget" type="number" min={0} step={100} className="form-control" value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} />
                  </div>
                  <div className="col-12">
                    <button type="submit" className="btn btn-primary btn-lg w-100">
                      <i className="bi bi-stars me-2" aria-hidden="true" />Plan My Trip
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="container py-5">
        <h2 className="rt-section-title text-center mb-2">How it works</h2>
        <p className="rt-muted text-center mb-4">Five steps from "where should we go?" to a fully-costed plan.</p>
        <div className="row g-3 justify-content-center">
          {STEPS.map((s, i) => (
            <div className="col-6 col-md-4 col-lg" key={s.title}>
              <div className="card h-100 p-3 text-center rt-card-hover">
                <div className="rt-icon-circle mx-auto mb-2"><i className={`bi ${s.icon}`} aria-hidden="true" /></div>
                <div className="small fw-bold text-uppercase rt-muted mb-1" style={{ letterSpacing: '0.05em' }}>Step {i + 1}</div>
                <h3 className="h6 fw-bold">{s.title}</h3>
                <p className="small rt-muted mb-0">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Demo scenarios ---------- */}
      <section className="py-5" style={{ background: '#fff' }}>
        <div className="container">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h2 className="rt-section-title mb-1">Try a ready-made scenario</h2>
              <p className="rt-muted mb-0">One click — see how the planner builds a full costed trip.</p>
            </div>
          </div>
          <div className="row g-3">
            {SCENARIOS.map((s) => (
              <div className="col-md-6 col-lg-3" key={s.title}>
                <button className="rt-mode-card rt-card-hover" onClick={() => runScenario(s.input)}>
                  <div className="fw-bold mb-1">{s.title}</div>
                  <div className="small rt-muted">{s.sub}</div>
                  <div className="small text-primary fw-semibold mt-2">Run scenario <i className="bi bi-arrow-right" aria-hidden="true" /></div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Popular routes ---------- */}
      <section className="container py-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="rt-section-title mb-0">Popular routes</h2>
          <Link to="/routes" className="btn btn-outline-primary btn-sm">All routes <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
        </div>
        <div className="row g-3">
          {featured.map((r) => <div className="col-md-6 col-lg-3" key={r.slug}><RouteCard route={r} /></div>)}
        </div>
      </section>

      {/* ---------- Discover ---------- */}
      <section className="py-5" style={{ background: '#fff' }}>
        <div className="container">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="rt-section-title mb-0">Get inspired</h2>
            <Link to="/destinations" className="btn btn-outline-primary btn-sm">All destinations <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          </div>
          <div className="row g-3">
            {discover.map((d) => (
              <div className="col-md-6 col-lg-3" key={d.id}>
                <DestinationCard dest={d} estPerPerson={Math.round((d.hotelPerNight.value * 3) / 2 + d.meals.reduce((a, b) => a + b, 0) * 4 + 300)} />
              </div>
            ))}
          </div>
          <p className="text-center small rt-muted mt-3 mb-0">
            Cards show estimated per-person costs · e.g. Langkawi from {rm(1250)}/person for 4–5 days
          </p>
        </div>
      </section>
    </>
  )
}
