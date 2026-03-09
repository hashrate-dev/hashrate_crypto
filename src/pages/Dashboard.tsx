import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Send, QrCode, ArrowUpRight, ArrowDownLeft, Zap, X } from 'lucide-react'
import { AssetRow } from '../components/AssetRow'
import { PortfolioDonut, type PortfolioSegment } from '../components/PortfolioDonut'
import { initialWalletState, getTotalUsd, getAssetPrimaryName, getAssetSecondaryName, getAssetSymbol, type Balance } from '../store/wallet'
import { useAssetCharts } from '../hooks/useAssetCharts'
import { useMempoolBtc } from '../hooks/useMempoolBtc'
import { useUsdtBalance } from '../hooks/useUsdtBalance'
import { useDogeBalance } from '../hooks/useDogeBalance'
import { useLtcBalance } from '../hooks/useLtcBalance'
import { useEthBalance } from '../hooks/useEthBalance'
import { useWalletAddresses } from '../hooks/useWalletAddresses'
import type { AssetType } from '../store/wallet'

/** Valor en USD del activo: balance × precio actual (Binance). */
function getAmountUsd(
  amount: string,
  asset: AssetType,
  currentPrices: { btc: number; usdt: number; doge: number; ltc: number; eth: number } | null,
  fallbackUsd?: string
): string {
  if (!currentPrices) return fallbackUsd ?? '0.00'
  const n = parseFloat(amount)
  const price =
    asset === 'usdt' ? currentPrices.usdt
    : asset === 'doge' ? currentPrices.doge
    : asset === 'ltc' ? currentPrices.ltc
    : asset === 'eth' ? currentPrices.eth
    : currentPrices.btc
  return (n * price).toFixed(2)
}

const SEGMENT_COLORS: Record<string, string> = {
  btc: 'rgb(245, 158, 11)',
  btc_lightning: 'rgb(139, 92, 246)',
  usdt: 'rgb(52, 211, 153)',
  doge: 'rgb(198, 166, 100)',
  ltc: 'rgb(191, 191, 191)',
  eth: 'rgb(98, 126, 234)',
}

