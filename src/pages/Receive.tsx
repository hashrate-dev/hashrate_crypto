import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Copy, Check, Coins, CheckCircle, Lock } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { useWalletAddresses } from '../hooks/useWalletAddresses'
import { getNotifyOnReceive } from '../store/notifications'
import { playAlcanciaSound } from '../lib/sounds'
import { ETH_LOGO_URL } from '../lib/assetLogos'
import { decryptSeed } from '../lib/seedEncryption'
import { deriveAddressesFromMnemonic } from '../lib/seedPhrase'
import { getEncryptedSeed, updateUserWallets, getUserById, createLightningInvoice } from '../api/users'

type Tab = 'btc' | 'lightning' | 'usdt' | 'doge' | 'ltc' | 'eth'

const TABS: Tab[] = ['lightning', 'btc', 'usdt', 'doge', 'ltc', 'eth']

const DEMO_RECEIVE: Record<Tab, { amount: string; label: string }> = {
  lightning: { amount: '0.0005', label: 'Bitcoin (Lightning)' },
  btc: { amount: '0.001', label: 'Bitcoin' },
  usdt: { amount: '50', label: 'USDT' },
  doge: { amount: '100', label: 'Dogecoin' },
  ltc: { amount: '0.5', label: 'Litecoin' },
  eth: { amount: '0.01', label: 'Ethereum' },
}

