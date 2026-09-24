import { useState } from 'react'
import { ROUTES } from '../data/routes'
import { DEST_MAP } from '../data/destinations'
import { RouteCard } from '../components/RouteCard'

export default function RoutesPage() {
  const [scope, setScope] = useState<'all' | 'my' | 'intl'>('all')
  const list = ROUTES.filter((r) => {
    const intl = r.stops.some((s) => DEST_MAP[s.destId]?.international)
    if (scope === 'my') return !intl
    if (scope === 'intl') return intl
    return true
  })
  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-1">
        <h1 className="h3 fw-bold mb-0">Curated routes</h1>
        <div className="btn-group" role="group" aria-label="Route scope">
          {([['all', 'All'], ['my', 'Malaysia'], ['intl', 'International']] as const).map(([id, label]) => (
            <button key={id} className={`btn btn-sm ${scope === id ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setScope(id)} aria-pressed={scope === id}>{label}</button>
          ))}
        </div>
      </div>
      <p className="rt-muted mb-4">Proven itineraries with realistic budgets — open one and make it yours.</p>
      <div className="row g-3">
        {list.map((r) => <div className="col-sm-6 col-lg-4 col-xl-3" key={r.slug}><RouteCard route={r} /></div>)}
      </div>
    </div>
  )
}
