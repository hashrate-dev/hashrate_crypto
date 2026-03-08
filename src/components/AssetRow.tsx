import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { AssetType } from '../store/wallet'
import { getAssetSymbol, getAssetPrimaryName, getAssetSecondaryName } from '../store/wallet'
import { Sparkline } from './Sparkline'

interface AssetRowProps {
  asset: AssetType
  amount: string
  amountUsd?: string
  variant?: 'btc' | 'lightning' | 'usdt' | 'doge'
  /** Datos de precio para el gráfico (sparkline) */
  chartData?: number[]
  /** Precio actual de la moneda (1 unidad en USD) */
  currentPrice?: number
  /** % de variación en el periodo del sparkline (opcional, se calcula desde chartData si no se pasa) */
  variationPercent?: number
  delay?: number
}

const iconBg = {
  btc: 'bg-btc/20',
  lightning: 'bg-lightning/20',
  usdt: 'bg-usdt/20',
  doge: 'bg-amber-200/20',
}

const iconColor = {
  btc: 'text-btc',
  lightning: 'text-violet-400',
  usdt: 'text-emerald-400',
  doge: 'text-amber-300',
}

const sparklineColors = {
  btc: { up: 'rgb(34, 197, 94)', down: 'rgb(239, 68, 68)' },
  lightning: { up: 'rgb(139, 92, 246)', down: 'rgb(239, 68, 68)' },
  usdt: { up: 'rgb(34, 197, 94)', down: 'rgb(239, 68, 68)' },
  doge: { up: 'rgb(198, 166, 100)', down: 'rgb(239, 68, 68)' },
}

export function AssetRow({
  asset,
  amount,
  amountUsd,
  variant = 'btc',
  chartData,
  currentPrice,
  variationPercent: variationPercentProp,
  delay = 0,
}: AssetRowProps) {
  const isBtcOrDoge = asset === 'btc' || asset === 'btc_lightning' || asset === 'doge'
  const displayAmount = isBtcOrDoge ? parseFloat(amount).toFixed(8) : parseFloat(amount).toFixed(2)
  const colors = sparklineColors[variant]

  const variationPercent =
    variationPercentProp ??
    (chartData && chartData.length >= 2
      ? ((chartData[chartData.length - 1] - chartData[0]) / chartData[0]) * 100
      : undefined)

  const hasPriceInfo = currentPrice != null && currentPrice > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-white/5 active:bg-white/[0.07] transition-colors -mx-1"
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
          {asset === 'btc_lightning' ? (
            <span className={`text-3xl font-bold ${iconColor.btc}`}>₿</span>
          ) : (
            <span className={`text-3xl font-bold ${iconColor[variant]}`}>
              {variant === 'btc' ? '₿' : variant === 'doge' ? 'Ð' : '₮'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-white">{getAssetPrimaryName(asset)}</p>
          <p className="text-sm text-white/50">{getAssetSecondaryName(asset)}</p>
          {hasPriceInfo && (
            <p className="text-xs text-white/40 mt-0.5 font-mono tabular-nums">
              ${currentPrice >= 1
                ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : currentPrice.toFixed(4)}
            </p>
          )}
        </div>
      </div>
      {chartData && chartData.length > 0 && (
        <div className="w-32 h-14 shrink-0 flex items-center justify-center" aria-hidden>
          <Sparkline
            data={chartData}
            upColor={colors.up}
            downColor={colors.down}
            id={`spark-${asset}`}
            className="w-full h-full"
          />
        </div>
      )}
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <div className="text-right min-w-[60px]">
          <p className="font-mono text-sm text-white/90">
            {displayAmount} {getAssetSymbol(asset)}
          </p>
          {amountUsd && (
            <p className="text-xs text-white/50">
              ${parseFloat(amountUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          )}
          {variationPercent != null && !Number.isNaN(variationPercent) && (
            <p
              className={`text-xs font-medium tabular-nums mt-0.5 ${
                variationPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {variationPercent >= 0 ? '+' : ''}{variationPercent.toFixed(2)}%
            </p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-white/30 shrink-0" />
      </div>
    </motion.div>
  )
}
