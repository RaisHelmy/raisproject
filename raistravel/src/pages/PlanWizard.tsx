import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Interest, PlanMode, TravelStyle } from '../types'
import { DESTINATIONS, DEST_MAP, INTEREST_LABELS, ORIGINS } from '../data/destinations'
import { VEHICLES } from '../data/vehicles'
import { updateInput, usePlanner } from '../hooks/usePlanner'
import { headCount, roomOptions, totalBudget } from '../features/budget/engine'
import { optimizeRoute } from '../features/trip-planner/optimizer'
import { matchDestinations } from '../features/trip-planner/generator'
import { rm, plural, formatDuration } from '../utils/format'

const STYLE_OPTIONS: { id: TravelStyle; label: string; desc: string }[] = [
  { id: 'budget', label: 'Budget', desc: 'Hostels & street food' },
  { id: 'value', label: 'Value', desc: 'Best bang for buck' },
  { id: 'comfort', label: 'Comfort', desc: '4★ hotels, nicer meals' },
  { id: 'premium', label: 'Premium', desc: 'Top hotels & experiences' },
  { id: 'luxury', label: 'Luxury', desc: 'The full works' },
]

const GROUP_TYPES = [
  { id: 'solo', label: 'Solo', icon: 'bi-person' },
  { id: 'couple', label: 'Couple', icon: 'bi-heart' },
  { id: 'family', label: 'Family', icon: 'bi-people' },
  { id: 'friends', label: 'Friends', icon: 'bi-emoji-smile' },
  { id: 'group', label: 'Group', icon: 'bi-people-fill' },
] as const

const STEP_NAMES = ['Mode', 'Start', 'Destination', 'Dates', 'Travellers', 'Style', 'Budget', 'Interests']

