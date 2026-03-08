export interface PortfolioSegment {
  asset: 'btc' | 'btc_lightning' | 'usdt' | 'doge'
  label: string
  amount: string
  valueUsd: number
  percent: number
  color: string
}

interface PortfolioDonutProps {
  segments: PortfolioSegment[]
  totalUsd: number
  onChartClick?: () => void
  size?: number
  strokeWidth?: number
}

/** Donut chart: segmentos por activo con strokeDasharray, total en el centro. Click abre desglose. */
export function PortfolioDonut({
  segments,
  totalUsd,
  onChartClick,
  size = 200,
  strokeWidth = 22,
}: PortfolioDonutProps) {
  const cx = size / 2
  const cy = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const totalPercent = segments.reduce((s, x) => s + x.percent, 0) || 1

  const arcs = segments
    .filter((s) => s.percent > 0)
    .map((seg) => {
      const length = (seg.percent / totalPercent) * circumference
      return { ...seg, length }
    })

  let offset = 0
  const segmentsWithOffset = arcs.map((seg) => {
    const dashOffset = -offset
    offset += seg.length
    return { ...seg, dashOffset }
  })

  const hasSegments = segmentsWithOffset.length > 0

  return (
    <button
      type="button"
      onClick={onChartClick}
      className="group relative block w-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-exodus/50 rounded-full"
      aria-label="Ver proporción del portafolio"
    >
      <svg width={size} height={size} className="shrink-0" style={{ overflow: 'visible' }} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          {hasSegments &&
            segmentsWithOffset.map((seg, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${seg.length} ${circumference}`}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="round"
                className="donut-segment cursor-pointer"
              />
            ))}
        </g>
      </svg>
      <div className="donut-center-value absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold font-mono text-white tabular-nums">
          ${totalUsd >= 1e6 ? (totalUsd / 1e6).toFixed(2) + 'M' : totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-white/50">Total</span>
      </div>
    </button>
  )
}
