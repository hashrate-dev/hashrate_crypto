import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send as SendIcon, AlertCircle, CheckCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { initialWalletState, getAssetSymbol, type AssetType, type Balance } from '../store/wallet'
import { useMempoolBtc } from '../hooks/useMempoolBtc'
import { useUsdtBalance } from '../hooks/useUsdtBalance'
import { useDogeBalance } from '../hooks/useDogeBalance'
import { useWalletAddresses } from '../hooks/useWalletAddresses'
import { getNotifyOnSend } from '../store/notifications'
import { useAuth } from '../context/AuthContext'
import { playSendSound } from '../lib/sounds'
import { verifyTotp } from '../api/users'

type Step = 'asset' | 'amount' | 'address' | 'confirm'

const ASSET_OPTIONS: { id: AssetType; label: string; sub: string; icon: string; iconClass: string }[] = [
  { id: 'btc', label: 'Bitcoin', sub: 'Red base', icon: '₿', iconClass: 'text-btc' },
  { id: 'btc_lightning', label: 'Lightning', sub: 'Instantáneo, bajas comisiones', icon: '₿', iconClass: 'text-btc' },
  { id: 'usdt', label: 'USDT', sub: 'Red ERC-20', icon: '₮', iconClass: 'text-emerald-400' },
  { id: 'doge', label: 'Dogecoin', sub: 'Red Dogecoin', icon: 'Ð', iconClass: 'text-amber-300' },
]

const VALID_ASSETS: AssetType[] = ['btc', 'btc_lightning', 'usdt', 'doge']

