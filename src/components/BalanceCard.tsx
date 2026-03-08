import { motion } from 'framer-motion'
import { DollarSign } from 'lucide-react'
import type { AssetType } from '../store/wallet'
import { getAssetLabel, getAssetSymbol } from '../store/wallet'

interface BalanceCardProps {
  asset: AssetType
  amount: string
  amountUsd?: string
  variant?: 'btc' | 'lightning' | 'usdt'
  delay?: number
}

const variants = {
  btc: 'from-amber-500/20 to-orange-600/10 border-amber-500/20 shadow-glow-btc',
  lightning: 'from-violet-500/20 to-purple-600/10 border-violet-500/20 shadow-glow-lightning',
  usdt: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/20 shadow-glow-usdt',
}

const icons = {
  btc: '₿',
  lightning: '₿',
  usdt: '₮',
}

export function BalanceCard({ asset, amount, amountUsd, variant = 'btc', delay = 0 }: BalanceCardProps) {
  const isBtc = asset === 'btc' || asset === 'btc_lightning'
  const displayAmount = isBtc ? parseFloat(amount).toFixed(8) : parseFloat(amount).toFixed(2)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-2xl border bg-gradient-to-br ${variants[variant]} p-5 glass-hover transition-all duration-300`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            variant === 'btc' ? 'bg-amber-500/20 text-amber-400' :
            variant === 'lightning' ? 'bg-violet-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            <span className="text-3xl font-bold">{icons[variant]}</span>
          </div>
          <div>
            <p className="text-white/60 text-sm font-medium">{getAssetLabel(asset)}</p>
            <p className="font-mono text-lg font-semibold tracking-tight text-white">
              {displayAmount} <span className="text-white/70 text-sm">{getAssetSymbol(asset)}</span>
            </p>
          </div>
        </div>
        {amountUsd && (
          <div className="flex items-center gap-1.5 text-white/70">
            <DollarSign className="w-4 h-4" />
            <span className="font-mono text-sm font-medium">{parseFloat(amountUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