export function Receive() {
  const { asset: assetParam } = useParams<{ asset: string }>()
  const location = useLocation()
  const presetTab = assetParam ?? (location.state as { tab?: string } | null)?.tab
  const initialTab: Tab = presetTab && TABS.includes(presetTab as Tab) ? (presetTab as Tab) : 'lightning'
  const [tab, setTab] = useState<Tab>(initialTab)
  const singleAssetMode = Boolean(presetTab && TABS.includes(presetTab as Tab))
  const [copied, setCopied] = useState<string | null>(null)
  const [showReceivedAlert, setShowReceivedAlert] = useState(false)
  const [receivedMessage, setReceivedMessage] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordValue, setPasswordValue] = useState('')
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [paymentCode, setPaymentCode] = useState<string | null>(null)
  const [loadingPaymentCode, setLoadingPaymentCode] = useState(false)
  const [paymentCodeError, setPaymentCodeError] = useState<string | null>(null)
  const [lightningAmountBtc, setLightningAmountBtc] = useState('')

  const { user, setUser } = useAuth()
  const { btcAddress, lightningAddress, usdtAddress, dogeAddress, ltcAddress, ethAddress, hasLinkedWallet } = useWalletAddresses()
  const didRefetchOnMount = useRef(false)

  // En /receive cada QR y dirección deben salir de la base de datos (por cada usuario): cargar usuario del servidor al entrar.
  useEffect(() => {
    if (!user?.id || didRefetchOnMount.current) return
    didRefetchOnMount.current = true
    getUserById(user.id)
      .then(({ user: u }) => setUser(u))
      .catch(() => {})
  }, [user?.id, setUser])

  // LTC y ETH: si falta la dirección, recargar por si ya se guardó en otro flujo
  useEffect(() => {
    if (!user?.id || !hasLinkedWallet) return
    const needLtc = tab === 'ltc' && !ltcAddress?.trim()
    const needEth = tab === 'eth' && !ethAddress?.trim()
    if (!needLtc && !needEth) return
    getUserById(user.id)
      .then(({ user: u }) => {
        if ((needLtc && u.ltcAddress?.trim()) || (needEth && (u.ethAddress ?? u.usdtAddress)?.trim())) setUser(u)
      })
      .catch(() => {})
  }, [tab, user?.id, hasLinkedWallet, ltcAddress, ethAddress, setUser])

  // Dirección y QR: siempre las del usuario cargado desde la base de datos (por cada usuario logueado)
  const address = tab === 'btc' ? btcAddress : tab === 'lightning' ? lightningAddress : tab === 'doge' ? dogeAddress : tab === 'ltc' ? ltcAddress : tab === 'eth' ? ethAddress : usdtAddress
  const label = tab === 'btc' ? 'Bitcoin (on-chain)' : tab === 'lightning' ? 'Lightning' : tab === 'doge' ? 'Dogecoin' : tab === 'ltc' ? 'Litecoin' : tab === 'eth' ? 'Ethereum' : 'USDT (ERC-20)'

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCreateLightningInvoice = async () => {
    if (!user?.id) return
    const btc = lightningAmountBtc.trim().replace(',', '.')
    const num = parseFloat(btc)
    if (!btc || Number.isNaN(num) || num <= 0) {
      setPaymentCodeError('Ingresá un monto mayor a 0.')
      return
    }
    setPaymentCodeError(null)
    setLoadingPaymentCode(true)
    try {
      const amountSats = Math.round(num * 1e8)
      const { invoice } = await createLightningInvoice(user.id, { amountSats })
      setPaymentCode(invoice)
    } catch (e) {
      setPaymentCodeError(e instanceof Error ? e.message : 'Error al crear la factura.')
    } finally {
      setLoadingPaymentCode(false)
    }
  }

  const handleGenerateAddress = async () => {
    if (!user || !passwordValue.trim()) return
    setGenerateError(null)
    setGenerating(true)
    try {
      const { encryptedSeed, seedSalt } = await getEncryptedSeed(user.id)
      const phrase = await decryptSeed(encryptedSeed, seedSalt, passwordValue.trim())
      const derived = deriveAddressesFromMnemonic(phrase)
      const { user: updated } = await updateUserWallets(user.id, {
        btcAddress: user.btcAddress ?? derived.btcAddress,
        usdtAddress: user.usdtAddress ?? derived.ethAddress,
        dogeAddress: user.dogeAddress ?? derived.dogeAddress,
        ltcAddress: derived.ltcAddress,
        ethAddress: derived.ethAddress,
        password: passwordValue.trim(),
      })
      setUser(updated)
      setShowPasswordModal(false)
      setPasswordValue('')
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Contraseña incorrecta o error.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to={singleAssetMode ? '/receive' : '/'} className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
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
              {t === 'ltc' && <><span className="text-2xl font-bold text-slate-300 mr-1.5">Ł</span> LTC</>}
              {t === 'eth' && <><img src={ETH_LOGO_URL} alt="" className="w-6 h-6 object-contain mr-1.5 inline-block align-middle" /> ETH</>}
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
        {tab === 'lightning' ? (
          <>
            <p className="text-white/50 text-sm mb-4">Bitcoin (Lightning)</p>
            <p className="text-white/60 text-xs mb-4 text-left">
              Ingresá el monto que querés recibir y generá la factura. El pagador escanea el QR o copia el código.
            </p>
            <div className="flex flex-col gap-3 text-left">
              <div>
                <label className="text-white/60 text-xs block mb-1">Monto a recibir</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.01"
                    value={lightningAmountBtc}
                    onChange={(e) => { setLightningAmountBtc(e.target.value.replace(',', '.')); setPaymentCodeError(null); }}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:border-exodus focus:outline-none"
                  />
                  <span className="text-white/80 font-medium text-sm shrink-0">BTC</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateLightningInvoice}
                disabled={loadingPaymentCode || !lightningAmountBtc.trim() || parseFloat(lightningAmountBtc.replace(',', '.')) <= 0}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {loadingPaymentCode ? 'Creando factura...' : 'Crear factura'}
              </button>
              {paymentCodeError && (
                <p className="text-red-400 text-xs">{paymentCodeError}</p>
              )}
            </div>
            {paymentCode && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 pt-6 border-t border-white/10"
              >
                <p className="text-amber-200/90 text-xs rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-4">
                  Esta factura es válida por 30 minutos.
                </p>
                <div className="bg-white p-4 rounded-2xl inline-block mb-3">
                  <QRCodeSVG value={paymentCode} size={200} level="M" includeMargin />
                </div>
                <p className="text-white/60 text-xs mb-2">Factura</p>
                <div className="flex items-center gap-2 justify-center flex-wrap">
                  <code className="font-mono text-xs text-white/80 break-all bg-white/10 px-3 py-2 rounded-xl max-w-full">
                    {paymentCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(paymentCode, 'paymentCode')}
                    className="p-2.5 rounded-xl glass text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    title="Copiar"
                  >
                    {copied === 'paymentCode' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <>
            <p className="text-white/50 text-sm mb-4">{label}</p>
            <div className="bg-white p-4 rounded-2xl inline-block mb-4">
              {address?.trim() ? (
                <QRCodeSVG value={address} size={200} level="M" includeMargin />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center rounded-xl bg-white/80 border-2 border-dashed border-white/30">
                  <p className="text-white/40 text-xs text-center px-3">Tu dirección y QR aparecerán aquí al generarla</p>
                </div>
              )}
            </div>
            {address?.trim() ? (
              <div className="flex items-center gap-2 justify-center flex-wrap">
                <code className="font-mono text-sm text-white/80 break-all bg-surface-700 px-3 py-2 rounded-xl max-w-full">
                  {address}
                </code>
                <button
                  onClick={() => copy(address, tab)}
                  className="p-2.5 rounded-xl glass text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  title="Copiar"
                >
                  {copied === tab ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            ) : hasLinkedWallet ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-white/50 text-xs">Ingresá tu contraseña para generar y ver tu dirección con QR.</p>
                <button
                  type="button"
                  onClick={() => { setGenerateError(null); setPasswordValue(''); setShowPasswordModal(true) }}
                  className="px-4 py-2.5 rounded-xl bg-exodus hover:bg-exodus-dark text-white text-sm font-medium inline-flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" /> Generar dirección
                </button>
              </div>
            ) : (
              <p className="text-white/50 text-xs max-w-xs mx-auto">
                Vinculá una frase semilla desde Ajustes → Frase semilla para obtener direcciones.
              </p>
            )}
          </>
        )}
      </motion.div>

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

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => !generating && setShowPasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass rounded-2xl border border-white/10 overflow-hidden shadow-xl"
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-exodus/20 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-exodus" />
                </div>
                <h3 className="text-lg font-semibold text-white text-center mb-1">Generar dirección de {label}</h3>
                <p className="text-white/60 text-sm text-center mb-4">Ingresá tu contraseña para derivar y guardar la dirección.</p>
                <input
                  type="password"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-sm focus:border-exodus focus:outline-none"
                  autoComplete="current-password"
                />
                {generateError && <p className="text-red-400 text-xs mt-2">{generateError}</p>}
              </div>
              <div className="p-4 border-t border-white/10 flex gap-2">
                <button
                  type="button"
                  onClick={() => !generating && setShowPasswordModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAddress}
                  disabled={generating || !passwordValue.trim()}
                  className="flex-1 py-3 rounded-xl bg-exodus hover:bg-exodus-dark text-white font-medium transition-colors disabled:opacity-50"
                >
                  {generating ? '...' : 'Aceptar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
