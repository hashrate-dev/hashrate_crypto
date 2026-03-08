import { useMemo, useState, useCallback } from 'react'

const VIEWBOX_WIDTH = 400

interface PriceChartProps {
  data: number[]
  lineColor?: string
  lineColorDown?: string
  height?: number
  className?: string
  /** Id único para el gradiente SVG (evitar duplicados al cambiar de moneda). */
  id?: string
  /** Decimales para etiquetas Max/Min (ej. 1 = "1.0" en Tether). */
  priceLabelDecimals?: number
}

export function PriceChart({
  data,
  lineColor = 'rgb(24, 152, 238)',
  lineColorDown = 'rgb(239, 68, 68)',
  height = 220,
  className = '',
  id = 'price-chart',
  priceLabelDecimals,
}: PriceChartProps) {
  const chartGeometry = useMemo(() => {
    const valid = data.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    if (!valid.length) return null
    const points = valid.length === 1 ? [valid[0], valid[0]] : valid
    const w = VIEWBOX_WIDTH
    const h = height - 20
    const padding = 10
    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    const step = (w - padding * 2) / (points.length - 1 || 1)
    const pathPoints = points.map((value, i) => {
      const x = padding + i * step
      const y = padding + (max - value) / range * (h - padding * 2)
      return [x, y] as const
    })
    const d = pathPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
    const last = pathPoints[pathPoints.length - 1]
    const first = pathPoints[0]
    const area = `${d} L ${last[0]} ${h + padding} L ${first[0]} ${h + padding} Z`
    const isUp = points[points.length - 1] >= points[0]
    const yMaxPrice = padding
    const yMinPrice = h - padding
    return {
      pathD: d,
      areaD: area,
      strokeColor: isUp ? lineColor : lineColorDown,
      pathPoints,
      points,
      padding,
      chartHeight: h,
      minVal: min,
      maxVal: max,
      yMaxPrice,
      yMinPrice,
    }
  }, [data, height, lineColor, lineColorDown])

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!chartGeometry) return
      const { points, padding } = chartGeometry
      const rect = e.currentTarget.getBoundingClientRect()
      const xFraction = (e.clientX - rect.left) / rect.width
      const xViewBox = xFraction * VIEWBOX_WIDTH
      const step = (VIEWBOX_WIDTH - padding * 2) / (points.length - 1 || 1)
      let index = Math.round((xViewBox - padding) / step)
      index = Math.max(0, Math.min(index, points.length - 1))
      setHoveredIndex(index)
    },
    [chartGeometry]
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null)
  }, [])

  if (!chartGeometry || !data.length || !chartGeometry.pathD) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <span className="text-white/40 text-sm">Sin datos</span>
      </div>
    )
  }

  const { pathD, areaD, strokeColor, pathPoints, points, padding, chartHeight, minVal, maxVal, yMaxPrice, yMinPrice } = chartGeometry
  const showHover = hoveredIndex !== null && pathPoints[hoveredIndex]
  const hoverX = showHover ? pathPoints[hoveredIndex][0] : 0
  const hoverPrice = showHover ? points[hoveredIndex] : 0

  const decimals = (() => {
    if (priceLabelDecimals !== undefined) return priceLabelDecimals
    const max = maxVal
    if (max >= 1000) return 0
    if (max >= 100) return 1
    if (max >= 10) return 2
    if (max >= 1) return 2
    if (max >= 0.1) return 3
    if (max >= 0.01) return 4
    return 6
  })()

  let labelDecimals = decimals
  while (labelDecimals <= 8 && minVal !== maxVal && minVal.toFixed(labelDecimals) === maxVal.toFixed(labelDecimals)) {
    labelDecimals += 1
  }

  const formatPriceLabel = (val: number) => {
    if (labelDecimals === 0) return `$ ${Math.round(val).toLocaleString('en-US')}`
    return `$ ${val.toLocaleString('en-US', { minimumFractionDigits: labelDecimals, maximumFractionDigits: labelDecimals })}`
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full block"
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Cuadrícula suave */}
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
          {[1, 2, 3, 4].map((i) => (
            <line
              key={`h-${i}`}
              x1={padding}
              y1={padding + (i / 5) * (chartHeight - padding * 2)}
              x2={VIEWBOX_WIDTH - padding}
              y2={padding + (i / 5) * (chartHeight - padding * 2)}
            />
          ))}
          {[1, 2, 3, 4].map((i) => (
            <line
              key={`v-${i}`}
              x1={padding + (i / 5) * (VIEWBOX_WIDTH - padding * 2)}
              y1={padding}
              x2={padding + (i / 5) * (VIEWBOX_WIDTH - padding * 2)}
              y2={chartHeight + padding}
            />
          ))}
        </g>
        {/* Líneas de precio máximo y mínimo */}
        <line
          x1={padding}
          y1={yMaxPrice}
          x2={VIEWBOX_WIDTH - padding}
          y2={yMaxPrice}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={padding}
          y1={yMinPrice}
          x2={VIEWBOX_WIDTH - padding}
          y2={yMinPrice}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={padding}
          y={yMaxPrice + 12}
          fill="rgba(255,255,255,0.6)"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          textAnchor="start"
        >
          Max {formatPriceLabel(maxVal)}
        </text>
        <text
          x={padding}
          y={yMinPrice + 12}
          fill="rgba(255,255,255,0.6)"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          textAnchor="start"
        >
          Min {formatPriceLabel(minVal)}
        </text>
        <path d={areaD} fill={`url(#${id}-fill)`} />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {showHover && (
          <g>
            <line
              x1={hoverX}
              y1={padding}
              x2={hoverX}
              y2={chartHeight + padding}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
              strokeDasharray="4 2"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoverX}
              cy={pathPoints[hoveredIndex!][1]}
              r="4"
              fill={strokeColor}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>
      {showHover && (
        <div
          className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-lg bg-surface-900/95 border border-white/10 text-white text-sm font-mono shadow-xl"
          style={{
            left: `${(hoverX / VIEWBOX_WIDTH) * 100}%`,
            top: 8,
            transform: 'translateX(-50%)',
          }}
        >
          {hoverPrice >= 1
            ? `$${hoverPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `$${hoverPrice.toFixed(4)}`}
        </div>
      )}
    </div>
  )
}
