import { useState, useEffect, useCallback } from 'react'
import { getAddressBalance } from '../api/mempool'

export function useMempoolBtc(btcAddress: string): {
  balanceBtc: string | null
  balanceSats: number | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [balanceBtc, setBalanceBtc] = useState<string | null>(null)
  const [balanceSats, setBalanceSats] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(() => {
    if (!btcAddress?.trim()) {
      setBalanceBtc(null)
      setBalanceSats(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getAddressBalance(btcAddress)
      .then(({ balanceBtc: btc, balanceSats: sats }) => {
        setBalanceBtc(btc)
        setBalanceSats(sats)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al conectar con Mempool')
        setBalanceBtc(null)
        setBalanceSats(null)
      })
      .finally(() => setLoading(false))
  }, [btcAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balanceBtc, balanceSats, loading, error, refetch: fetchBalance }
}
