import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Zap, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'

const items = [
  { icon: KeyRound, label: 'Frase semilla', sub: 'Generar y ver direcciones', to: '/seed-phrase' },
  { icon: Zap, label: 'Dirección Lightning', sub: 'Para recibir pagos por Lightning', to: '/lightning-address' },
]

export function Billeteras() {
  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Billeteras</h1>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <Link key={item.label} to={item.to}>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl border border-white/5 overflow-hidden flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{item.label}</p>
                <p className="text-sm text-white/50">{item.sub}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/40 shrink-0" />
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  )
}
