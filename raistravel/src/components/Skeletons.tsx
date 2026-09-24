export function SkeletonLines({ count = 3, message }: { count?: number; message?: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      {message && (
        <p className="rt-muted small mb-2">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          {message}
        </p>
      )}
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rt-skeleton mb-2" style={{ height: 18, width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 3, message }: { count?: number; message?: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      {message && (
        <p className="rt-muted small mb-3">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          {message}
        </p>
      )}
      <div className="row g-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="col-md-4">
            <div className="card p-3">
              <div className="rt-skeleton mb-2" style={{ height: 100 }} />
              <div className="rt-skeleton mb-2" style={{ height: 16, width: '70%' }} />
              <div className="rt-skeleton" style={{ height: 14, width: '45%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry, onFallback, fallbackLabel }: {
  message: string
  onRetry?: () => void
  onFallback?: () => void
  fallbackLabel?: string
}) {
  return (
    <div className="card p-4 text-center">
      <i className="bi bi-cloud-slash fs-2 rt-muted" aria-hidden="true" />
      <p className="mb-3 mt-2">{message}</p>
      <div className="d-flex gap-2 justify-content-center">
        {onFallback && <button className="btn btn-primary btn-sm" onClick={onFallback}>{fallbackLabel ?? 'Use estimates'}</button>}
        {onRetry && <button className="btn btn-outline-primary btn-sm" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  )
}
