import type { ComputedLeg } from '../types'
import { formatDuration } from '../utils/format'

const MODE_META: Record<string, { icon: string; label: string }> = {
  car: { icon: 'bi-car-front', label: 'Drive' },
  ev: { icon: 'bi-ev-front', label: 'Drive (EV)' },
  bus: { icon: 'bi-bus-front', label: 'Bus / train' },
  train: { icon: 'bi-train-front', label: 'Train' },
  flight: { icon: 'bi-airplane', label: 'Flight' },
  ferry: { icon: 'bi-water', label: 'Drive + ferry' },
}

// Vertical START → stop → stop timeline with leg details between stops.
export function RouteTimeline({ legs, showCosts = false }: { legs: ComputedLeg[]; showCosts?: boolean }) {
  if (legs.length === 0) return null
  return (
    <div>
      {legs.map((leg, i) => {
        const meta = MODE_META[leg.mode] ?? { icon: 'bi-signpost', label: leg.mode }
        return (
          <div className="rt-route-stop" key={i}>
            <div className="marker">
              <div className="pin">{i === 0 ? <i className="bi bi-house" aria-hidden="true" /> : i}</div>
              <div className="line" aria-hidden="true" />
            </div>
            <div className="pb-3 flex-grow-1">
              <div className="fw-bold">{leg.fromName}</div>
              <div className="small rt-muted my-1 d-flex flex-wrap align-items-center gap-2">
                <span className="rt-badge-soft"><i className={`bi ${meta.icon} me-1`} aria-hidden="true" />{meta.label}</span>
                <span>{leg.km} km</span>
                <span>·</span>
                <span>{formatDuration(leg.durationMin)}</span>
                {showCosts && <><span>·</span><span className="fw-semibold">RM{leg.cost.toLocaleString()}</span></>}
              </div>
              {leg.note && <div className="small rt-muted fst-italic">{leg.note}</div>}
            </div>
          </div>
        )
      })}
      <div className="rt-route-stop">
        <div className="marker">
          <div className="pin"><i className="bi bi-flag" aria-hidden="true" /></div>
        </div>
        <div className="fw-bold pt-1">{legs[legs.length - 1].toName}</div>
      </div>
    </div>
  )
}
