import { useState, useEffect, useCallback } from 'react'
import { getLtcAddressBalance } from '../api/ltc'

export function useLtcBalance(ltcAddress: string): {
  balanceLtc: string | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [balanceLtc, setBalanceLtc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(() => {
    if (!ltcAddress?.trim()) {
      setBalanceLtc(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getLtcAddressBalance(ltcAddress)
      .then(({ balanceLtc: ltc }) => setBalanceLtc(ltc))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al conectar con Litecoin')
        setBalanceLtc(null)
      })
      .finally(() => setLoading(false))
  }, [ltcAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balanceLtc, loading, error, refetch: fetchBalance }
}
