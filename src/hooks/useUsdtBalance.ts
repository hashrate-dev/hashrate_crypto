import { useState, useEffect, useCallback } from 'react'
import { getUsdtBalance } from '../api/usdt'

export function useUsdtBalance(usdtAddress: string): {
  balanceUsdt: string | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [balanceUsdt, setBalanceUsdt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(() => {
    if (!usdtAddress?.trim() || !usdtAddress.startsWith('0x')) {
      setBalanceUsdt(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getUsdtBalance(usdtAddress)
      .then(({ balanceUsdt: amount }) => setBalanceUsdt(amount))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al conectar con la red')
        setBalanceUsdt(null)
      })
      .finally(() => setLoading(false))
  }, [usdtAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balanceUsdt, loading, error, refetch: fetchBalance }
}
