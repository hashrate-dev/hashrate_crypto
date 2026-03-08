import { useState, useEffect } from 'react'
import type { AssetType } from '../store/wallet'
import { assetChartData as fallbackChartData } from '../store/wallet'
import { fetchAllAssetCharts, type CurrentPrices } from '../api/prices'

const fallbackPrices: CurrentPrices = { btc: 67000, usdt: 1, doge: 0.1 }

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
    fetchAllAssetCharts()
      .then((result) => {
        if (!cancelled) {
          setChartData(result.chartData)
          setCurrentPrices(result.currentPrices)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar precios')
          setChartData(fallbackChartData)
          setCurrentPrices(fallbackPrices)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { chartData, currentPrices, loading, error }
}
