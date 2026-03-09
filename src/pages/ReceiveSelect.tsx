import { motion } from 'framer-motion'
import { ArrowLeft, ArrowDownToLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ETH_LOGO_URL } from '../lib/assetLogos'

/** Mismos fondos de ícono que en Activos (AssetRow). */
const ASSETS = [
  { id: 'btc', name: 'Bitcoin', sub: 'Red base (on-chain)', icon: '₿', iconClass: 'text-btc', iconBg: 'bg-btc/20', disabled: false },
  { id: 'usdt', name: 'USDT', sub: 'Red ERC-20 (Ethereum)', icon: '₮', iconClass: 'text-emerald-400', iconBg: 'bg-usdt/20', disabled: false },
  { id: 'doge', name: 'Dogecoin', sub: 'DOGE', icon: 'Ð', iconClass: 'text-amber-300', iconBg: 'bg-amber-200/20', disabled: false },
  { id: 'ltc', name: 'Litecoin', sub: 'LTC', icon: 'Ł', iconClass: 'text-slate-300', iconBg: 'bg-slate-400/20', disabled: false },
  { id: 'eth', name: 'Ethereum', sub: 'ETH nativo', icon: null, iconClass: '', iconBg: 'bg-indigo-400/20', logoUrl: ETH_LOGO_URL, disabled: false },
  { id: 'lightning', name: 'Bitcoin (Lightning)', sub: 'Factura con monto, instantáneo', icon: '₿', iconClass: 'text-btc', iconBg: 'bg-lightning/20', disabled: true },
]

export function ReceiveSelect() {
  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Recibir</h1>
      </div>

      <p className="text-white/50 text-sm mb-6">
        Elegí la moneda o red en la que querés recibir. Luego verás la dirección, QR o la opción para crear una factura.
      </p>

      <div className="space-y-2">
        {ASSETS.map((asset, i) => (
          <motion.div
            key={asset.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            {asset.disabled ? (
              <div
                className="block w-full glass rounded-2xl border border-white/5 p-4 text-left opacity-60 cursor-not-allowed"
                aria-disabled
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-white/10 ${asset.iconBg}`}>
                    {asset.logoUrl ? (
                      <img src={asset.logoUrl} alt="" className="w-8 h-8 object-contain opacity-70" />
                    ) : (
                      <span className={`text-2xl font-bold ${asset.iconClass}`}>{asset.icon}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white/70">{asset.name}</p>
                    <p className="text-sm text-white/40 truncate">{asset.sub}</p>
                  </div>
                  <span className="text-white/30 text-xs shrink-0">Próximamente</span>
                </div>
              </div>
            ) : (
              <Link
                to={`/receive/${asset.id}`}
                className="block w-full glass rounded-2xl border border-white/5 p-4 text-left transition-all hover:bg-white/5 hover:border-white/10 active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-white/10 ${asset.iconBg}`}>
                    {asset.logoUrl ? (
                      <img src={asset.logoUrl} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <span className={`text-2xl font-bold ${asset.iconClass}`}>{asset.icon}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{asset.name}</p>
                    <p className="text-sm text-white/50 truncate">{asset.sub}</p>
                  </div>
                  <ArrowDownToLine className="w-5 h-5 text-white/50 shrink-0" aria-hidden />
                </div>
              </Link>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
