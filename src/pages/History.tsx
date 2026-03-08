import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { initialWalletState, getAssetSymbol } from '../store/wallet'

export function History() {
  const { transactions } = initialWalletState

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return 'Hoy, ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    if (diff < 172800000) return 'Ayer'
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Historial</h1>
      </div>

      <div className="space-y-2">
        {transactions.map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-4 glass-hover"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              tx.type === 'receive' ? 'bg-emerald-500/20' : 'bg-rose-500/20'
            }`}>
              {tx.type === 'receive' ? (
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-rose-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">
                {tx.type === 'receive' ? 'Recibido' : 'Enviado'}
                {tx.isLightning && <Zap className="inline w-3.5 h-3.5 text-violet-400 ml-1" />}
              </p>
              <p className="text-sm text-white/50 break-all">{tx.counterparty}</p>
              <p className="text-xs text-white/40 mt-0.5">{formatDate(tx.timestamp)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-mono font-semibold ${tx.type === 'receive' ? 'text-emerald-400' : 'text-white'}`}>
                {tx.type === 'receive' ? '+' : '-'}{tx.amount} {getAssetSymbol(tx.asset)}
              </p>
              <p className="text-xs text-white/40">${tx.amountUsd}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