export default function PlanWizard() {
  const navigate = useNavigate()
  const { input } = usePlanner()
  const [step, setStep] = useState(0)
  const [showMatches, setShowMatches] = useState(false)
  const budgetFirst = input.mode !== 'destination'

  // Step indices skip Destination for budget-first modes (chosen at the end instead).
  const steps = budgetFirst
    ? [0, 1, 3, 4, 5, 6, 7]
    : [0, 1, 2, 3, 4, 5, 6, 7]
  const currentIdx = steps.indexOf(step)
  const isLast = currentIdx === steps.length - 1

  function next() {
    if (isLast) {
      if (budgetFirst && input.stops.length === 0) setShowMatches(true)
      else navigate('/plan/results')
      return
    }
    setStep(steps[currentIdx + 1])
  }
  function back() {
    if (showMatches) { setShowMatches(false); return }
    if (currentIdx > 0) setStep(steps[currentIdx - 1])
  }

  const canProceed =
    step !== 2 || input.stops.length > 0

  const matches = useMemo(
    () => (showMatches ? matchDestinations(input) : []),
    [showMatches, input],
  )

  return (
    <div className="container py-4 rt-has-mobile-summary">
      {/* Progress */}
      <nav aria-label="Planner progress" className="d-none d-md-flex align-items-center gap-1 mb-4">
        {steps.map((s, i) => (
          <div key={s} className="d-flex align-items-center flex-grow-1 gap-1">
            <div className={`rt-step-dot ${i < currentIdx ? 'done' : i === currentIdx ? 'current' : ''}`}>
              {i < currentIdx ? <i className="bi bi-check" aria-hidden="true" /> : i + 1}
            </div>
            <span className={`small d-none d-lg-inline ${i === currentIdx ? 'fw-bold' : 'rt-muted'}`}>{STEP_NAMES[s]}</span>
            {i < steps.length - 1 && <div className={`rt-step-line ${i < currentIdx ? 'done' : ''}`} />}
          </div>
        ))}
      </nav>
      <p className="d-md-none small rt-muted mb-3">Step {currentIdx + 1} of {steps.length} — {STEP_NAMES[step]}</p>

      <div className="row g-4">
        <div className="col-lg-8">
          {showMatches ? (
            <MatchesStep matches={matches} onPick={(id) => { updateInput({ stops: [id] }); navigate('/plan/results') }} />
          ) : (
            <>
              {step === 0 && <ModeStep />}
              {step === 1 && <StartStep />}
              {step === 2 && <DestinationStep />}
              {step === 3 && <DatesStep />}
              {step === 4 && <TravellersStep />}
              {step === 5 && <StyleStep />}
              {step === 6 && <BudgetStep />}
              {step === 7 && <InterestsStep />}
            </>
          )}

          <div className="d-flex justify-content-between mt-4 rt-no-print">
            <button className="btn btn-outline-primary" onClick={back} disabled={currentIdx === 0 && !showMatches}>
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back
            </button>
            {!showMatches && (
              <button className="btn btn-primary btn-lg" onClick={next} disabled={!canProceed}>
                {isLast
                  ? budgetFirst && input.stops.length === 0 ? 'Find destinations' : 'Generate my trip'
                  : 'Continue'}
                <i className="bi bi-arrow-right ms-2" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Sticky summary */}
        <div className="col-lg-4 d-none d-lg-block">
          <TripSummaryCard />
        </div>
      </div>
      <MobileSummaryBar />
    </div>
  )
}

// ---------- Steps ----------

function ModeStep() {
  const { input } = usePlanner()
  const modes: { id: PlanMode; icon: string; title: string; desc: string }[] = [
    { id: 'destination', icon: 'bi-geo-alt', title: 'I know where I want to go', desc: 'Pick destinations and we’ll build the best itinerary and budget.' },
    { id: 'budget', icon: 'bi-wallet2', title: 'I have a budget', desc: 'Tell us what you can spend — we’ll find destinations that truly fit it.' },
    { id: 'inspire', icon: 'bi-stars', title: 'Inspire me', desc: 'Share your interests and budget, and we’ll suggest trips you’ll love.' },
  ]
  return (
    <section aria-labelledby="mode-heading">
      <h1 id="mode-heading" className="h3 fw-bold mb-1">How do you want to plan?</h1>
      <p className="rt-muted mb-4">All three roads lead to a fully-costed trip.</p>
      <div className="row g-3">
        {modes.map((m) => (
          <div className="col-md-4" key={m.id}>
            <button
              className={`rt-mode-card ${input.mode === m.id ? 'active' : ''}`}
              onClick={() => updateInput({ mode: m.id, ...(m.id !== 'destination' ? { stops: [] } : {}) })}
              aria-pressed={input.mode === m.id}
            >
              <div className="rt-icon-circle mb-2"><i className={`bi ${m.icon}`} aria-hidden="true" /></div>
              <div className="fw-bold mb-1">{m.title}</div>
              <div className="small rt-muted">{m.desc}</div>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function StartStep() {
  const { input } = usePlanner()
  return (
    <section aria-labelledby="start-heading">
      <h1 id="start-heading" className="h3 fw-bold mb-1">Where are you starting from?</h1>
      <p className="rt-muted mb-4">We calculate every kilometre, toll and fare from your doorstep.</p>
      <div className="row g-3">
        {ORIGINS.map((o) => (
          <div className="col-6 col-md-4" key={o.id}>
            <button
              className={`rt-mode-card ${input.origin === o.id ? 'active' : ''}`}
              onClick={() => updateInput({ origin: o.id })}
              aria-pressed={input.origin === o.id}
            >
              <div className="fw-bold"><i className="bi bi-geo-alt me-2 text-primary" aria-hidden="true" />{o.name}</div>
            </button>
          </div>
        ))}
      </div>
      <p className="small rt-muted mt-3 mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true" />
        Starting somewhere else? Pick the nearest city — costs will be very close.
      </p>
    </section>
  )
}

function DestinationStep() {
  const { input } = usePlanner()
  const [filter, setFilter] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const available = DESTINATIONS.filter(
    (d) => d.id !== input.origin &&
      !input.stops.includes(d.id) &&
      d.name.toLowerCase().includes(filter.toLowerCase()),
  )

  const opt = useMemo(
    () => (input.stops.length >= 2 ? optimizeRoute(input.origin, input.stops, input.vehicleId) : null),
    [input.origin, input.stops, input.vehicleId],
  )

  function move(from: number, to: number) {
    if (to < 0 || to >= input.stops.length) return
    const stops = [...input.stops]
    const [x] = stops.splice(from, 1)
    stops.splice(to, 0, x)
    updateInput({ stops })
  }

  return (
    <section aria-labelledby="dest-heading">
      <h1 id="dest-heading" className="h3 fw-bold mb-1">Where do you want to go?</h1>
      <p className="rt-muted mb-3">Add one destination — or chain several for a multi-city trip. Drag to reorder.</p>

      {input.stops.length > 0 && (
        <div className="card p-3 mb-3">
          <div className="small fw-bold text-uppercase rt-muted mb-2" style={{ letterSpacing: '0.05em' }}>Your route</div>
          <ol className="list-unstyled mb-0">
            <li className="rt-muted small mb-2"><i className="bi bi-house me-2" aria-hidden="true" />{ORIGINS.find((o) => o.id === input.origin)?.name} (start)</li>
            {input.stops.map((id, i) => (
              <li
                key={id}
                className="d-flex align-items-center gap-2 py-2 border-top"
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null) }}
                style={{ cursor: 'grab' }}
              >
                <i className="bi bi-grip-vertical rt-muted" aria-hidden="true" />
                <span className="fw-semibold flex-grow-1">{DEST_MAP[id]?.emoji} {DEST_MAP[id]?.name}</span>
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-outline-primary" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${DEST_MAP[id]?.name} earlier`}><i className="bi bi-chevron-up" aria-hidden="true" /></button>
                  <button className="btn btn-outline-primary" onClick={() => move(i, i + 1)} disabled={i === input.stops.length - 1} aria-label={`Move ${DEST_MAP[id]?.name} later`}><i className="bi bi-chevron-down" aria-hidden="true" /></button>
                  <button className="btn btn-outline-danger" onClick={() => updateInput({ stops: input.stops.filter((s) => s !== id) })} aria-label={`Remove ${DEST_MAP[id]?.name}`}><i className="bi bi-x" aria-hidden="true" /></button>
                </div>
              </li>
            ))}
          </ol>
          {opt && opt.savedKm > 5 && (
            <div className="alert alert-success mb-0 mt-3 py-2 px-3 small d-flex flex-wrap align-items-center gap-2">
              <i className="bi bi-lightbulb" aria-hidden="true" />
              <span>Reordering saves <b>{opt.savedKm} km</b>, <b>{formatDuration(opt.savedMinutes)}</b> driving and ≈ <b>{rm(opt.savedFuelToll)}</b> fuel &amp; tolls.</span>
              <button className="btn btn-sm btn-success ms-auto" onClick={() => updateInput({ stops: opt.optimized })}>Optimize route</button>
            </div>
          )}
        </div>
      )}

      <label className="form-label" htmlFor="dest-search">Add a destination</label>
      <input
        id="dest-search" className="form-control mb-3" placeholder="Search destinations…"
        value={filter} onChange={(e) => setFilter(e.target.value)}
      />
      <div className="row g-2" role="list">
        {available.slice(0, 12).map((d) => (
          <div className="col-6 col-md-4" key={d.id} role="listitem">
            <button
              className="rt-mode-card p-3"
              onClick={() => updateInput({ stops: [...input.stops, d.id] })}
            >
              <div className="fw-semibold">{d.emoji} {d.name}</div>
              <div className="small rt-muted">{d.international ? d.country : d.tagline}</div>
            </button>
          </div>
        ))}
        {available.length === 0 && <p className="rt-muted">No destinations match "{filter}".</p>}
      </div>
    </section>
  )
}

function DatesStep() {
  const { input } = usePlanner()
  return (
    <section aria-labelledby="dates-heading">
      <h1 id="dates-heading" className="h3 fw-bold mb-1">When — and for how long?</h1>
      <p className="rt-muted mb-4">Flexible dates often unlock cheaper transport and hotels.</p>
      <div className="card p-4">
        <label className="form-label" htmlFor="days-range">Trip length: <b>{plural(input.days, 'day')} / {plural(input.days - 1, 'night')}</b></label>
        <input
          id="days-range" type="range" className="form-range" min={2} max={16}
          value={input.days} onChange={(e) => updateInput({ days: Number(e.target.value) })}
        />
        <div className="d-flex justify-content-between small rt-muted mb-4"><span>2 days</span><span>16 days</span></div>

        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label" htmlFor="start-date">Departure date (optional)</label>
            <input
              id="start-date" type="date" className="form-control"
              value={input.startDate ?? ''}
              onChange={(e) => updateInput({ startDate: e.target.value || undefined })}
            />
          </div>
          <div className="col-md-6 d-flex align-items-end">
            <div className="form-check form-switch">
              <input
                className="form-check-input" type="checkbox" id="flex-dates"
                checked={input.flexibleDates}
                onChange={(e) => updateInput({ flexibleDates: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="flex-dates">
                Flexible departure (±3 days)
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Counter({ label, value, min, onChange, hint }: {
  label: string; value: number; min: number; hint?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="d-flex align-items-center justify-content-between py-2 border-bottom">
      <div>
        <div className="fw-semibold">{label}</div>
        {hint && <div className="small rt-muted">{hint}</div>}
      </div>
      <div className="d-flex align-items-center gap-2">
        <button className="btn btn-sm btn-outline-primary" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer ${label}`}>−</button>
        <span className="fw-bold" style={{ width: 24, textAlign: 'center' }} aria-live="polite">{value}</span>
        <button className="btn btn-sm btn-outline-primary" onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>+</button>
      </div>
    </div>
  )
}

function TravellersStep() {
  const { input } = usePlanner()
  const t = input.travellers
  const rooms = roomOptions(t)
  return (
    <section aria-labelledby="trav-heading">
      <h1 id="trav-heading" className="h3 fw-bold mb-1">Who's travelling?</h1>
      <p className="rt-muted mb-4">Room and cost calculations understand real occupancy.</p>
      <div className="row g-4">
        <div className="col-md-6">
          <div className="card p-4">
            <Counter label="Adults" hint="12 and above" value={t.adults} min={1} onChange={(v) => updateInput({ travellers: { ...t, adults: v } })} />
            <Counter label="Children" hint="2 – 11 years" value={t.children} min={0} onChange={(v) => updateInput({ travellers: { ...t, children: v } })} />
            <Counter label="Infants" hint="Under 2 (mostly free)" value={t.infants} min={0} onChange={(v) => updateInput({ travellers: { ...t, infants: v } })} />
            <div className="d-flex flex-wrap gap-2 mt-3">
              {GROUP_TYPES.map((g) => (
                <button
                  key={g.id}
                  className={`rt-chip ${input.groupType === g.id ? 'active' : ''}`}
                  onClick={() => updateInput({ groupType: g.id })}
                  aria-pressed={input.groupType === g.id}
                >
                  <i className={`bi ${g.icon}`} aria-hidden="true" />{g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-4 h-100">
            <div className="small fw-bold text-uppercase rt-muted mb-2" style={{ letterSpacing: '0.05em' }}>Room options for {plural(headCount(t), 'traveller')}</div>
            {rooms.map((r) => (
              <div key={r.label} className="d-flex align-items-start gap-2 py-2 border-bottom">
                <i className="bi bi-door-closed text-primary mt-1" aria-hidden="true" />
                <div>
                  <div className="fw-semibold">{r.label}</div>
                  <div className="small rt-muted">{r.note}</div>
                </div>
              </div>
            ))}
            <p className="small rt-muted mt-3 mb-0">The budget engine uses the standard option; you can compare hotels with family rooms later.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function StyleStep() {
  const { input } = usePlanner()
  const w = input.weights
  const sliders: { key: keyof typeof w; label: string; icon: string }[] = [
    { key: 'food', label: 'Food', icon: 'bi-cup-hot' },
    { key: 'hotel', label: 'Hotel', icon: 'bi-building' },
    { key: 'activities', label: 'Activities', icon: 'bi-star' },
    { key: 'transport', label: 'Transport comfort', icon: 'bi-car-front' },
  ]
  return (
    <section aria-labelledby="style-heading">
      <h1 id="style-heading" className="h3 fw-bold mb-1">What's your travel style?</h1>
      <p className="rt-muted mb-4">This shapes which of the generated plans we recommend.</p>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {STYLE_OPTIONS.map((s) => (
          <button
            key={s.id}
            className={`rt-chip ${input.style === s.id ? 'active' : ''}`}
            onClick={() => updateInput({ style: s.id })}
            aria-pressed={input.style === s.id}
            title={s.desc}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="card p-4">
        <div className="small fw-bold text-uppercase rt-muted mb-3" style={{ letterSpacing: '0.05em' }}>Where should the money go?</div>
        {sliders.map((s) => (
          <div key={s.key} className="mb-3">
            <label className="form-label d-flex justify-content-between" htmlFor={`w-${s.key}`}>
              <span><i className={`bi ${s.icon} me-2 text-primary`} aria-hidden="true" />{s.label}</span>
              <span className="rt-muted">{w[s.key] < 34 ? 'Save here' : w[s.key] > 66 ? 'Splurge' : 'Balanced'}</span>
            </label>
            <input
              id={`w-${s.key}`} type="range" className="form-range" min={0} max={100}
              value={w[s.key]}
              onChange={(e) => updateInput({ weights: { ...w, [s.key]: Number(e.target.value) } })}
            />
          </div>
        ))}
        <div className="form-check form-switch mt-2">
          <input
            className="form-check-input" type="checkbox" id="muslim-friendly"
            checked={input.muslimFriendly}
            onChange={(e) => updateInput({ muslimFriendly: e.target.checked })}
          />
          <label className="form-check-label" htmlFor="muslim-friendly">
            Muslim-friendly travel <span className="rt-muted small">(halal food focus, prayer facilities noted)</span>
          </label>
        </div>
      </div>
      <div className="card p-3 mt-3">
        <label className="form-label" htmlFor="vehicle-select"><i className="bi bi-car-front me-2 text-primary" aria-hidden="true" />Your vehicle (for driving legs)</label>
        <select
          id="vehicle-select" className="form-select"
          value={input.vehicleId}
          onChange={(e) => updateInput({ vehicleId: e.target.value })}
        >
          {VEHICLES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.kind === 'ev' ? `${v.consumption} kWh/100km` : `${v.consumption} km/L`}
            </option>
          ))}
        </select>
      </div>
    </section>
  )
}

function BudgetStep() {
  const { input } = usePlanner()
  const total = totalBudget(input)
  const heads = Math.max(1, headCount(input.travellers) - input.travellers.infants)
  const modes = [
    { id: 'total', label: 'Total trip budget' },
    { id: 'perPerson', label: 'Per person' },
    { id: 'daily', label: 'Per day' },
  ] as const
  return (
    <section aria-labelledby="budget-heading">
      <h1 id="budget-heading" className="h3 fw-bold mb-1">What's your budget?</h1>
      <p className="rt-muted mb-4">We'll generate plans around it — and warn you before you blow it.</p>
      <div className="card p-4">
        <div className="btn-group mb-3" role="group" aria-label="Budget type">
          {modes.map((m) => (
            <button
              key={m.id}
              className={`btn ${input.budgetMode === m.id ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => updateInput({ budgetMode: m.id })}
              aria-pressed={input.budgetMode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className="form-label" htmlFor="budget-input">
          Amount (RM {input.budgetMode === 'perPerson' ? 'per person' : input.budgetMode === 'daily' ? 'per day' : 'total'})
        </label>
        <input
          id="budget-input" type="number" min={0} step={100} className="form-control form-control-lg"
          value={input.budget || ''}
          onChange={(e) => updateInput({ budget: Math.max(0, Number(e.target.value)) })}
        />
        {total > 0 && (
          <div className="row text-center mt-4 g-2">
            <div className="col-4"><div className="rt-price fs-5">{rm(total)}</div><div className="small rt-muted">Total trip</div></div>
            <div className="col-4"><div className="rt-price fs-5">{rm(Math.round(total / heads))}</div><div className="small rt-muted">Per person</div></div>
            <div className="col-4"><div className="rt-price fs-5">{rm(Math.round(total / input.days))}</div><div className="small rt-muted">Per day (group)</div></div>
          </div>
        )}
      </div>
    </section>
  )
}

function InterestsStep() {
  const { input } = usePlanner()
  function toggle(i: Interest) {
    updateInput({
      interests: input.interests.includes(i)
        ? input.interests.filter((x) => x !== i)
        : [...input.interests, i],
    })
  }
  return (
    <section aria-labelledby="interests-heading">
      <h1 id="interests-heading" className="h3 fw-bold mb-1">What do you enjoy?</h1>
      <p className="rt-muted mb-4">Pick a few — we use these to choose activities and recommend plans.</p>
      <div className="d-flex flex-wrap gap-2">
        {(Object.keys(INTEREST_LABELS) as Interest[]).map((i) => (
          <button
            key={i}
            className={`rt-chip ${input.interests.includes(i) ? 'active' : ''}`}
            onClick={() => toggle(i)}
            aria-pressed={input.interests.includes(i)}
          >
            <i className={`bi ${INTEREST_LABELS[i].icon}`} aria-hidden="true" />
            {INTEREST_LABELS[i].label}
          </button>
        ))}
      </div>
    </section>
  )
}

function MatchesStep({ matches, onPick }: {
  matches: ReturnType<typeof matchDestinations>
  onPick: (id: string) => void
}) {
  const { input } = usePlanner()
  const budget = totalBudget(input)
  return (
    <section aria-labelledby="matches-heading">
      <h1 id="matches-heading" className="h3 fw-bold mb-1">Best matches for your budget</h1>
      <p className="rt-muted mb-4">
        {rm(budget)} · {plural(headCount(input.travellers), 'traveller')} · {plural(input.days, 'day')} from {ORIGINS.find((o) => o.id === input.origin)?.name}.
        Estimates use our value tier.
      </p>
      {matches.length === 0 && (
        <div className="card p-4 text-center">
          <i className="bi bi-emoji-frown fs-2 rt-muted" aria-hidden="true" />
          <p className="mt-2 mb-1 fw-semibold">Nothing fits that budget comfortably.</p>
          <p className="rt-muted small mb-0">Try fewer days, fewer travellers, or a bigger budget — Melaka and Port Dickson are great low-cost options.</p>
        </div>
      )}
      <div className="row g-3">
        {matches.map((m) => {
          const d = DEST_MAP[m.destId]
          if (!d) return null
          const pct = Math.round(m.utilization * 100)
          return (
            <div className="col-md-6" key={m.destId}>
              <div className="card rt-card-hover h-100">
                <div className="rt-dest-art" style={{ background: d.gradient, height: 90 }}>
                  <span className="emoji" style={{ fontSize: '2rem' }} aria-hidden="true">{d.emoji}</span>
                </div>
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <h2 className="h6 fw-bold">{d.name}{d.international ? ` · ${d.country}` : ''}</h2>
                    <span className="rt-price text-success">{rm(m.estimated)}</span>
                  </div>
                  <div className="small rt-muted mb-2">{plural(input.days, 'day')} · estimated total for the group</div>
                  <div className="progress mb-1" style={{ height: 8 }} role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Budget utilisation ${pct}%`}>
                    <div className="progress-bar" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="small rt-muted mb-3">Budget utilisation: <b>{pct}%</b></div>
                  {m.matchedInterests.length > 0 && (
                    <div className="d-flex gap-1 flex-wrap mb-3">
                      {m.matchedInterests.map((i) => <span key={i} className="rt-badge-soft">{INTEREST_LABELS[i as Interest].label}</span>)}
                    </div>
                  )}
                  <button className="btn btn-primary btn-sm w-100" onClick={() => onPick(m.destId)}>
                    Build this trip <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------- Summary ----------

function TripSummaryCard() {
  const { input } = usePlanner()
  const total = totalBudget(input)
  const heads = headCount(input.travellers)
  return (
    <div className="card p-4 rt-sticky-summary">
      <div className="small fw-bold text-uppercase rt-muted mb-3" style={{ letterSpacing: '0.05em' }}>Your Trip</div>
      <ul className="list-unstyled mb-3 d-grid gap-2">
        <li><i className="bi bi-house me-2 text-primary" aria-hidden="true" />From <b>{ORIGINS.find((o) => o.id === input.origin)?.name ?? '—'}</b></li>
        <li>
          <i className="bi bi-geo-alt me-2 text-primary" aria-hidden="true" />
          {input.stops.length > 0
            ? input.stops.map((s) => DEST_MAP[s]?.name).join(' → ')
            : <span className="rt-muted">Destination TBD</span>}
        </li>
        <li><i className="bi bi-calendar3 me-2 text-primary" aria-hidden="true" />{plural(input.days, 'day')} / {plural(input.days - 1, 'night')}</li>
        <li><i className="bi bi-people me-2 text-primary" aria-hidden="true" />{plural(heads, 'traveller')} · {input.groupType}</li>
        <li><i className="bi bi-sliders me-2 text-primary" aria-hidden="true" />{STYLE_OPTIONS.find((s) => s.id === input.style)?.label} style</li>
      </ul>
      <div className="rt-divider pt-3">
        <div className="rt-price fs-4">{total > 0 ? rm(total) : '—'}</div>
        <div className="small rt-muted">budget{heads > 1 && total > 0 ? ` · ${rm(Math.round(total / Math.max(1, heads - input.travellers.infants)))}/person` : ''}</div>
      </div>
    </div>
  )
}

function MobileSummaryBar() {
  const { input } = usePlanner()
  const total = totalBudget(input)
  return (
    <div className="rt-mobile-summary d-lg-none">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-bold small">
            {input.stops.length > 0 ? input.stops.map((s) => DEST_MAP[s]?.name).join(' → ') : 'New trip'}
          </div>
          <div className="small rt-muted">{plural(input.days, 'day')} · {plural(headCount(input.travellers), 'pax')} · {total > 0 ? rm(total) : 'no budget set'}</div>
        </div>
      </div>
    </div>
  )
}
