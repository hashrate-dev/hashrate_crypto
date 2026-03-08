import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Copy, Check, Coins, CheckCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useWalletAddresses } from '../hooks/useWalletAddresses'
import { getNotifyOnReceive } from '../store/notifications'
import { playAlcanciaSound } from '../lib/sounds'

type Tab = 'btc' | 'lightning' | 'usdt' | 'doge'

const TABS: Tab[] = ['lightning', 'btc', 'usdt', 'doge']

const DEMO_RECEIVE: Record<Tab, { amount: string; label: string }> = {
  lightning: { amount: '0.0005', label: 'Bitcoin (Lightning)' },
  btc: { amount: '0.001', label: 'Bitcoin' },
  usdt: { amount: '50', label: 'USDT' },
  doge: { amount: '100', label: 'Dogecoin' },
}

export function Receive() {
  const location = useLocation()
  const presetTab = (location.state as { tab?: string } | null)?.tab
  const initialTab: Tab = presetTab && TABS.includes(presetTab as Tab) ? (presetTab as Tab) : 'lightning'
  const [tab, setTab] = useState<Tab>(initialTab)
  const singleAssetMode = Boolean(presetTab && TABS.includes(presetTab as Tab))
  const [copied, setCopied] = useState<string | null>(null)
  const [showReceivedAlert, setShowReceivedAlert] = useState(false)
  const [receivedMessage, setReceivedMessage] = useState('')

  const { btcAddress, lightningAddress, usdtAddress, dogeAddress } = useWalletAddresses()

  const address = tab === 'btc' ? btcAddress : tab === 'lightning' ? lightningAddress : tab === 'doge' ? dogeAddress : usdtAddress
  const label = tab === 'btc' ? 'Bitcoin (on-chain)' : tab === 'lightning' ? 'Lightning' : tab === 'doge' ? 'Dogecoin' : 'USDT (ERC-20)'

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">
          {singleAssetMode ? `Recibir ${label}` : 'Recibir'}
        </h1>
      </div>

      {!singleAssetMode && (
        <div className="flex gap-2 p-1 glass rounded-2xl mb-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t ? 'bg-exodus/20 text-exodus' : 'text-white/60 hover:text-white/80'
              }`}
            >
              {t === 'lightning' && <><span className="text-2xl font-bold text-btc mr-1.5">₿</span> Lightning</>}
              {t === 'btc' && <><span className="text-2xl font-bold text-btc mr-1.5">₿</span> Bitcoin</>}
              {t === 'usdt' && <><span className="text-2xl font-bold text-emerald-400 mr-1.5">₮</span> USDT</>}
              {t === 'doge' && <><span className="text-2xl font-bold text-amber-300 mr-1.5">Ð</span> DOGE</>}
            </button>
          ))}
        </div>
      )}

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 text-center"
      >
        <p className="text-white/50 text-sm mb-4">{label}</p>
        <div className="bg-white p-4 rounded-2xl inline-block mb-4">
          <QRCodeSVG value={address} size={200} level="M" includeMargin />
        </div>
        <div className="flex items-center gap-2 justify-center flex-wrap">
          <code className="font-mono text-sm text-white/80 break-all bg-surface-700 px-3 py-2 rounded-xl">
            {address}
          </code>
          <button
            onClick={() => copy(address, tab)}
            className="p-2.5 rounded-xl glass text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Copiar"
          >
            {copied === tab ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </motion.div>

      {tab === 'lightning' && (
        <p className="text-white/40 text-sm text-center mt-4">
          Comparte esta dirección o escanea el QR para recibir pagos instantáneos por Lightning.
        </p>
      )}

      <div className="mt-6">
        <p className="text-white/50 text-xs text-center mb-2">Cuando recibas fondos se mostrará un aviso con sonido de alcancía (si está activado en Notificaciones).</p>
        <button
          type="button"
          onClick={() => {
            const { amount, label } = DEMO_RECEIVE[tab]
            setReceivedMessage(`Se recibieron ${amount} ${label}`)
            setShowReceivedAlert(true)
            if (getNotifyOnReceive()) playAlcanciaSound()
          }}
          className="w-full py-2.5 rounded-xl border border-white/20 text-white/70 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
        >
          <Coins className="w-4 h-4" /> Simular recepción
        </button>
      </div>

      <AnimatePresence>
        {showReceivedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowReceivedAlert(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass rounded-2xl border border-white/10 overflow-hidden shadow-xl"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Fondos recibidos</h3>
                <p className="text-white/80 text-sm font-medium">
                  {receivedMessage}
                </p>
              </div>
              <div className="p-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReceivedAlert(false)}
                  className="w-full py-3 rounded-xl bg-exodus hover:bg-exodus-dark text-white font-medium transition-colors"
                >
                  Aceptar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
