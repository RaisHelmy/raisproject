import { PROVIDERS } from '../services/providers'
import { timeAgo } from '../utils/format'

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  connected: { label: 'Connected', class: 'text-bg-success' },
  demo: { label: 'Demo data', class: 'text-bg-warning' },
  'not-configured': { label: 'Not configured', class: 'text-bg-secondary' },
  error: { label: 'Error', class: 'text-bg-danger' },
}

export default function ProvidersPage() {
  return (
    <div className="container py-4">
      <h1 className="h3 fw-bold mb-1">Travel data providers</h1>
      <p className="rt-muted mb-4">
        Every price source is abstracted behind a provider interface. Add real API credentials on the backend
        (Cloudflare Worker) and the corresponding mock switches off — no frontend changes needed.
      </p>
      <div className="card p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr><th>Provider</th><th>Type</th><th>Status</th><th>Last sync</th><th>Rate limit</th><th>Error rate</th></tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => {
                const badge = STATUS_BADGE[p.status]
                return (
                  <tr key={p.id}>
                    <td className="fw-semibold">{p.name}</td>
                    <td className="text-capitalize rt-muted">{p.kind}</td>
                    <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>
                    <td className="rt-muted small">{p.lastSync ? timeAgo(p.lastSync) : '—'}</td>
                    <td className="rt-muted small">{p.rateLimit}</td>
                    <td className="rt-muted small">{p.status === 'demo' ? '0% (mock)' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card p-4 mt-4">
        <h2 className="h6 fw-bold">Security architecture</h2>
        <ul className="small rt-muted mb-0">
          <li>The React app ships <b>public config only</b> — no API secrets or affiliate credentials.</li>
          <li>Provider calls that need secrets are proxied through backend/Cloudflare Workers.</li>
          <li>Booking links are affiliate/deep links; the app never books on the user's behalf.</li>
          <li>Prices are always labeled: live, estimated, or historical average.</li>
        </ul>
      </div>
    </div>
  )
}
