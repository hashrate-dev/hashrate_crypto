import { useState, useEffect } from 'react'
import type { AssetType } from '../store/wallet'
import { assetChartData as fallbackChartData } from '../store/wallet'
import { fetchAllAssetCharts, fetchPricesFromBackendOnly, type CurrentPrices } from '../api/prices'

const fallbackPrices: CurrentPrices = { btc: 67000, usdt: 1, doge: 0.1, ltc: 95, eth: 3500, sol: 175 }

/** Mantiene el último precio conocido cuando el nuevo es 0 (no mostrar 0.0000 mientras actualiza). */
function mergeWithPrevious(prev: CurrentPrices | null, next: CurrentPrices): CurrentPrices {
  const use = (newVal: number, key: keyof CurrentPrices) =>
    newVal > 0 ? newVal : (prev?.[key] ?? 0)
  return {
    btc: use(next.btc, 'btc'),
    usdt: use(next.usdt, 'usdt'),
    doge: use(next.doge, 'doge'),
    ltc: use(next.ltc, 'ltc'),
    eth: use(next.eth, 'eth'),
    sol: use(next.sol, 'sol'),
  }
}

export function useAssetCharts(): {
  chartData: Record<AssetType, number[]>
  currentPrices: CurrentPrices | null
  loading: boolean
  error: string | null
} {
  const [chartData, setChartData] = useState<Record<AssetType, number[]>>(fallbackChartData)
  const [currentPrices, setCurrentPrices] = useState<CurrentPrices | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    // 1) Precios primero (una sola llamada al backend Binance) → quitar "Cargando..." enseguida
    fetchPricesFromBackendOnly()
      .then((prices) => {
        if (!cancelled) {
          setCurrentPrices((prev) => mergeWithPrevious(prev, prices))
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentPrices((prev) => mergeWithPrevious(prev, fallbackPrices))
          setLoading(false)
        }
      })

    // 2) Gráficos (sparklines) en segundo plano; al terminar actualizan lista + precios
    fetchAllAssetCharts()
      .then((result) => {
        if (!cancelled) {
          setChartData(result.chartData)
          setCurrentPrices((prev) => mergeWithPrevious(prev, result.currentPrices))
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar gráficos')
          setChartData(fallbackChartData)
        }
      })

    return () => { cancelled = true }
  }, [])

  return { chartData, currentPrices, loading, error }
}
