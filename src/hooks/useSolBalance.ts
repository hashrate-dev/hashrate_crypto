import { useState, useEffect, useCallback } from 'react'
import { getSolAddressBalance } from '../api/sol'

export function useSolBalance(solAddress: string): {
  balanceSol: string | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [balanceSol, setBalanceSol] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(() => {
    if (!solAddress?.trim()) {
      setBalanceSol(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getSolAddressBalance(solAddress)
      .then(({ balanceSol: sol }) => setBalanceSol(sol))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al conectar con Solana')
        setBalanceSol(null)
      })
      .finally(() => setLoading(false))
  }, [solAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balanceSol, loading, error, refetch: fetchBalance }
}
