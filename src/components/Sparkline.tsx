interface SparklineProps {
  /** Valores de precio (ej. últimos 7-30 días). El último = precio actual. */
  data: number[]
  /** Color de la línea cuando la tendencia es alcista */
  upColor?: string
  /** Color de la línea cuando la tendencia es bajista */
  downColor?: string
  /** Relleno bajo la línea (gradiente) */
  fill?: boolean
  /** Id único para gradientes SVG (evitar duplicados en el DOM) */
  id?: string
  className?: string
}

const W = 64
const H = 28

export function Sparkline({
  data,
  upColor = 'rgb(34, 197, 94)',
  downColor = 'rgb(239, 68, 68)',
  fill = true,
  id = 'spark',
  className = '',
}: SparklineProps) {
  if (!data.length) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2
  const step = (W - padding * 2) / (data.length - 1 || 1)

  const points = data.map((value, i) => {
    const x = padding + i * step
    const y = H - padding - ((value - min) / range) * (H - padding * 2)
    return [x, y] as const
  })

  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1][0]} ${H} L ${points[0][0]} ${H} Z`
  const isUp = data[data.length - 1] >= data[0]
  const strokeColor = isUp ? upColor : downColor
  const gradientId = `spark-fill-${id}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path
          d={areaD}
          fill={`url(#${gradientId})`}
        />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
