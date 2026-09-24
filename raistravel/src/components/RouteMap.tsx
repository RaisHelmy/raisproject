import { useMemo } from 'react'
import type { ComputedLeg } from '../types'
import { DEST_MAP, originPoint } from '../data/destinations'

interface MapPoint { id: string; name: string; lat: number; lng: number; emoji?: string }

function resolve(id: string): MapPoint {
  const d = DEST_MAP[id]
  if (d) return { id, name: d.name, lat: d.lat, lng: d.lng, emoji: d.emoji }
  const o = originPoint(id)
  return { id, name: o.name, lat: o.lat, lng: o.lng, emoji: '🏠' }
}

// Schematic SVG map: projects the trip's coordinates into the viewBox and draws
// the route. Works fully offline; a tile-based map provider can replace it later.
export function RouteMap({ origin, stops, legs, height = 340 }: {
  origin: string
  stops: string[]
  legs?: ComputedLeg[]
  height?: number
}) {
  const points = useMemo(() => {
    const ids = [origin, ...stops]
    return ids.map(resolve)
  }, [origin, stops])

  const W = 640
  const H = 420

  const projected = useMemo(() => {
    const lats = points.map((p) => p.lat)
    const lngs = points.map((p) => p.lng)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const spanLat = Math.max(0.8, maxLat - minLat)
    const spanLng = Math.max(0.8, maxLng - minLng)
    const pad = 70
    return points.map((p) => ({
      ...p,
      x: pad + ((p.lng - minLng) / spanLng) * (W - pad * 2),
      y: H - pad - ((p.lat - minLat) / spanLat) * (H - pad * 2),
    }))
  }, [points])

  const isFlight = (i: number) => legs?.[i]?.mode === 'flight'

  return (
    <div
      className="position-relative rounded-4 overflow-hidden"
      style={{
        height,
        background: 'linear-gradient(160deg,#dcefe9 0%,#cfe7f2 55%,#dbeef4 100%)',
      }}
      role="img"
      aria-label={`Route map: ${projected.map((p) => p.name).join(' to ')}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* subtle grid for a cartographic feel */}
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * (W / 9)} y1={0} x2={(i + 1) * (W / 9)} y2={H} stroke="#ffffff" strokeOpacity={0.35} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i + 1) * (H / 6)} x2={W} y2={(i + 1) * (H / 6)} stroke="#ffffff" strokeOpacity={0.35} />
        ))}
        {/* route lines */}
        {projected.slice(0, -1).map((p, i) => {
          const q = projected[i + 1]
          const mx = (p.x + q.x) / 2
          const my = (p.y + q.y) / 2 - (isFlight(i) ? 46 : 12)
          return (
            <g key={i}>
              <path
                d={`M ${p.x} ${p.y} Q ${mx} ${my} ${q.x} ${q.y}`}
                fill="none"
                stroke={isFlight(i) ? '#4a7ba6' : '#0e7c66'}
                strokeWidth={3}
                strokeDasharray={isFlight(i) ? '2 7' : '9 6'}
                strokeLinecap="round"
              />
              {legs?.[i] && (
                <g>
                  <rect x={mx - 34} y={my - 4} rx={8} width={68} height={18} fill="#ffffff" opacity={0.92} />
                  <text x={mx} y={my + 9} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#16302b">
                    {legs[i].km} km
                  </text>
                </g>
              )}
            </g>
          )
        })}
        {/* stops */}
        {projected.map((p, i) => (
          <g key={p.id + i}>
            <circle cx={p.x} cy={p.y} r={15} fill="#ffffff" stroke={i === 0 ? '#ff6b4a' : '#0e7c66'} strokeWidth={3} />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13">{p.emoji}</text>
            <text x={p.x} y={p.y + 33} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#16302b">
              {p.name}
            </text>
            {i === 0 && (
              <text x={p.x} y={p.y - 22} textAnchor="middle" fontSize="9" fontWeight="800" fill="#c2410c" letterSpacing="1">
                START
              </text>
            )}
          </g>
        ))}
      </svg>
      <span className="position-absolute bottom-0 end-0 m-2 badge text-bg-light rt-muted fw-normal">
        Schematic map · not to scale
      </span>
    </div>
  )
}
