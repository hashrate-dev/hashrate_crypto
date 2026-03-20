import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, KeyRound, FileInput } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ITEMS_NEW_ACCOUNT = [
  { id: 'seed' as const, icon: KeyRound, label: 'Generar una nueva frase semilla', sub: 'Para todas las wallets', to: '/seed-phrase' as const },
  { id: 'import' as const, icon: FileInput, label: 'Importar semilla ya existente', sub: 'Vincular tus 12 palabras a esta cuenta', to: '/seed-phrase' as const, state: { mode: 'import' } as const },
]
const ITEMS_HAS_WALLETS = [
  { id: 'seed' as const, icon: KeyRound, label: 'Frase semilla', sub: 'Generar y ver direcciones', to: '/seed-phrase' as const },
]

export function Billeteras() {
  const { user } = useAuth()
  const hasLinkedWallets = Boolean(
    user?.btcAddress?.trim() || user?.usdtAddress?.trim() || user?.dogeAddress?.trim() || user?.ltcAddress?.trim() || user?.ethAddress?.trim() || user?.solAddress?.trim()
  )
  const items = useMemo(
    () => (hasLinkedWallets ? ITEMS_HAS_WALLETS : ITEMS_NEW_ACCOUNT),
    [hasLinkedWallets]
  )

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Billeteras</h1>
      </div>

      {!hasLinkedWallets && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Caja de texto tipo Frase semilla (esta cuenta tiene...) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex gap-3">
            <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-white/70 text-sm">
              Una sola frase semilla controla todas las monedas (Bitcoin, Ethereum, USDT, Dogecoin, Litecoin, Solana). Generá una nueva o importá una que ya tengas.
            </p>
          </div>

          {/* Botón principal: Generar (estilo Ocultar frase semilla / exodus) */}
          <Link to="/seed-phrase">
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="w-full py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors border border-exodus/60 bg-exodus/10 text-exodus hover:bg-exodus/20"
            >
              <KeyRound className="w-5 h-5" />
              Generar una nueva frase semilla
            </motion.button>
          </Link>

          {/* Botón secundario: Importar (estilo Resetear frase semilla) */}
          <Link to="/seed-phrase" state={{ mode: 'import' }}>
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full py-4 rounded-2xl border border-amber-500/60 bg-amber-500/10 text-amber-400 font-medium flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors"
            >
              <FileInput className="w-5 h-5" />
              Importar semilla ya existente
            </motion.button>
          </Link>
        </motion.div>
      )}

      {hasLinkedWallets && (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          {items.map((item, i) => (
            <Link key={item.label} to={item.to}>
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{item.label}</p>
                  <p className="text-sm text-white/50">{item.sub}</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