export function Dashboard() {
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const { balances: baseBalances } = initialWalletState
  const { btcAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress, hasLinkedWallet } = useWalletAddresses()
  const { chartData, currentPrices, loading: chartsLoading, error: chartsError } = useAssetCharts()
  const { balanceBtc: mempoolBtc } = useMempoolBtc(btcAddress)
  const { balanceUsdt: usdtBalance } = useUsdtBalance(usdtAddress)
  const { balanceDoge: dogeBalance } = useDogeBalance(dogeAddress)
  const { balanceLtc: ltcBalance } = useLtcBalance(ltcAddress)
  const { balanceEth: ethBalance } = useEthBalance(ethAddress)

  // Cuentas nuevas (sin wallet vinculada): saldo 0 en todo. No usar direcciones ni saldos de ejemplo.
  const balances = useMemo((): Balance[] => {
    return baseBalances.map((b) => {
      if (b.asset === 'btc') return { ...b, amount: mempoolBtc ?? '0', amountUsd: undefined }
      if (b.asset === 'usdt') return { ...b, amount: usdtBalance ?? '0', amountUsd: undefined }
      if (b.asset === 'doge') return { ...b, amount: dogeBalance ?? '0', amountUsd: undefined }
      if (b.asset === 'ltc') return { ...b, amount: ltcBalance ?? '0', amountUsd: undefined }
      if (b.asset === 'eth') return { ...b, amount: ethBalance ?? '0', amountUsd: undefined }
      if (b.asset === 'btc_lightning') return { ...b, amount: hasLinkedWallet ? b.amount : '0', amountUsd: hasLinkedWallet ? b.amountUsd : undefined }
      return b
    })
  }, [baseBalances, mempoolBtc, usdtBalance, dogeBalance, ltcBalance, ethBalance, hasLinkedWallet])

  /** Lista para mostrar: Bitcoin unificado (red base + Lightning en una sola fila). */
  const displayBalances = useMemo((): Balance[] => {
    const btc = balances.find((b) => b.asset === 'btc')
    const lightning = balances.find((b) => b.asset === 'btc_lightning')
    return balances
      .filter((b) => b.asset !== 'btc_lightning')
      .map((b) => {
        if (b.asset === 'btc' && btc && lightning) {
          const totalBtc = parseFloat(btc.amount) + parseFloat(lightning.amount)
          return { ...b, amount: totalBtc.toFixed(8) }
        }
        return b
      })
  }, [balances])

  const totalUsdNum = currentPrices
    ? balances.reduce(
        (sum, b) =>
          sum + parseFloat(getAmountUsd(b.amount, b.asset, currentPrices, b.amountUsd)),
        0
      )
    : parseFloat(getTotalUsd(balances))

  const segments = useMemo((): PortfolioSegment[] => {
    const list = displayBalances.map((b) => {
      const valueUsd = currentPrices
        ? parseFloat(getAmountUsd(b.amount, b.asset, currentPrices, b.amountUsd))
        : parseFloat(b.amountUsd ?? '0')
      return {
        asset: b.asset,
        label: `${getAssetPrimaryName(b.asset)} (${getAssetSecondaryName(b.asset)})`,
        amount: b.amount,
        valueUsd,
        percent: totalUsdNum > 0 ? (valueUsd / totalUsdNum) * 100 : 0,
        color: SEGMENT_COLORS[b.asset] ?? 'rgba(255,255,255,0.3)',
      }
    })
    return list
  }, [displayBalances, currentPrices, totalUsdNum])

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Gráfico circular tipo Exodus: total en el centro, al tocar abre desglose */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex justify-center"
      >
        <div className="relative rounded-3xl border border-white/5 w-full overflow-visible bg-surface-900/95 backdrop-blur-xl">
          {/* Fondo recortado al borde redondeado para que no se salga */}
          <div className="portfolio-card-bg rounded-3xl absolute inset-0 overflow-hidden pointer-events-none" aria-hidden />
          <div className="relative z-10 py-4 px-5 sm:px-6 min-h-0 flex flex-col items-center justify-center">
            <p className="text-white/50 text-sm font-medium mb-2 text-center">Portfolio total</p>
            {/* Contenedor con margen para que la elevación del hover no se recorte */}
            <div className="overflow-visible" style={{ padding: '4px' }}>
              <PortfolioDonut
                segments={segments}
                totalUsd={totalUsdNum}
                onChartClick={() => setBreakdownOpen(true)}
                size={200}
                strokeWidth={20}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Overlay: proporción en $ y % por moneda */}
      <AnimatePresence>
        {breakdownOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setBreakdownOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass rounded-2xl border border-white/10 w-full max-w-sm overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <h3 className="text-lg font-semibold text-white">Proporción del portafolio</h3>
                <button
                  type="button"
                  onClick={() => setBreakdownOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 pt-4 pb-2">
                <p className="text-2xl font-bold font-mono text-white tabular-nums">
                  ${totalUsdNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-white/50 mt-0.5">Total de la wallet</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-white/10">
                    {segments.map((seg) => (
                      <div
                        key={seg.asset}
                        className="h-full transition-all"
                        style={{
                          width: `${seg.percent}%`,
                          backgroundColor: seg.color,
                          minWidth: seg.percent > 0 ? 2 : 0,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-white/70 tabular-nums">100%</span>
                </div>
              </div>
              <div className="p-4 pt-3 space-y-3">
                {segments.map((seg) => (
                  <div
                    key={seg.asset}
                    className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-white/5"
                  >
                    <div className="min-w-0 shrink-0 flex-1">
                      <p className="text-lg font-semibold text-white">{getAssetPrimaryName(seg.asset)}</p>
                      <p className="text-base text-white/50">{getAssetSecondaryName(seg.asset)}</p>
                    </div>
                    {/* Columna fija: círculos alineados uno debajo del otro */}
                    <div className="w-[28px] flex items-center justify-center shrink-0">
                      <div
                        className="rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: seg.color,
                          width: `${6 + (seg.percent / 100) * 18}px`,
                          height: `${6 + (seg.percent / 100) * 18}px`,
                          minWidth: 6,
                          minHeight: 6,
                        }}
                      />
                    </div>
                    {/* Columna fija: % alineados en la misma columna */}
                    <div className="w-[56px] shrink-0 text-right">
                      <span
                        className="font-bold tabular-nums text-lg"
                        style={{ color: seg.color }}
                      >
                        {seg.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="shrink-0 min-w-[90px] text-right">
                      <p className="font-mono text-sm text-white/80 tabular-nums whitespace-nowrap">
                        {seg.asset === 'usdt'
                          ? parseFloat(seg.amount).toFixed(2)
                          : parseFloat(seg.amount).toFixed(8)}
                        {' '}{getAssetSymbol(seg.asset)}
                      </p>
                      <p className="font-mono font-semibold text-lg text-white tabular-nums mt-0.5">
                        ${seg.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mb-6">
        <Link to="/send" className="flex-1">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="glass rounded-xl py-3 px-4 flex items-center justify-center gap-2 glass-hover border border-white/5"
          >
            <Send className="w-5 h-5 text-exodus" strokeWidth={2} />
            <span className="font-semibold text-white text-sm">Enviar</span>
          </motion.div>
        </Link>
        <Link to="/receive" className="flex-1">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="glass rounded-xl py-3 px-4 flex items-center justify-center gap-2 glass-hover border border-white/5"
          >
            <QrCode className="w-5 h-5 text-exodus" strokeWidth={2} />
            <span className="font-semibold text-white text-sm">Recibir</span>
          </motion.div>
        </Link>
      </div>

      <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-medium text-white/60">Activos</h2>
        {chartsLoading && (
          <span className="text-xs text-white/40">Cargando…</span>
        )}
        {chartsError && !chartsLoading && (
          <span className="text-xs text-amber-400/80" title={chartsError}>Demo</span>
        )}
      </div>
      <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
        {displayBalances.map((b, i) => (
          <Link
            key={b.asset}
            to={`/mercado/${b.asset}`}
            className="block no-underline"
          >
            <AssetRow
              asset={b.asset}
              amount={b.amount}
              amountUsd={getAmountUsd(b.amount, b.asset, currentPrices, b.amountUsd)}
              variant={b.asset === 'usdt' ? 'usdt' : b.asset === 'doge' ? 'doge' : b.asset === 'ltc' ? 'ltc' : b.asset === 'eth' ? 'eth' : 'btc'}
              chartData={chartData[b.asset]}
              currentPrice={currentPrices ? (b.asset === 'usdt' ? currentPrices.usdt : b.asset === 'doge' ? currentPrices.doge : b.asset === 'ltc' ? currentPrices.ltc : b.asset === 'eth' ? currentPrices.eth : currentPrices.btc) : undefined}
              delay={i * 0.05}
            />
          </Link>
        ))}
      </div>
      {hasLinkedWallet && initialWalletState.transactions.length > 0 && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white/60">Actividad reciente</h2>
          <Link to="/history" className="text-sm text-exodus font-medium flex items-center gap-1">
            Ver todo <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {initialWalletState.transactions.slice(0, 3).map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
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
                <p className="font-medium text-white truncate">
                  {tx.type === 'receive' ? 'Recibido' : 'Enviado'}
                  {tx.isLightning && <Zap className="inline w-3.5 h-3.5 text-violet-400 ml-1" />}
                </p>
                <p className="text-sm text-white/50 break-all">{tx.counterparty}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-mono font-medium ${tx.type === 'receive' ? 'text-emerald-400' : 'text-white'}`}>
                  {tx.type === 'receive' ? '+' : '-'}{tx.amount} {tx.asset === 'usdt' ? 'USDT' : tx.asset === 'doge' ? 'DOGE' : tx.asset === 'ltc' ? 'LTC' : tx.asset === 'eth' ? 'ETH' : 'BTC'}
                </p>
                <p className="text-xs text-white/40">${tx.amountUsd}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
      )}
    </div>
  )
}
