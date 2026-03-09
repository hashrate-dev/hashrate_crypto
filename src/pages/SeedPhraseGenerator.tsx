import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Copy, Check, KeyRound, AlertTriangle, Link2, Lock, Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { generateSeedPhraseAndWallets, deriveAddressesFromMnemonic, type DerivedWallets } from '../lib/seedPhrase'
import { encryptSeed, decryptSeed } from '../lib/seedEncryption'
import { useAuth } from '../context/AuthContext'
import { updateUserWallets, getEncryptedSeed } from '../api/users'

type PasswordPurpose = 'link' | 'view' | 'replace'

/** Al generar frase semilla se derivan todas las direcciones; este payload las envía al usuario para almacenarlas (BTC, USDT, DOGE, LTC, ETH). */
function allAddressesPayload(derived: DerivedWallets) {
  return {
    btcAddress: derived.btcAddress,
    usdtAddress: derived.ethAddress,
    dogeAddress: derived.dogeAddress,
    ltcAddress: derived.ltcAddress,
    ethAddress: derived.ethAddress,
  }
}

function AnimatedPhrase({ phrase, className = '' }: { phrase: string; className?: string }) {
  const words = phrase.trim().split(/\s+/).filter(Boolean)
  return (
    <div className={`font-mono text-sm flex flex-wrap gap-2 ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block px-3 py-1.5 rounded-lg border border-emerald-500/60 bg-emerald-500/5"
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

export function SeedPhraseGenerator() {
  const { user, setUser } = useAuth()
  const [result, setResult] = useState<DerivedWallets | null>(null)
  const [copied, setCopied] = useState<'phrase' | 'btc' | 'eth' | 'doge' | 'ltc' | 'ln' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordPurpose, setPasswordPurpose] = useState<PasswordPurpose>('link')
  const [passwordValue, setPasswordValue] = useState('')
  const [viewedPhrase, setViewedPhrase] = useState<string | null>(null)
  const [replaceResult, setReplaceResult] = useState<DerivedWallets | null>(null)

  // Al iniciar esta página no mostrar la frase: siempre oculta hasta que el usuario pida verla con contraseña.
  useEffect(() => {
    setViewedPhrase(null)
    setReplaceResult(null)
  }, [])

  const handleGenerate = () => {
    const derived = generateSeedPhraseAndWallets()
    setResult(derived)
    setRevealed(false)
    setLinked(false)
    setLinkError(null)
    setViewedPhrase(null)
    setReplaceResult(null)
  }

  const copy = (text: string, key: 'phrase' | 'btc' | 'eth' | 'doge' | 'ltc' | 'ln') => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyLinked = (text: string, key: 'btc' | 'eth' | 'doge' | 'ltc') => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const openPasswordModal = (purpose: PasswordPurpose) => {
    setLinkError(null)
    setPasswordValue('')
    setPasswordPurpose(purpose)
    setShowPasswordModal(true)
  }

  const handlePasswordSubmit = async () => {
    if (!user || !passwordValue.trim()) return
    setLinkError(null)
    setLinking(true)
    try {
      if (passwordPurpose === 'link' && result) {
        const { salt, encrypted } = await encryptSeed(result.mnemonic, passwordValue.trim())
        // Al vincular: guardar frase cifrada y TODAS las direcciones derivadas (BTC, USDT, DOGE, LTC, ETH) en el usuario.
        const { user: updated } = await updateUserWallets(user.id, {
          ...allAddressesPayload(result),
          encryptedSeed: encrypted,
          seedSalt: salt,
        })
        setUser(updated)
        setLinked(true)
        setShowPasswordModal(false)
      } else if (passwordPurpose === 'view') {
        const { encryptedSeed, seedSalt } = await getEncryptedSeed(user.id)
        const phrase = await decryptSeed(encryptedSeed, seedSalt, passwordValue.trim())
        setViewedPhrase(phrase)
        const needsLtcOrEth = !user?.ltcAddress?.trim() || !user?.ethAddress?.trim()
        if (needsLtcOrEth) {
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
        }
        setShowPasswordModal(false)
      } else if (passwordPurpose === 'replace') {
        const derived = generateSeedPhraseAndWallets()
        const { salt, encrypted } = await encryptSeed(derived.mnemonic, passwordValue.trim())
        // Al reemplazar: guardar todas las direcciones derivadas (BTC, USDT, DOGE, LTC, ETH) en el usuario.
        const { user: updated } = await updateUserWallets(user.id, {
          ...allAddressesPayload(derived),
          encryptedSeed: encrypted,
          seedSalt: salt,
          password: passwordValue.trim(),
        })
        setUser(updated)
        setViewedPhrase(null)
        setReplaceResult(derived)
        setShowPasswordModal(false)
      }
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Contraseña incorrecta o error.')
    } finally {
      setLinking(false)
    }
  }

  const alreadyHasLinkedWallets = Boolean(user?.btcAddress?.trim() || user?.usdtAddress?.trim() || user?.dogeAddress?.trim() || user?.ltcAddress?.trim() || user?.ethAddress?.trim())

  /** Cuando la frase está visible, mostramos direcciones derivadas de esa frase (incl. Litecoin); si no, las del usuario. */
  const displayedAddresses = useMemo(() => {
    if (!viewedPhrase?.trim()) return null
    try {
      const d = deriveAddressesFromMnemonic(viewedPhrase)
      return {
        btcAddress: d.btcAddress,
        usdtAddress: d.ethAddress,
        dogeAddress: d.dogeAddress,
        ltcAddress: d.ltcAddress,
        ethAddress: d.ethAddress,
      }
    } catch {
      return null
    }
  }, [viewedPhrase])

  const showBtc = displayedAddresses?.btcAddress ?? user?.btcAddress ?? ''
  const showUsdt = displayedAddresses?.usdtAddress ?? user?.usdtAddress ?? ''
  const showDoge = displayedAddresses?.dogeAddress ?? user?.dogeAddress ?? ''
  const showLtc = displayedAddresses?.ltcAddress ?? user?.ltcAddress ?? ''
  const showEth = displayedAddresses?.ethAddress ?? user?.ethAddress ?? user?.usdtAddress ?? ''

  return (
    <div className="px-4 pt-6 pb-8">
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => !linking && setShowPasswordModal(false)}
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
                <h3 className="text-lg font-semibold text-white text-center mb-1">
                  {passwordPurpose === 'link' && 'Contraseña para vincular'}
                  {passwordPurpose === 'view' && 'Ver frase semilla'}
                  {passwordPurpose === 'replace' && 'Resetear frase semilla'}
                </h3>
                <p className="text-white/60 text-sm text-center mb-4">
                  {passwordPurpose === 'link' && 'Ingresá tu contraseña para vincular y poder ver la frase cuando quieras.'}
                  {passwordPurpose === 'view' && 'Ingresá tu contraseña para ver tu frase de 12 palabras.'}
                  {passwordPurpose === 'replace' && 'Ingresá tu contraseña para resetear y vincular una nueva frase. Las direcciones anteriores se reemplazarán.'}
                </p>
                <input
                  type="password"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePasswordSubmit()
                  }}
                  placeholder="Contraseña"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-exodus/50 mb-4"
                  autoFocus
                />
                {linkError && <p className="text-rose-400 text-sm mb-3">{linkError}</p>}
              </div>
              <div className="flex gap-3 p-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => !linking && setShowPasswordModal(false)}
                  disabled={linking}
                  className="flex-1 py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  disabled={linking || !passwordValue.trim()}
                  className="flex-1 py-3 rounded-xl bg-exodus text-white font-medium hover:bg-exodus-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {linking ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Aceptar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Frase semilla</h1>
      </div>

      {alreadyHasLinkedWallets ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-white/70 text-sm">
              Esta cuenta tiene una frase semilla vinculada. Podés verla cuando quieras ingresando tu contraseña, o generar una nueva (se pedirá contraseña).
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (viewedPhrase || replaceResult) {
                setViewedPhrase(null)
                setReplaceResult(null)
              } else {
                openPasswordModal('view')
              }
            }}
            className={`w-full py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors ${
              viewedPhrase || replaceResult
                ? 'border border-exodus/60 bg-exodus/10 text-exodus hover:bg-exodus/20'
                : 'bg-white/10 border border-white/10 text-white hover:bg-white/15'
            }`}
          >
            {viewedPhrase || replaceResult ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            {viewedPhrase || replaceResult ? 'Ocultar frase semilla' : 'Ver frase semilla'}
          </button>

          {viewedPhrase && (
            <>
              <div className="space-y-3">
                <p className="text-white/60 text-sm">Frase de 12 palabras</p>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <AnimatedPhrase phrase={viewedPhrase} className="text-white" />
                  <button type="button" onClick={() => copy(viewedPhrase, 'phrase')} className="mt-2 flex items-center gap-2 text-white/60 hover:text-white text-xs">
                    {copied === 'phrase' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'phrase' ? 'Copiado' : 'Copiar frase'}
                  </button>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2"
              >
                <p className="text-emerald-200 font-medium text-sm">Wallets conectadas</p>
                <p className="text-white/70 text-xs -mt-0.5">Direcciones vinculadas a tu cuenta a partir de esta frase.</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Bitcoin (red base)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{showBtc}</code>
                      <button type="button" onClick={() => showBtc && copyLinked(showBtc, 'btc')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'btc' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Lightning</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{user?.lightningAddress || user?.email || ''}</code>
                      <button type="button" onClick={() => copy(user?.lightningAddress || user?.email || '', 'ln')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'ln' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Ethereum (USDT / ERC-20)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{showUsdt}</code>
                      <button type="button" onClick={() => showUsdt && copyLinked(showUsdt, 'eth')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'eth' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Dogecoin</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{showDoge}</code>
                      <button type="button" onClick={() => showDoge && copyLinked(showDoge, 'doge')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'doge' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Litecoin</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{showLtc}</code>
                      <button type="button" onClick={() => showLtc && copyLinked(showLtc, 'ltc')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'ltc' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {!showLtc && (
                      <p className="text-amber-200/80 text-xs mt-1.5">Entrá a &quot;Ver frase semilla&quot;, ingresá tu contraseña y se generará la dirección Litecoin (y Ethereum) automáticamente.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Ethereum (ETH)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{showEth}</code>
                      <button type="button" onClick={() => showEth && copyLinked(showEth, 'eth')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'eth' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}

          {replaceResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <p className="text-amber-200/90 text-xs rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                La frase semilla anterior fue reemplazada: ya no está guardada ni vinculada a esta cuenta. Solo esta nueva frase controla las direcciones que ves en la app. Si tenías la frase vieja anotada, ya no da acceso a esta cuenta.
              </p>
              <div className="space-y-3">
                <p className="text-white/60 text-sm">Frase de 12 palabras</p>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <AnimatedPhrase phrase={replaceResult.mnemonic} className="text-white" />
                  <button type="button" onClick={() => copy(replaceResult.mnemonic, 'phrase')} className="mt-2 flex items-center gap-2 text-white/60 hover:text-white text-xs">
                    {copied === 'phrase' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'phrase' ? 'Copiado' : 'Copiar frase'}
                  </button>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2"
              >
                <p className="text-emerald-200 font-medium text-sm">Wallets conectadas</p>
                <p className="text-white/70 text-xs -mt-0.5">Direcciones vinculadas a tu cuenta a partir de esta frase.</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Bitcoin (red base)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{replaceResult.btcAddress}</code>
                      <button type="button" onClick={() => copy(replaceResult.btcAddress, 'btc')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'btc' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Lightning</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{user?.lightningAddress || user?.email || '—'}</code>
                      <button type="button" onClick={() => copy(user?.lightningAddress || user?.email || '', 'ln')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'ln' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Ethereum (USDT / ERC-20)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{replaceResult.ethAddress}</code>
                      <button type="button" onClick={() => copy(replaceResult.ethAddress, 'eth')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'eth' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Dogecoin</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{replaceResult.dogeAddress}</code>
                      <button type="button" onClick={() => copy(replaceResult.dogeAddress, 'doge')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'doge' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Litecoin</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{replaceResult.ltcAddress}</code>
                      <button type="button" onClick={() => copy(replaceResult.ltcAddress, 'ltc')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'ltc' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs mb-0.5">Ethereum (ETH)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-sm text-white/90 break-all min-w-0">{replaceResult.ethAddress}</code>
                      <button type="button" onClick={() => copy(replaceResult.ethAddress, 'eth')} className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === 'eth' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          <button
            type="button"
            onClick={() => openPasswordModal('replace')}
            className="mt-10 w-full py-4 rounded-2xl border border-amber-500/60 bg-amber-500/10 text-amber-400 font-medium flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-colors"
          >
            <KeyRound className="w-5 h-5" />
            Resetear frase semilla
          </button>
        </motion.div>
      ) : (
        <>
          <p className="text-white/60 text-sm mb-6">
            Generá una nueva frase de 12 palabras. A partir de ella se derivan automáticamente las direcciones de Bitcoin y Ethereum (USDT). Guardá la frase en un lugar seguro; quien la tenga controla los fondos. Solo podés vincular una frase por cuenta.
          </p>

      {!result ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleGenerate}
          className="w-full py-4 rounded-2xl bg-exodus text-white font-semibold flex items-center justify-center gap-2 hover:bg-exodus-dark transition-colors"
        >
          <KeyRound className="w-5 h-5" />
          Generar frase semilla y preparar wallets
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/90">
              <p className="font-medium mb-1">Guardá esta frase en un lugar seguro.</p>
              <p className="text-amber-200/70">No la compartas con nadie. Si vinculás con tu contraseña, la app la guardará cifrada y podrás verla cuando quieras ingresándola.</p>
            </div>
          </div>

          <div>
            <p className="text-white/60 text-sm mb-2">Frase de 12 palabras</p>
            <div className="glass rounded-2xl border border-white/5 p-4">
              {revealed ? (
                <AnimatedPhrase phrase={result.mnemonic} className="text-white" />
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="text-exodus font-medium text-sm hover:underline"
                >
                  Mostrar frase
                </button>
              )}
              {revealed && (
                <button
                  type="button"
                  onClick={() => copy(result.mnemonic, 'phrase')}
                  className="mt-2 flex items-center gap-2 text-white/60 hover:text-white text-xs"
                >
                  {copied === 'phrase' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === 'phrase' ? 'Copiado' : 'Copiar frase'}
                </button>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-2">
            <p className="text-white/90 text-sm shrink-0"><strong>Bitcoin:</strong></p>
            <code className="flex-1 font-mono text-sm text-white/80 break-all min-w-0">{result.btcAddress}</code>
            <button type="button" onClick={() => copy(result.btcAddress, 'btc')} className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80">
              {copied === 'btc' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-2">
            <p className="text-white/90 text-sm shrink-0"><strong>Ethereum:</strong></p>
            <code className="flex-1 font-mono text-sm text-white/80 break-all min-w-0">{result.ethAddress}</code>
            <button type="button" onClick={() => copy(result.ethAddress, 'eth')} className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80">
              {copied === 'eth' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-2">
            <p className="text-white/90 text-sm shrink-0"><strong>Litecoin:</strong></p>
            <code className="flex-1 font-mono text-sm text-white/80 break-all min-w-0">{result.ltcAddress}</code>
            <button type="button" onClick={() => copy(result.ltcAddress, 'ltc')} className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80">
              {copied === 'ltc' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-2">
            <p className="text-white/90 text-sm shrink-0"><strong>Dogecoin:</strong></p>
            <code className="flex-1 font-mono text-sm text-white/80 break-all min-w-0">{result.dogeAddress}</code>
            <button type="button" onClick={() => copy(result.dogeAddress, 'doge')} className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80">
              {copied === 'doge' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="glass rounded-2xl border border-white/5 p-4 flex items-center gap-2">
            <p className="text-white/90 text-sm shrink-0"><strong>Lightning:</strong></p>
            <code className="flex-1 font-mono text-sm text-white/80 break-all min-w-0">{user?.lightningAddress || user?.email || '—'}</code>
            <button type="button" onClick={() => copy(user?.lightningAddress || user?.email || '', 'ln')} className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80">
              {copied === 'ln' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {linkError && (
            <p className="text-rose-400 text-sm">{linkError}</p>
          )}
          {linked ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm">
              Direcciones vinculadas a tu cuenta. La app usará estas direcciones para Recibir, Enviar y ver saldos (Bitcoin en Mempool, USDT en red ERC-20).
            </div>
          ) : (
            <button
              type="button"
              disabled={linking}
              onClick={() => openPasswordModal('link')}
              className="w-full py-4 rounded-2xl bg-exodus text-white font-semibold flex items-center justify-center gap-2 hover:bg-exodus-dark transition-colors disabled:opacity-60"
            >
              <Link2 className="w-5 h-5" />
              {linking ? 'Vinculando…' : 'Vincular estas direcciones a mi cuenta'}
            </button>
          )}

          <p className="text-white/40 text-xs">
            Estas direcciones corresponden a la primera cuenta derivada de la frase (Bitcoin: m/84&apos;/0&apos;/0&apos;/0/0, Ethereum: m/44&apos;/60&apos;/0&apos;/0/0). Para usar estos saldos en la app, tendrías que importar esta frase en un flujo de “Importar wallet” (no implementado aquí).
          </p>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5 transition-colors"
          >
            Generar otra frase
          </button>
        </motion.div>
      )}
        </>
      )}
    </div>
  )
}