export function Send() {
  const { user } = useAuth()
  const location = useLocation()
  const presetAsset = (location.state as { asset?: string } | null)?.asset
  const hasPresetAsset = presetAsset && VALID_ASSETS.includes(presetAsset as AssetType)
  const [step, setStep] = useState<Step>(() => (hasPresetAsset ? 'amount' : 'asset'))
  const [asset, setAsset] = useState<AssetType | null>(() =>
    hasPresetAsset ? (presetAsset as AssetType) : null
  )
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [lightningInvoice, setLightningInvoice] = useState('')
  const [lightningUser, setLightningUser] = useState('')
  const [error, setError] = useState('')
  const [showSentAlert, setShowSentAlert] = useState(false)
  const [showTotpModal, setShowTotpModal] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)

  const { balances: baseBalances } = initialWalletState
  const { btcAddress, usdtAddress, dogeAddress, hasLinkedWallet } = useWalletAddresses()
  const { balanceBtc: mempoolBtc } = useMempoolBtc(btcAddress)
  const { balanceUsdt: usdtBalance } = useUsdtBalance(usdtAddress)
  const { balanceDoge: dogeBalance } = useDogeBalance(dogeAddress)
  const balances = useMemo((): Balance[] => {
    return baseBalances.map((b) => {
      if (b.asset === 'btc') return { ...b, amount: mempoolBtc ?? '0' }
      if (b.asset === 'usdt') return { ...b, amount: usdtBalance ?? '0' }
      if (b.asset === 'doge') return { ...b, amount: dogeBalance ?? '0' }
      if (b.asset === 'btc_lightning') return { ...b, amount: hasLinkedWallet ? b.amount : '0' }
      return b
    })
  }, [baseBalances, mempoolBtc, usdtBalance, dogeBalance, hasLinkedWallet])
  const balanceForAsset = asset ? balances.find(b => b.asset === asset) : null

  const isLightning = asset === 'btc_lightning'

  // Al volver desde Revisar: rellenar Factura o Usuario Lightning. Si llegás al paso sin destino, pre-rellenar con tu email.
  useEffect(() => {
    if (step !== 'address' || !isLightning) return
    if (address) {
      if (address.toLowerCase().startsWith('lnbc')) {
        setLightningInvoice(address)
        setLightningUser('')
      } else if (address.includes('@')) {
        setLightningUser(address)
        setLightningInvoice('')
      }
    } else if (user?.email) {
      setLightningUser((prev) => (prev === '' ? user.email : prev))
    }
  }, [step, isLightning, address, user?.email])
  const addressPlaceholder = asset === 'usdt'
    ? '0x...'
    : asset === 'doge'
    ? 'D...'
    : 'bc1q...'

  const validateAddress = () => {
    if (isLightning) {
      const inv = lightningInvoice.trim()
      const user = lightningUser.trim()
      if (inv && inv.toLowerCase().startsWith('lnbc')) {
        setAddress(inv)
        setError('')
        return true
      }
      if (user && user.includes('@')) {
        setAddress(user)
        setError('')
        return true
      }
      setError('Ingresá una factura Lightning (lnbc...) o un usuario Lightning (ej. usuario@dominio.com).')
      return false
    }
    if (!address.trim()) {
      setError('Ingresa una dirección de destino.')
      return false
    }
    if (asset === 'btc' && !address.startsWith('bc1') && !address.startsWith('1') && !address.startsWith('3')) {
      setError('Dirección Bitcoin no válida.')
      return false
    }
    if (asset === 'usdt' && !address.startsWith('0x')) {
      setError('Dirección ERC-20 debe empezar por 0x.')
      return false
    }
    if (asset === 'doge' && !address.startsWith('D')) {
      setError('Dirección Dogecoin debe empezar por D.')
      return false
    }
    setError('')
    return true
  }

  const handleNext = () => {
    if (step === 'asset' && asset) setStep('amount')
    else if (step === 'amount') {
      const num = parseFloat(amount)
      if (!num || num <= 0) {
        setError('Monto inválido.')
        return
      }
      if (balanceForAsset && num > parseFloat(balanceForAsset.amount)) {
        setError('Saldo insuficiente.')
        return
      }
      setError('')
      setStep('address')
    } else if (step === 'address') {
      if (validateAddress()) setStep('confirm')
    }
  }

  const handleBack = () => {
    setError('')
    if (step === 'amount') setStep('asset')
    else if (step === 'address') {
      setStep('amount')
      if (isLightning) {
        setLightningInvoice('')
        setLightningUser('')
      }
    } else if (step === 'confirm') {
      setStep('address')
      if (isLightning && address) {
        if (address.toLowerCase().startsWith('lnbc')) {
          setLightningInvoice(address)
          setLightningUser('')
        } else if (address.includes('@')) {
          setLightningUser(address)
          setLightningInvoice('')
        }
      }
    }
  }

  return (
    <div className="px-4 pt-10 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Enviar</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 'asset' && (
          <motion.div
            key="asset"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-white/60 text-sm mb-4">Elige el activo a enviar</p>
            {ASSET_OPTIONS.map((opt) => (
              <motion.button
                key={opt.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setAsset(opt.id); setError(''); }}
                className={`w-full glass rounded-2xl p-4 flex items-center gap-4 text-left transition-all ${
                  asset === opt.id ? 'ring-2 ring-exodus/50 bg-exodus/10 border-exodus/30' : 'glass-hover border-white/10'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${opt.iconClass}`}>{opt.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{opt.label}</p>
                  <p className="text-sm text-white/50">{opt.sub}</p>
                </div>
                <p className="font-mono text-sm text-white/70">
                  {balances.find(b => b.asset === opt.id)?.amount} {getAssetSymbol(opt.id)}
                </p>
              </motion.button>
            ))}
            {asset && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4">
                <button
                  onClick={handleNext}
                  className="w-full py-4 rounded-2xl bg-exodus text-white font-semibold hover:bg-exodus-dark transition-colors"
                >
                  Continuar
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {step === 'amount' && asset && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <p className="text-white/60 text-sm mb-2">Monto</p>
            <div className="glass rounded-2xl p-4 mb-2 flex items-center gap-3">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent text-2xl font-mono text-white placeholder:text-white/30 outline-none min-w-0"
              />
              <button
                type="button"
                onClick={() => balanceForAsset && setAmount(balanceForAsset.amount)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-exodus/20 text-exodus text-sm font-semibold hover:bg-exodus/30 transition-colors"
              >
                MAX
              </button>
              <span className="text-white/60 font-medium shrink-0">{getAssetSymbol(asset)}</span>
            </div>
            {balanceForAsset && (
              <p className="text-sm text-white/50 mb-4">
                Disponible: {balanceForAsset.amount} {getAssetSymbol(asset)}
              </p>
            )}
            {error && (
              <p className="text-rose-400 text-sm flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-2xl bg-exodus text-white font-semibold hover:bg-exodus-dark transition-colors"
            >
              Siguiente
            </button>
          </motion.div>
        )}

        {step === 'address' && asset && (
          <motion.div
            key="address"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {isLightning ? (
              <>
                <p className="text-white/60 text-sm mb-2">Factura Lightning</p>
                <div className="glass rounded-2xl p-4 mb-4">
                  <textarea
                    placeholder="lnbc..."
                    value={lightningInvoice}
                    onChange={(e) => { setLightningInvoice(e.target.value); setError(''); }}
                    rows={2}
                    className="w-full bg-transparent text-white placeholder:text-white/30 outline-none resize-none font-mono text-sm"
                  />
                </div>
                <p className="text-white/60 text-sm mb-2">Usuario Lightning</p>
                <div className="glass rounded-2xl p-4 mb-4">
                  <input
                    type="text"
                    inputMode="email"
                    placeholder="usuario@dominio.com"
                    value={lightningUser}
                    onChange={(e) => { setLightningUser(e.target.value); setError(''); }}
                    className="w-full bg-transparent text-white placeholder:text-white/30 outline-none font-mono text-sm"
                  />
                </div>
                <p className="text-white/40 text-xs mb-4">
                
                </p>
              </>
            ) : (
              <>
                {asset === 'btc' ? (
                  <>
                    <p className="text-white font-medium mb-1">Red Bitcoin</p>
                    <p className="text-white/70 text-sm mb-4">
                      Ingresá la dirección Bitcoin (on-chain) de quien recibe. Podés pegarla o escanear el QR.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-medium mb-1">Red ERC-20 (Ethereum)</p>
                    <p className="text-white/70 text-sm mb-4">
                      Ingresá la dirección Ethereum de quien recibe (para USDT en la red de Ethereum).
                    </p>
                  </>
                )}
                <div className="glass rounded-2xl p-4 mb-4">
                  <textarea
                    placeholder={addressPlaceholder}
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setError(''); }}
                    rows={3}
                    className="w-full bg-transparent text-white placeholder:text-white/30 outline-none resize-none font-mono text-sm"
                  />
                </div>
                {asset === 'btc' && (
                  <div className="mb-4 space-y-1">
                    <p className="text-white/50 text-xs">
                      ✓ Válido: direcciones que empiezan con <span className="font-mono text-white/60">bc1q</span>, <span className="font-mono text-white/60">1</span> o <span className="font-mono text-white/60">3</span>
                    </p>
                    <p className="text-white/50 text-xs">
                      ✗ No uses una dirección Lightning (lnbc...) ni de otra red. Si enviás a una dirección incorrecta, los fondos pueden perderse.
                    </p>
                  </div>
                )}
                {asset === 'usdt' && (
                  <p className="text-white/50 text-xs mb-4">
                    ✓ La dirección debe empezar con <span className="font-mono text-white/60">0x</span>. No uses direcciones de otras redes (Bitcoin, BEP-20, etc.).
                  </p>
                )}
                {asset === 'doge' && (
                  <p className="text-white/50 text-xs mb-4">
                    ✓ La dirección Dogecoin debe empezar con <span className="font-mono text-white/60">D</span>. Red principal de Dogecoin.
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="text-rose-400 text-sm flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-4 rounded-2xl glass text-white font-semibold glass-hover"
              >
                Atrás
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-4 rounded-2xl bg-exodus text-white font-semibold hover:bg-exodus-dark transition-colors"
              >
                Revisar
              </button>
            </div>
          </motion.div>
        )}

        {step === 'confirm' && asset && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="glass rounded-2xl p-5 space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Activo</span>
                <span className="text-white font-medium">{getAssetSymbol(asset)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Monto</span>
                <span className="font-mono text-white">{amount} {getAssetSymbol(asset)}</span>
              </div>
              <div className="flex justify-between text-sm gap-3 items-start">
                <span className="text-white/50 shrink-0">Destino</span>
                <span className="font-mono text-white/90 text-sm break-all text-right min-w-0">{address}</span>
              </div>
            </div>
            <p className="text-white/40 text-xs mb-4 text-center">
              Demo: no se enviará ninguna transacción real.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-4 rounded-2xl glass text-white font-semibold glass-hover"
              >
                Atrás
              </button>
              <button
                onClick={() => {
                  if (user?.totpEnabled) {
                    setTotpCode('')
                    setTotpError('')
                    setShowTotpModal(true)
                  } else {
                    if (getNotifyOnSend()) playSendSound()
                    setStep('asset')
                    setAmount('')
                    setAddress('')
                    setLightningInvoice('')
                    setLightningUser('')
                    setShowSentAlert(true)
                  }
                }}
                className="flex-1 py-4 rounded-2xl bg-exodus text-white font-semibold hover:bg-exodus-dark transition-colors flex items-center justify-center gap-2"
              >
                <SendIcon className="w-5 h-5" /> Enviar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTotpModal && user?.totpEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowTotpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass rounded-2xl border border-white/10 overflow-hidden shadow-xl p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-2">Código de verificación</h3>
              <p className="text-white/60 text-sm mb-4">
                Ingresá el código de 6 dígitos de Google Authenticator para confirmar el envío.
              </p>
              {totpError && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 mb-4">
                  {totpError}
                </div>
              )}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), document.getElementById('send-totp-submit')?.click())}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-center text-2xl tracking-[0.5em] placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-exodus/50 mb-4"
                autoFocus
                autoComplete="one-time-code"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowTotpModal(false); setTotpError(''); setTotpCode(''); }}
                  className="flex-1 py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  id="send-totp-submit"
                  type="button"
                  disabled={totpLoading || totpCode.replace(/\D/g, '').length !== 6}
                  onClick={async () => {
                    if (!user?.id || totpCode.replace(/\D/g, '').length !== 6) return
                    setTotpError('')
                    setTotpLoading(true)
                    try {
                      await verifyTotp(user.id, totpCode.replace(/\D/g, ''))
                      setShowTotpModal(false)
                      setTotpCode('')
                      if (getNotifyOnSend()) playSendSound()
                      setStep('asset')
                      setAmount('')
                      setAddress('')
                      setLightningInvoice('')
                      setLightningUser('')
                      setShowSentAlert(true)
                    } catch (e) {
                      setTotpError(e instanceof Error ? e.message : 'Código incorrecto')
                    } finally {
                      setTotpLoading(false)
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-exodus hover:bg-exodus-dark text-white font-medium disabled:opacity-50"
                >
                  {totpLoading ? '...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showSentAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowSentAlert(false)}
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
                <h3 className="text-lg font-semibold text-white mb-2">Transferencia enviada</h3>
                <p className="text-white/60 text-sm">
                  La operación se completó correctamente.
                </p>
              </div>
              <div className="p-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSentAlert(false)}
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
