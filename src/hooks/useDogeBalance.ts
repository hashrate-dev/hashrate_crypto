import { useState, useEffect, useCallback } from 'react'
import { getAddressBalance } from '../api/doge'

export function useDogeBalance(dogeAddress: string): {
  balanceDoge: string | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [balanceDoge, setBalanceDoge] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(() => {
    if (!dogeAddress?.trim()) {
      setBalanceDoge(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getAddressBalance(dogeAddress)
      .then(({ balanceDoge: d }) => setBalanceDoge(d))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al conectar con Dogecoin')
        setBalanceDoge(null)
      })
      .finally(() => setLoading(false))
  }, [dogeAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balanceDoge, loading, error, refetch: fetchBalance }
}
