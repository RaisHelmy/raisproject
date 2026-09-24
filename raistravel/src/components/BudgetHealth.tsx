import { rm } from '../utils/format'

export function BudgetHealth({ spent, budget, compact = false }: { spent: number; budget: number; compact?: boolean }) {
  if (budget <= 0) return null
  const pct = Math.round((spent / budget) * 100)
  const over = spent > budget
  return (
    <div>
      <div className="d-flex justify-content-between align-items-baseline mb-1">
        <span className={compact ? 'small fw-semibold' : 'fw-semibold'}>
          {rm(spent)} <span className="rt-muted fw-normal">/ {rm(budget)}</span>
        </span>
        <span className={`fw-bold ${over ? 'text-danger' : 'text-success'}`}>{pct}%</span>
      </div>
      <div
        className="progress"
        style={{ height: compact ? 8 : 10 }}
        role="progressbar"
        aria-valuenow={Math.min(pct, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Budget used: ${pct}%`}
      >
        <div className={`progress-bar ${over ? 'over' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {!compact && (
        <div className={`small mt-1 fw-semibold ${over ? 'text-danger' : 'text-success'}`}>
          {over ? (
            <><i className="bi bi-exclamation-triangle me-1" />{rm(spent - budget)} over budget</>
          ) : (
            <><i className="bi bi-check-circle me-1" />Within budget · {rm(budget - spent)} to spare</>
          )}
        </div>
      )}
    </div>
  )
}
