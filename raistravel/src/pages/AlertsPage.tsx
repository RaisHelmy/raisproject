import { useState } from 'react'
import { useTrips, addAlert, toggleAlert, removeAlert } from '../hooks/useTrips'
import { rm, timeAgo } from '../utils/format'
import type { PriceAlert } from '../types'

const KINDS: { id: PriceAlert['kind']; label: string; icon: string; placeholder: string }[] = [
  { id: 'hotel', label: 'Hotel price', icon: 'bi-building', placeholder: 'e.g. Hotels in Penang' },
  { id: 'flight', label: 'Flight price', icon: 'bi-airplane', placeholder: 'e.g. KL → Langkawi' },
  { id: 'trip', label: 'Total trip cost', icon: 'bi-suitcase', placeholder: 'e.g. Penang + Langkawi trip' },
]

export default function AlertsPage() {
  const { alerts } = useTrips()
  const [kind, setKind] = useState<PriceAlert['kind']>('hotel')
  const [label, setLabel] = useState('')
  const [threshold, setThreshold] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = Number(threshold)
    if (!label.trim() || !t) return
    addAlert({ kind, label: label.trim(), threshold: t })
    setLabel('')
    setThreshold('')
  }

  const meta = KINDS.find((k) => k.id === kind)!

  return (
    <div className="container py-4">
      <h1 className="h3 fw-bold mb-1">Price alerts</h1>
      <p className="rt-muted mb-4">We'll notify you when a price drops below your target.</p>

      <div className="row g-4">
        <div className="col-lg-5">
          <form className="card p-4" onSubmit={submit}>
            <div className="d-flex gap-2 mb-3">
              {KINDS.map((k) => (
                <button
                  key={k.id} type="button"
                  className={`rt-chip ${kind === k.id ? 'active' : ''}`}
                  onClick={() => setKind(k.id)}
                  aria-pressed={kind === k.id}
                >
                  <i className={`bi ${k.icon}`} aria-hidden="true" />{k.label}
                </button>
              ))}
            </div>
            <label className="form-label" htmlFor="alert-label">What to watch</label>
            <input id="alert-label" className="form-control mb-3" placeholder={meta.placeholder} value={label} onChange={(e) => setLabel(e.target.value)} />
            <label className="form-label" htmlFor="alert-threshold">
              Notify me when {kind === 'hotel' ? 'price/night' : kind === 'flight' ? 'fare' : 'total'} is below (RM)
            </label>
            <input id="alert-threshold" type="number" min={1} className="form-control mb-3" placeholder="e.g. 350" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            <button className="btn btn-primary" type="submit"><i className="bi bi-bell me-1" aria-hidden="true" />Create alert</button>
            <p className="small rt-muted mt-3 mb-0">
              <i className="bi bi-info-circle me-1" aria-hidden="true" />
              Demo build: alerts are stored locally. The production architecture runs checks on Cloudflare Workers cron and delivers email/push notifications.
            </p>
          </form>
        </div>
        <div className="col-lg-7">
          {alerts.length === 0 ? (
            <div className="card p-5 text-center h-100 justify-content-center">
              <i className="bi bi-bell-slash fs-1 rt-muted" aria-hidden="true" />
              <p className="mt-3 mb-0 rt-muted">No alerts yet — create one to start watching prices.</p>
            </div>
          ) : (
            alerts.map((a) => {
              const k = KINDS.find((x) => x.id === a.kind)!
              return (
                <div className="card p-3 mb-2 d-flex flex-row justify-content-between align-items-center" key={a.id}>
                  <div>
                    <div className="fw-semibold"><i className={`bi ${k.icon} text-primary me-2`} aria-hidden="true" />{a.label}</div>
                    <div className="small rt-muted">Below {rm(a.threshold)} · created {timeAgo(a.createdAt)} · {a.active ? 'watching' : 'paused'}</div>
                  </div>
                  <div className="d-flex gap-2">
                    <div className="form-check form-switch mb-0">
                      <input className="form-check-input" type="checkbox" checked={a.active} onChange={() => toggleAlert(a.id)} aria-label={`${a.active ? 'Pause' : 'Resume'} alert: ${a.label}`} />
                    </div>
                    <button className="btn btn-sm btn-outline-danger border-0" onClick={() => removeAlert(a.id)} aria-label={`Delete alert: ${a.label}`}>
                      <i className="bi bi-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
