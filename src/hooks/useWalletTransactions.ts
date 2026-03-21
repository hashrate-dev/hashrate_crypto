import { useState, useEffect, useCallback, useRef } from 'react'
import type { Transaction } from '../store/wallet'
import { useWalletAddresses } from './useWalletAddresses'
import { fetchBtcTransactions, fetchSolTransactions, fetchDogeTransactions, fetchLtcTransactions, fetchEthTransactions } from '../api/transactions'

/** Transacciones de la wallet actual: BTC, SOL, DOGE, LTC, ETH según direcciones vinculadas. SOL = Helius/Orb; BTC = mempool.space; DOGE/LTC = BlockCypher; ETH = Etherscan. */
export function useWalletTransactions(): {
  transactions: Transaction[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
} {
  const { btcAddress, solAddress, dogeAddress, ltcAddress, ethAddress } = useWalletAddresses()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadIdRef = useRef(0)

  const load = useCallback(async () => {
    const hasBtc = !!(btcAddress && btcAddress.trim())
    const hasSol = !!(solAddress && solAddress.trim())
    const hasDoge = !!(dogeAddress && dogeAddress.trim())
    const hasLtc = !!(ltcAddress && ltcAddress.trim())
    const hasEth = !!(ethAddress && ethAddress.trim())
    if (!hasBtc && !hasSol && !hasDoge && !hasLtc && !hasEth) {
      setTransactions([])
      setLoading(false)
      setError(null)
      return
    }
    const loadId = ++loadIdRef.current
    setLoading(true)
    setError(null)
    try {
      const btcPromise = hasBtc ? fetchBtcTransactions(btcAddress) : Promise.resolve([])
      const solPromise = hasSol ? fetchSolTransactions(solAddress) : Promise.resolve([])
      const dogePromise = hasDoge ? fetchDogeTransactions(dogeAddress) : Promise.resolve([])
      const ltcPromise = hasLtc ? fetchLtcTransactions(ltcAddress) : Promise.resolve([])
      const ethPromise = hasEth ? fetchEthTransactions(ethAddress) : Promise.resolve([])
      const [btcTxs, solTxs, dogeTxs, ltcTxs, ethTxs] = await Promise.all([btcPromise, solPromise, dogePromise, ltcPromise, ethPromise])
      if (loadIdRef.current !== loadId) return
      const merged = [...btcTxs, ...solTxs, ...dogeTxs, ...ltcTxs, ...ethTxs].sort((a, b) => b.timestamp - a.timestamp)
      setTransactions((prev) => {
        if (merged.length > 0) return merged
        if (prev.length > 0) return prev
        return merged
      })
    } catch (e) {
      if (loadIdRef.current !== loadId) return
      setError(e instanceof Error ? e.message : 'Error al cargar transacciones')
      setTransactions((prev) => (prev.length > 0 ? prev : []))
    } finally {
      if (loadIdRef.current === loadId) setLoading(false)
    }
  }, [btcAddress, solAddress])

  useEffect(() => {
    load()
  }, [load])

  return { transactions, loading, error, refetch: load }
}
