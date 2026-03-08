import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Zap, ChevronRight } from 'lucide-react'
import { useAssetCharts } from '../hooks/useAssetCharts'
import { Sparkline } from '../components/Sparkline'

const ASSETS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', variant: 'btc' as const, icon: '₿' },
  { id: 'btc_lightning', name: 'Bitcoin', symbol: 'Lightning', variant: 'lightning' as const, icon: '₿' },
  { id: 'usdt', name: 'Tether', symbol: 'USDT', variant: 'usdt' as const, icon: '₮' },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', variant: 'doge' as const, icon: 'Ð' },
] as const

export function Mercado() {
  const navigate = useNavigate()
  const { chartData, currentPrices, loading, error } = useAssetCharts()

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-white mb-1">Mercado</h1>

      {loading && (
        <div className="text-center py-8 text-white/50 text-sm mb-4">Cargando…</div>
      )}
      {error && (
        <div className="glass rounded-xl p-4 mb-4 border border-amber-500/20 text-amber-400/90 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {ASSETS.map((asset, i) => {
          const price = currentPrices
            ? asset.id === 'usdt'
              ? currentPrices.usdt
              : asset.id === 'doge'
              ? currentPrices.doge
              : currentPrices.btc
            : 0
          const chart = chartData[asset.id] ?? []
          const variationPercent =
            chart.length >= 2
              ? ((chart[chart.length - 1] - chart[0]) / chart[0]) * 100
              : null
          const colors =
            asset.variant === 'btc'
              ? { up: 'rgb(34, 197, 94)', down: 'rgb(239, 68, 68)' }
              : asset.variant === 'lightning'
              ? { up: 'rgb(139, 92, 246)', down: 'rgb(239, 68, 68)' }
              : asset.variant === 'doge'
              ? { up: 'rgb(198, 166, 100)', down: 'rgb(239, 68, 68)' }
              : { up: 'rgb(34, 197, 94)', down: 'rgb(239, 68, 68)' }

          return (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-4 hover:bg-white/5 active:bg-white/[0.07] transition-colors"
            >
              <button
                type="button"
                onClick={() => navigate(`/mercado/${asset.id}`)}
                className="flex flex-1 items-center gap-4 min-w-0 text-left"
              >
                <div className="flex-1 min-w-0 flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      asset.variant === 'btc'
                        ? 'bg-btc/20'
                        : asset.variant === 'lightning'
                        ? 'bg-lightning/20'
                        : asset.variant === 'doge'
                        ? 'bg-amber-200/20'
                        : 'bg-usdt/20'
                    }`}
                  >
                    {asset.icon ? (
                      <span
                        className={`text-3xl font-bold ${
                          asset.variant === 'btc' || asset.variant === 'lightning'
                            ? 'text-btc'
                            : asset.variant === 'usdt'
                            ? 'text-emerald-400'
                            : asset.variant === 'doge'
                            ? 'text-amber-300'
                            : ''
                        }`}
                      >
                        {asset.icon}
                      </span>
                    ) : (
                      <Zap className="w-6 h-6 text-violet-400" strokeWidth={2} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white">{asset.name}</p>
                    <p className="text-sm text-white/50">{asset.symbol}</p>
                  </div>
                </div>
                {chart.length > 0 && (
                  <div className="w-32 h-14 shrink-0 flex items-center justify-center" aria-hidden>
                    <Sparkline
                      data={chart}
                      upColor={colors.up}
                      downColor={colors.down}
                      id={`mercado-${asset.id}`}
                      className="w-full h-full"
                    />
                  </div>
                )}
                <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                  <div className="text-right shrink-0">
                    <p className="font-mono font-semibold text-white">
                      ${price >= 1 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price.toFixed(4)}
                    </p>
                    <p className="text-xs text-white/40 flex items-center justify-end">
                      {variationPercent != null && !Number.isNaN(variationPercent) ? (
                        <span
                          className={`font-semibold tabular-nums ${
                            variationPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {variationPercent >= 0 ? '+' : ''}{variationPercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span>USD</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/40 shrink-0" />
                </div>
              </button>
            </motion.div>
          )
        })}
      </div>

    </div>
  )
}
