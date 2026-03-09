import { useState, useEffect, useCallback } from 'react'
import { getEthBalance } from '../api/eth'

export function useEthBalance(ethAddress: string): {
  balanceEth: string | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [balanceEth, setBalanceEth] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(() => {
    if (!ethAddress?.trim() || !ethAddress.startsWith('0x')) {
      setBalanceEth(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getEthBalance(ethAddress)
      .then(({ balanceEth: eth }) => setBalanceEth(eth))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al conectar con Ethereum')
        setBalanceEth(null)
      })
      .finally(() => setLoading(false))
  }, [ethAddress])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balanceEth, loading, error, refetch: fetchBalance }
}
