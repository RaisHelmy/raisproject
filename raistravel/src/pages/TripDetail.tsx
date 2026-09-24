import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useTrips, updateTrip, setTripStatus, addExpense, removeExpense,
  toggleChecklistItem, addChecklistItem, computeSettlement,
} from '../hooks/useTrips'
import { STATUS_META } from '../utils/tripStatus'
import { DEST_MAP } from '../data/destinations'
import { resetInput } from '../hooks/usePlanner'
import { headCount } from '../features/budget/engine'
import { CompareBars } from '../components/charts'
import { plural, rm } from '../utils/format'
import type { Expense, TripStatus } from '../types'

const CATEGORIES: Expense['category'][] = ['transport', 'accommodation', 'food', 'activities', 'shopping', 'other']

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { trips } = useTrips()
  const trip = trips.find((t) => t.id === id)

  const [form, setForm] = useState({ label: '', amount: '', category: 'food' as Expense['category'], paidBy: '' })
  const [newItem, setNewItem] = useState('')
  const [newCompanion, setNewCompanion] = useState('')

  if (!trip) {
    return (
      <div className="container py-5 text-center">
        <h1 className="h4">Trip not found</h1>
        <Link to="/trips" className="btn btn-primary mt-2">My Trips</Link>
      </div>
    )
  }

  const heads = Math.max(1, headCount(trip.input.travellers) - trip.input.travellers.infants)
  const spent = trip.expenses.reduce((a, e) => a + e.amount, 0)
  const est = trip.estimatedBreakdown
  const actualBy = (cat: string) => trip.expenses.filter((e) => e.category === cat).reduce((a, e) => a + e.amount, 0)
  const settlement = computeSettlement(trip.companions, trip.expenses)
  const variance = est.total - spent

  const checklistGroups = [...new Set(trip.checklist.map((c) => c.group))]

  function submitExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!trip) return
    const amount = Number(form.amount)
    if (!form.label || !amount) return
    addExpense(trip.id, {
      label: form.label,
      amount,
      category: form.category,
      paidBy: form.paidBy || trip.companions[0],
      date: new Date().toISOString().slice(0, 10),
    })
    setForm({ label: '', amount: '', category: form.category, paidBy: form.paidBy })
  }

  return (
    <div className="container py-4">
      <p className="rt-muted small mb-1"><Link to="/trips">My Trips</Link> / {trip.name}</p>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">{trip.name}</h1>
          <p className="rt-muted mb-0">
            {trip.input.stops.map((s) => DEST_MAP[s]?.name).join(' → ')} · {plural(trip.input.days, 'day')} · {plural(heads, 'traveller')}
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center rt-no-print">
          <label className="visually-hidden" htmlFor="trip-status">Trip status</label>
          <select
            id="trip-status" className="form-select form-select-sm" style={{ width: 160 }}
            value={trip.status}
            onChange={(e) => setTripStatus(trip.id, e.target.value as TripStatus)}
          >
            {(Object.keys(STATUS_META) as TripStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => { resetInput(trip.input); navigate('/plan/results') }}
          >
            <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />Re-open plan
          </button>
        </div>
      </div>

      <div className="row g-4">
        {/* ---------- Estimated vs actual ---------- */}
        <div className="col-lg-7">
          <div className="card p-4">
            <h2 className="h6 fw-bold mb-3">Estimated vs actual</h2>
            <CompareBars
              categories={['Transport', 'Hotels', 'Food', 'Activities', 'Other']}
              series={[
                { name: 'Estimated', data: [est.transport, est.accommodation, est.food, est.activities, est.other + est.contingency], color: '#bcd9d2' },
                { name: 'Actual', data: [actualBy('transport'), actualBy('accommodation'), actualBy('food'), actualBy('activities'), actualBy('shopping') + actualBy('other') + actualBy('contingency')], color: '#ff6b4a' },
              ]}
            />
            <div className="row text-center g-2 rt-divider pt-3">
              <div className="col-4"><div className="rt-price">{rm(est.total)}</div><div className="small rt-muted">Estimated</div></div>
              <div className="col-4"><div className="rt-price">{rm(spent)}</div><div className="small rt-muted">Actual so far</div></div>
              <div className="col-4">
                <div className={`rt-price ${variance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {variance >= 0 ? `${rm(variance)} left` : `${rm(-variance)} over`}
                </div>
                <div className="small rt-muted">{spent > 0 && variance >= 0 && spent <= est.total ? 'On track' : spent === 0 ? 'No expenses yet' : variance >= 0 ? 'Within estimate' : 'Over estimate'}</div>
              </div>
            </div>
          </div>

          {/* ---------- Expenses ---------- */}
          <div className="card p-4 mt-4">
            <h2 className="h6 fw-bold mb-3">Actual expenses</h2>
            <form className="row g-2 mb-3 rt-no-print" onSubmit={submitExpense}>
              <div className="col-md-4">
                <label className="visually-hidden" htmlFor="exp-label">Expense description</label>
                <input id="exp-label" className="form-control form-control-sm" placeholder="e.g. Hotel deposit" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="col-4 col-md-2">
                <label className="visually-hidden" htmlFor="exp-amount">Amount (RM)</label>
                <input id="exp-amount" type="number" min={0} step="0.01" className="form-control form-control-sm" placeholder="RM" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="col-4 col-md-2">
                <label className="visually-hidden" htmlFor="exp-cat">Category</label>
                <select id="exp-cat" className="form-select form-select-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Expense['category'] })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-4 col-md-2">
                <label className="visually-hidden" htmlFor="exp-paidby">Paid by</label>
                <select id="exp-paidby" className="form-select form-select-sm" value={form.paidBy || trip.companions[0]} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>
                  {trip.companions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-2">
                <button type="submit" className="btn btn-sm btn-primary w-100">Add</button>
              </div>
            </form>
            {trip.expenses.length === 0 ? (
              <p className="rt-muted small mb-0">No expenses recorded yet. Add them as you book and travel — we'll compare against your estimate.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Paid by</th><th className="text-end">Amount</th><th /></tr></thead>
                  <tbody>
                    {trip.expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="rt-muted small">{e.date}</td>
                        <td>{e.label}</td>
                        <td><span className="rt-badge-soft text-capitalize">{e.category}</span></td>
                        <td>{e.paidBy}</td>
                        <td className="text-end rt-price">{rm(e.amount, { decimals: 2 })}</td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-danger border-0" onClick={() => removeExpense(trip.id, e.id)} aria-label={`Remove ${e.label}`}>
                            <i className="bi bi-x" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-5 d-grid gap-4 align-content-start">
          {/* ---------- Companions & settlement ---------- */}
          <div className="card p-4">
            <h2 className="h6 fw-bold mb-2">Travel companions &amp; cost split</h2>
            <div className="d-flex flex-wrap gap-2 mb-2">
              {trip.companions.map((c) => (
                <span key={c} className="rt-chip" style={{ cursor: 'default' }}>
                  <i className="bi bi-person" aria-hidden="true" />{c}
                </span>
              ))}
            </div>
            <form
              className="d-flex gap-2 mb-3 rt-no-print"
              onSubmit={(e) => {
                e.preventDefault()
                const name = newCompanion.trim()
                if (name && !trip.companions.includes(name)) updateTrip(trip.id, { companions: [...trip.companions, name] })
                setNewCompanion('')
              }}
            >
              <label className="visually-hidden" htmlFor="new-companion">Add companion</label>
              <input id="new-companion" className="form-control form-control-sm" placeholder="Add companion…" value={newCompanion} onChange={(e) => setNewCompanion(e.target.value)} />
              <button className="btn btn-sm btn-outline-primary" type="submit">Add</button>
            </form>
            {settlement.length > 0 ? (
              <>
                <div className="small fw-bold text-uppercase rt-muted mb-1" style={{ letterSpacing: '0.05em' }}>Settlement (split equally)</div>
                <ul className="list-unstyled small mb-0 d-grid gap-1">
                  {settlement.map((s, i) => (
                    <li key={i}><i className="bi bi-arrow-right-circle text-primary me-2" aria-hidden="true" /><b>{s.from}</b> pays <b>{s.to}</b> {rm(s.amount, { decimals: 2 })}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="small rt-muted mb-0">Record who paid each expense and we'll calculate who owes whom.</p>
            )}
          </div>

          {/* ---------- Checklist ---------- */}
          <div className="card p-4">
            <h2 className="h6 fw-bold mb-2">Trip checklist</h2>
            {checklistGroups.map((g) => (
              <div key={g} className="mb-2">
                <div className="small fw-bold text-uppercase rt-muted" style={{ letterSpacing: '0.05em' }}>{g}</div>
                {trip.checklist.filter((c) => c.group === g).map((c) => (
                  <div className="form-check" key={c.id}>
                    <input
                      className="form-check-input" type="checkbox" id={`chk-${c.id}`}
                      checked={c.done} onChange={() => toggleChecklistItem(trip.id, c.id)}
                    />
                    <label className={`form-check-label ${c.done ? 'text-decoration-line-through rt-muted' : ''}`} htmlFor={`chk-${c.id}`}>
                      {c.label}
                    </label>
                  </div>
                ))}
              </div>
            ))}
            <form
              className="d-flex gap-2 mt-2 rt-no-print"
              onSubmit={(e) => {
                e.preventDefault()
                if (newItem.trim()) addChecklistItem(trip.id, newItem.trim(), 'Custom')
                setNewItem('')
              }}
            >
              <label className="visually-hidden" htmlFor="new-check">Add checklist item</label>
              <input id="new-check" className="form-control form-control-sm" placeholder="Add item…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <button className="btn btn-sm btn-outline-primary" type="submit">Add</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
