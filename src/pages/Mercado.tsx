import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Zap, ChevronRight } from 'lucide-react'
import { useAssetCharts } from '../hooks/useAssetCharts'
import { ETH_LOGO_URL } from '../lib/assetLogos'
import { Sparkline } from '../components/Sparkline'

/** Una sola entrada para Bitcoin (incluye red base y Lightning); en Mercado se muestra unificado. */
const ASSETS = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC', variant: 'btc' as const, icon: '₿' },
  { id: 'usdt', name: 'Tether', symbol: 'USDT', variant: 'usdt' as const, icon: '₮' },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', variant: 'doge' as const, icon: 'Ð' },
  { id: 'ltc', name: 'Litecoin', symbol: 'LTC', variant: 'ltc' as const, icon: 'Ł' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH', variant: 'eth' as const, icon: 'Ξ' },
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

      <div className="space-y-2">
        {ASSETS.map((asset, i) => {
          const price = currentPrices
            ? asset.id === 'usdt'
              ? currentPrices.usdt
              : asset.id === 'doge'
              ? currentPrices.doge
              : asset.id === 'ltc'
              ? currentPrices.ltc
              : asset.id === 'eth'
              ? currentPrices.eth
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
              : asset.variant === 'ltc'
              ? { up: 'rgb(148, 163, 184)', down: 'rgb(239, 68, 68)' }
              : asset.variant === 'eth'
              ? { up: 'rgb(99, 102, 241)', down: 'rgb(239, 68, 68)' }
              : { up: 'rgb(34, 197, 94)', down: 'rgb(239, 68, 68)' }

          return (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl border border-white/5 p-4 transition-all hover:bg-white/5 hover:border-white/10 active:scale-[0.99]"
            >
              <button
                type="button"
                onClick={() => navigate(`/mercado/${asset.id}`)}
                className="flex w-full items-center gap-4 min-w-0 text-left"
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-white/10 ${
                    asset.variant === 'btc'
                      ? 'bg-btc/20'
                      : asset.variant === 'lightning'
                      ? 'bg-lightning/20'
                      : asset.variant === 'doge'
                      ? 'bg-amber-200/20'
                      : asset.variant === 'ltc'
                      ? 'bg-slate-400/20'
                      : asset.variant === 'eth'
                      ? 'bg-indigo-400/20'
                      : 'bg-usdt/20'
                  }`}
                >
                  {asset.variant === 'eth' ? (
                    <img src={ETH_LOGO_URL} alt="" className="w-8 h-8 object-contain" />
                  ) : asset.icon ? (
                    <span
                      className={`text-2xl font-bold ${
                        asset.variant === 'btc' || asset.variant === 'lightning'
                          ? 'text-btc'
                          : asset.variant === 'usdt'
                          ? 'text-emerald-400'
                          : asset.variant === 'doge'
                          ? 'text-amber-300'
                          : asset.variant === 'ltc'
                          ? 'text-slate-300'
                          : ''
                      }`}
                    >
                      {asset.icon}
                    </span>
                  ) : (
                    <Zap className="w-6 h-6 text-violet-400" strokeWidth={2} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{asset.name}</p>
                  <p className="text-sm text-white/50 truncate">{asset.symbol}</p>
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
                <div className="flex items-center justify-end gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-mono font-semibold text-white text-sm">
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
                  <ChevronRight className="w-5 h-5 text-white/50 shrink-0" />
                </div>
              </button>
            </motion.div>
          )
        })}
      </div>

    </div>
  )
}
