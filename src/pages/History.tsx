import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Zap, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAssetSymbol, formatAmountHistory } from '../store/wallet'
import { useWalletTransactions } from '../hooks/useWalletTransactions'
import { useWalletAddresses } from '../hooks/useWalletAddresses'
import { useAssetCharts } from '../hooks/useAssetCharts'

function getAmountUsd(
  amount: string,
  asset: string,
  currentPrices: { btc: number; usdt: number; doge: number; ltc: number; eth: number; sol: number } | null
): string | null {
  if (!currentPrices) return null
  const n = parseFloat(amount)
  const price =
    asset === 'usdt' ? currentPrices.usdt
    : asset === 'doge' ? currentPrices.doge
    : asset === 'ltc' ? currentPrices.ltc
    : asset === 'eth' ? currentPrices.eth
    : asset === 'sol' ? currentPrices.sol
    : currentPrices.btc
  return (n * price).toFixed(2)
}

export function History() {
  const { transactions, loading, error, refetch } = useWalletTransactions()
  const { btcAddress, solAddress, dogeAddress, ltcAddress, ethAddress } = useWalletAddresses()
  const { currentPrices } = useAssetCharts()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!solAddress) return
    let alive = true
    const tick = () => {
      if (!alive) return
      setRefreshing(true)
      refetch()
        .catch(() => {})
        .finally(() => {
          if (alive) setRefreshing(false)
        })
    }
    // Primer refresh corto para que no dependa de "abrir" en un segundo exacto.
    const t1 = setTimeout(tick, 1500)
    const interval = setInterval(tick, 20000)
    return () => {
      alive = false
      clearTimeout(t1)
      clearInterval(interval)
    }
  }, [refetch, solAddress])

  const formatTransferDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getOurAddressShort = (asset: string) => {
    if (asset === 'btc' && btcAddress) return `${btcAddress.slice(0, 8)}...${btcAddress.slice(-6)}`
    if (asset === 'sol' && solAddress) return `${solAddress.slice(0, 4)}...${solAddress.slice(-4)}`
    if (asset === 'doge' && dogeAddress) return `${dogeAddress.slice(0, 8)}...${dogeAddress.slice(-6)}`
    if (asset === 'ltc' && ltcAddress) return `${ltcAddress.slice(0, 8)}...${ltcAddress.slice(-6)}`
    if (asset === 'eth' && ethAddress) return `${ethAddress.slice(0, 6)}...${ethAddress.slice(-4)}`
    return '—'
  }

  const getFromLabel = (tx: { type: 'send' | 'receive'; asset: string; counterparty: string }) =>
    tx.type === 'receive' ? tx.counterparty : getOurAddressShort(tx.asset)

  const getToLabel = (tx: { type: 'send' | 'receive'; asset: string; counterparty: string }) =>
    tx.type === 'receive' ? getOurAddressShort(tx.asset) : tx.counterparty

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Historial</h1>
      </div>

      {solAddress && (
        <div className="glass rounded-2xl border border-white/10 p-4 mb-4">
          <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Solana · tu wallet (sesión actual)</p>
          <p className="font-mono text-sm text-white/90 break-all">{solAddress}</p>
          <a
            href={`https://solscan.io/account/${solAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-exodus mt-2 hover:underline"
          >
            Ver historial en Solscan <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <p className="text-white/35 text-xs mt-2">
            Los movimientos SOL listados abajo usan esta dirección. Con <code className="text-white/50">SOLSCAN_API_KEY</code> en el backend, los datos coinciden con Solscan.
          </p>
        </div>
      )}

      {error && (
        <div className="glass rounded-2xl border border-amber-500/20 p-4 mb-4 text-amber-400/90 text-sm">
          {error}
        </div>
      )}
      {loading && transactions.length === 0 ? (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          <div className="p-5 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-exodus/50 border-t-exodus rounded-full animate-spin shrink-0" />
            <span className="text-sm text-white/60">Cargando actividad…</span>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          <div className="p-4 text-center text-white/50 text-sm">
            Sin transacciones recientes en esta wallet.
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {transactions.map((tx, i) => {
            const symbol = getAssetSymbol(tx.asset)
            const amountFormatted = formatAmountHistory(tx.amount, tx.asset)
            const usdDisplay = tx.amountUsd ?? getAmountUsd(tx.amount, tx.asset, currentPrices)
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.03 }}
                className="flex items-center gap-4 p-4"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  tx.type === 'receive' ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                }`}>
                  {tx.type === 'receive' ? (
                    <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-rose-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">
                    {tx.type === 'receive' ? 'Recibido' : 'Enviado'}
                    {tx.isLightning && <Zap className="inline w-3.5 h-3.5 text-violet-400 ml-1" />}
                    <span className="text-white/60 font-normal ml-1">· {symbol}</span>
                  </p>
                  <p className="text-xs font-mono text-white/70 mt-0.5 break-all" title={getFromLabel(tx)}>
                    FROM: {getFromLabel(tx)}
                  </p>
                  <p className="text-xs font-mono text-white/70 mt-0.5 break-all" title={getToLabel(tx)}>
                    TO: {getToLabel(tx)}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">TIME: {formatTransferDate(tx.timestamp)}</p>
                  {tx.asset === 'sol' && tx.txHash && (
                    <a
                      href={`https://solscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-exodus/90 hover:underline mt-1"
                    >
                      Ver en Solscan <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-right shrink-0 min-w-0">
                  <p className={`font-mono text-sm font-semibold tabular-nums ${tx.type === 'receive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.type === 'receive' ? '+' : '-'}{amountFormatted} {symbol}
                  </p>
                  <p className="text-xs text-white/50 tabular-nums mt-0.5">
                    {usdDisplay != null ? `$${usdDisplay}` : '—'}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
