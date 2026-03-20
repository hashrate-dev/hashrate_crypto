import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Copy, Check, KeyRound, AlertTriangle, Link2, Lock, Eye } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { generateSeedPhraseAndWallets, deriveAddressesFromMnemonic, isValidMnemonic, type DerivedWallets } from '../lib/seedPhrase'
import { encryptSeed, decryptSeed } from '../lib/seedEncryption'
import { useAuth } from '../context/AuthContext'
import { updateUserWallets, getEncryptedSeed } from '../api/users'

type PasswordPurpose = 'link' | 'view' | 'replace' | 'import'

/** Al generar frase semilla se derivan todas las direcciones; este payload las envía al usuario para almacenarlas (BTC, USDT, DOGE, LTC, ETH, SOL). */
function allAddressesPayload(derived: DerivedWallets) {
  return {
    btcAddress: derived.btcAddress,
    usdtAddress: derived.ethAddress,
    dogeAddress: derived.dogeAddress,
    ltcAddress: derived.ltcAddress,
    ethAddress: derived.ethAddress,
    solAddress: derived.solAddress,
  }
}

function AnimatedPhrase({ phrase, className = '' }: { phrase: string; className?: string }) {
  const words = phrase.trim().split(/\s+/).filter(Boolean)
  return (
    <div className={`font-mono text-sm grid grid-cols-4 gap-2 ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={`${i}-${word}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block px-3 py-2 rounded-xl border border-emerald-400/60 bg-emerald-950/40 text-white text-center"
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

export function SeedPhraseGenerator() {
  const { user, setUser } = useAuth()
  const location = useLocation()
  const isImportMode = (location.state as { mode?: string } | null)?.mode === 'import'

  const [result, setResult] = useState<DerivedWallets | null>(null)
  const [copied, setCopied] = useState<'phrase' | 'btc' | 'eth' | 'doge' | 'ltc' | 'sol' | 'ln' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordPurpose, setPasswordPurpose] = useState<PasswordPurpose>('link')
  const [passwordValue, setPasswordValue] = useState('')
  const [viewedPhrase, setViewedPhrase] = useState<string | null>(null)
  const [replaceResult, setReplaceResult] = useState<DerivedWallets | null>(null)
  const [importWords, setImportWords] = useState<string[]>(() => Array(12).fill(''))
  const [importResult, setImportResult] = useState<DerivedWallets | null>(null)
  const [importLinked, setImportLinked] = useState(false)

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

  const copy = (text: string, key: 'phrase' | 'btc' | 'eth' | 'doge' | 'ltc' | 'sol' | 'ln') => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const copyLinked = (text: string, key: 'btc' | 'eth' | 'doge' | 'ltc' | 'sol') => {
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
        // Al vincular: guardar frase cifrada y TODAS las direcciones derivadas (BTC, USDT, DOGE, LTC, ETH, SOL) en el usuario.
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
        // Siempre actualizar direcciones derivadas (incl. Solana) para que coincidan con la frase semilla
        const derived = deriveAddressesFromMnemonic(phrase)
        const { user: updated } = await updateUserWallets(user.id, {
          btcAddress: derived.btcAddress,
          usdtAddress: derived.ethAddress,
          dogeAddress: derived.dogeAddress,
          ltcAddress: derived.ltcAddress,
          ethAddress: derived.ethAddress,
          solAddress: derived.solAddress,
          password: passwordValue.trim(),
        })
        setUser(updated)
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
      } else if (passwordPurpose === 'import' && importResult) {
        const { salt, encrypted } = await encryptSeed(importResult.mnemonic, passwordValue.trim())
        const { user: updated } = await updateUserWallets(user.id, {
          ...allAddressesPayload(importResult),
          encryptedSeed: encrypted,
          seedSalt: salt,
          password: passwordValue.trim(),
        })
        setUser(updated)
        setImportLinked(true)
        setImportResult(null)
        setImportWords(Array(12).fill(''))
        setShowPasswordModal(false)
      }
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Contraseña incorrecta o error.')
    } finally {
      setLinking(false)
    }
  }

  const alreadyHasLinkedWallets = Boolean(user?.btcAddress?.trim() || user?.usdtAddress?.trim() || user?.dogeAddress?.trim() || user?.ltcAddress?.trim() || user?.ethAddress?.trim() || user?.solAddress?.trim())

  /** Llegada desde registro con nueva frase ya vinculada: mostrar frase y direcciones para que el usuario guarde. */
  const backupFromRegister = useMemo(() => {
    const s = location.state as { fromRegister?: boolean; mnemonic?: string } | null
    if (!s?.fromRegister || !s?.mnemonic?.trim()) return null
    try {
      return { mnemonic: s.mnemonic, derived: deriveAddressesFromMnemonic(s.mnemonic) }
    } catch {
      return null
    }
  }, [location.state])

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
        solAddress: d.solAddress,
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
  const showSol = displayedAddresses?.solAddress ?? user?.solAddress ?? ''

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
                  {passwordPurpose === 'import' && 'Contraseña para vincular'}
                </h3>
                <p className="text-white/60 text-sm text-center mb-4">
                  {passwordPurpose === 'link' && 'Ingresá tu contraseña para vincular. La frase se guardará cifrada. Guardala en un lugar seguro: sin ella no podés recuperar los fondos.'}
                  {passwordPurpose === 'view' && 'Ingresá tu contraseña para ver tu frase de 12 palabras.'}
                  {passwordPurpose === 'replace' && 'Las direcciones actuales dejarán de usarse. Si tenés fondos, movelos a las nuevas direcciones antes de continuar o los perderás. Ingresá tu contraseña para confirmar.'}
                  {passwordPurpose === 'import' && 'Ingresá tu contraseña para vincular la frase importada. La frase se guardará cifrada. Guardala en un lugar seguro.'}
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
        <Link to={isImportMode ? '/billeteras' : '/settings'} className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">{backupFromRegister ? 'Guardá tu frase semilla' : isImportMode ? 'Importar frase semilla' : 'Frase semilla'}</h1>
      </div>

      {backupFromRegister ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex gap-3">
            <KeyRound className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-white text-sm">
              Tu cuenta ya está configurada. Todas las monedas (Bitcoin, Ethereum, USDT, Dogecoin, Litecoin, Solana) usan direcciones derivadas de esta frase. Guardala en un lugar seguro; sin ella no podés recuperar los fondos.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-white/60 text-sm">Frase de 12 palabras</p>
            <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/30 p-4">
              <AnimatedPhrase phrase={backupFromRegister.mnemonic} />
              <button type="button" onClick={() => copy(backupFromRegister.mnemonic, 'phrase')} className="mt-3 flex items-center gap-2 text-white hover:text-white/90 text-sm">
                {copied === 'phrase' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'phrase' ? 'Copiado' : 'Copiar frase'}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <p className="text-white/70 text-sm font-medium mb-2">Direcciones derivadas (todas conectadas a esta frase)</p>
            {[
              { label: 'Bitcoin', value: backupFromRegister.derived.btcAddress, key: 'btc' as const },
              { label: 'Ethereum / USDT', value: backupFromRegister.derived.ethAddress, key: 'eth' as const },
              { label: 'Dogecoin', value: backupFromRegister.derived.dogeAddress, key: 'doge' as const },
              { label: 'Litecoin', value: backupFromRegister.derived.ltcAddress, key: 'ltc' as const },
              { label: 'Solana', value: backupFromRegister.derived.solAddress, key: 'sol' as const },
            ].map(({ label, value, key }) => (
              <div key={key} className="space-y-1">
                <p className="font-semibold text-white text-sm">{label}</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm text-white/90 break-all min-w-0 flex-1">{value}</code>
                  <button type="button" onClick={() => copy(value, key)} className="shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                    {copied === key ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/"
            replace
            state={{}}
            className="block w-full py-4 rounded-2xl bg-exodus text-white font-semibold text-center hover:bg-exodus-dark transition-colors"
          >
            Listo, guardé mi frase
          </Link>
        </motion.div>
      ) : isImportMode ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {importLinked ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm">
              Frase semilla vinculada a tu cuenta. Todas las monedas (Bitcoin, Ethereum, USDT, Dogecoin, Litecoin, Solana) usan direcciones derivadas de esta frase. Podés usarlas en Recibir y Enviar.
            </div>
          ) : (
            <>
              <p className="text-white/60 text-sm">
                Ingresá las 12 palabras de tu frase semilla en orden. A partir de ellas se derivarán las direcciones de tus wallets y se vincularán a esta cuenta.
              </p>
              <div>
                <p className="text-white/60 text-sm mb-3">Frase de 12 palabras</p>
                <div className="glass rounded-2xl border border-white/5 p-4">
                  <div className="grid grid-cols-3 gap-2">
                    {importWords.map((word, i) => (
                      <input
                        key={i}
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder={`${i + 1}`}
                        value={word}
                        onChange={(e) => {
                          const next = [...importWords]
                          next[i] = e.target.value.toLowerCase().trim()
                          setImportWords(next)
                          setLinkError(null)
                        }}
                        onPaste={(e) => {
                          if (i !== 0) return
                          e.preventDefault()
                          const pasted = e.clipboardData.getData('text').toLowerCase().trim().split(/\s+/).filter(Boolean)
                          if (pasted.length >= 12) {
                            const next = pasted.slice(0, 12)
                            setImportWords(next)
                            setLinkError(null)
                          }
                        }}
                        className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm font-mono focus:border-exodus focus:outline-none focus:ring-1 focus:ring-exodus/50"
                      />
                    ))}
                  </div>
                </div>
              </div>
              {linkError && <p className="text-rose-400 text-sm">{linkError}</p>}
              <button
                type="button"
                disabled={linking}
                onClick={() => {
                  const phrase = importWords.map((w) => w.trim()).join(' ').trim()
                  if (!phrase) {
                    setLinkError('Ingresá las 12 palabras.')
                    return
                  }
                  const words = phrase.split(/\s+/).filter(Boolean)
                  if (words.length !== 12) {
                    setLinkError('La frase debe tener exactamente 12 palabras.')
                    return
                  }
                  if (!isValidMnemonic(phrase)) {
                    setLinkError('Frase inválida. Revisá que las 12 palabras sean correctas y estén en el orden de tu backup.')
                    return
                  }
                  setLinkError(null)
                  try {
                    const derived: DerivedWallets = {
                      mnemonic: phrase,
                      ...deriveAddressesFromMnemonic(phrase),
                    }
                    setImportResult(derived)
                    openPasswordModal('import')
                  } catch {
                    setLinkError('No se pudieron derivar las direcciones. Revisá la frase.')
                  }
                }}
                className="w-full py-4 rounded-2xl bg-exodus text-white font-semibold flex items-center justify-center gap-2 hover:bg-exodus-dark transition-colors disabled:opacity-60"
              >
                <Link2 className="w-5 h-5" />
                {linking ? 'Vinculando…' : 'Vincular a mi cuenta'}
              </button>
            </>
          )}
        </motion.div>
      ) : alreadyHasLinkedWallets ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col min-h-[calc(100vh-10rem)] space-y-6">
          {/* Caja gris tipo adjunto: bordes redondeados, borde gris claro, candado */}
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 flex gap-3">
            <Lock className="w-5 h-5 text-white/80 shrink-0 mt-0.5" />
            <p className="text-white text-sm">
              Esta cuenta tiene una frase semilla vinculada. Podés verla cuando quieras ingresando tu contraseña.
            </p>
          </div>

          {/* Botón Ocultar/Ver: azul oscuro + borde azul cuando está visible; neutro cuando no */}
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
                ? 'border-2 border-blue-400 bg-blue-900/60 text-white hover:bg-blue-900/70'
                : 'border border-white/15 bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <Eye className="w-5 h-5 text-white/50" />
            {viewedPhrase || replaceResult ? 'Ocultar frase semilla' : 'Ver frase semilla'}
          </button>

          {viewedPhrase && (
            <>
              <div className="space-y-2">
                <p className="text-white/60 text-sm">Frase de 12 palabras</p>
                <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/30 p-4">
                  <AnimatedPhrase phrase={viewedPhrase} />
                  <button type="button" onClick={() => copy(viewedPhrase, 'phrase')} className="mt-3 flex items-center gap-2 text-white hover:text-white/90 text-sm">
                    {copied === 'phrase' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'phrase' ? 'Copiado' : 'Copiar frase'}
                  </button>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
              >
                {[
                  { label: 'Bitcoin', value: showBtc, key: 'btc' as const, copyFn: () => showBtc && copyLinked(showBtc, 'btc') },
                  { label: 'Ethereum', value: showUsdt, key: 'eth' as const, copyFn: () => showUsdt && copyLinked(showUsdt, 'eth') },
                  { label: 'Dogecoin', value: showDoge, key: 'doge' as const, copyFn: () => showDoge && copyLinked(showDoge, 'doge') },
                  { label: 'Litecoin', value: showLtc, key: 'ltc' as const, copyFn: () => showLtc && copyLinked(showLtc, 'ltc') },
                  { label: 'Solana', value: showSol, key: 'sol' as const, copyFn: () => showSol && copyLinked(showSol, 'sol') },
                ].map(({ label, value, key, copyFn }) => (
                  <div key={key} className="space-y-1">
                    <p className="font-semibold text-white text-sm">{label}</p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm text-white/90 break-all min-w-0 flex-1">{value || '—'}</code>
                      <button type="button" onClick={copyFn} className="shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === key ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                {(!showLtc || !showSol) && (
                  <p className="text-amber-200/80 text-xs">Entrá a &quot;Ver frase semilla&quot;, ingresá tu contraseña y se generarán las direcciones faltantes (Litecoin, Ethereum, Solana) automáticamente.</p>
                )}
              </motion.div>
            </>
          )}

          {replaceResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Caja verde tipo adjunto: borde verde vivo, fondo verde oscuro, texto blanco */}
              <div className="rounded-2xl border-2 border-emerald-400/70 bg-emerald-950/50 p-4 space-y-2">
                <p className="text-white text-sm">
                  La frase semilla anterior fue reemplazada: ya no está guardada ni vinculada a esta cuenta. Solo esta nueva frase controla las direcciones que ves en la app. Si tenías la frase vieja anotada, ya no da acceso a esta cuenta.
                </p>
                <p className="text-emerald-200 font-medium text-sm">Nueva frase vinculada. Guardala en un lugar seguro.</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm">Frase de 12 palabras</p>
                <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/30 p-4">
                  <AnimatedPhrase phrase={replaceResult.mnemonic} />
                  <button type="button" onClick={() => copy(replaceResult.mnemonic, 'phrase')} className="mt-3 flex items-center gap-2 text-white hover:text-white/90 text-sm">
                    {copied === 'phrase' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'phrase' ? 'Copiado' : 'Copiar frase'}
                  </button>
                </div>
              </div>
              {/* Direcciones: nombre en negrita, dos puntos, dirección (estilo adjunto) */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                {[
                  { label: 'Bitcoin', value: replaceResult.btcAddress, key: 'btc' as const },
                  { label: 'Ethereum', value: replaceResult.ethAddress, key: 'eth' as const },
                  { label: 'Dogecoin', value: replaceResult.dogeAddress, key: 'doge' as const },
                  { label: 'Litecoin', value: replaceResult.ltcAddress, key: 'ltc' as const },
                  { label: 'Solana', value: replaceResult.solAddress, key: 'sol' as const },
                ].map(({ label, value, key }) => (
                  <div key={key} className="space-y-1">
                    <p className="font-semibold text-white text-sm">{label}</p>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm text-white/90 break-all min-w-0 flex-1">{value}</code>
                      <button type="button" onClick={() => copy(value, key)} className="shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                        {copied === key ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </motion.div>
      ) : (
        <>
          <p className="text-white/60 text-sm mb-6">
            Generá una nueva frase de 12 palabras. A partir de ella se derivan las direcciones de todas las monedas (Bitcoin, Ethereum, USDT, Dogecoin, Litecoin, Solana). Guardá la frase en un lugar seguro; quien la tenga controla los fondos. Solo podés vincular una frase por cuenta.
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
          {/* Caja advertencia amarilla (estilo adjunto) */}
          <div className="rounded-2xl border border-amber-400/40 bg-amber-950/40 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-white">
              <p className="font-medium mb-1">Guardá esta frase en un lugar seguro.</p>
              <p className="text-white/80">No la compartas con nadie. Si vinculás con tu contraseña, la app la guardará cifrada y podrás verla cuando quieras ingresándola.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-white/60 text-sm">Frase de 12 palabras</p>
            <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/30 p-4">
              {/* Botón siempre en el mismo lugar (arriba); la frase aparece debajo al mostrar */}
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="w-full py-4 rounded-2xl bg-amber-500 text-black font-semibold flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors"
              >
                <Eye className="w-5 h-5 text-white/50" />
                {revealed ? 'Ocultar frase semilla' : 'Mostrar frase'}
              </button>
              {revealed && (
                <>
                  <AnimatedPhrase phrase={result.mnemonic} className="mt-4" />
                  <button
                    type="button"
                    onClick={() => copy(result.mnemonic, 'phrase')}
                    className="mt-3 flex items-center gap-2 text-white hover:text-white/90 text-sm"
                  >
                    {copied === 'phrase' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === 'phrase' ? 'Copiado' : 'Copiar frase'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Direcciones: Nombre en negrita, dirección (estilo adjunto) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            {[
              { label: 'Bitcoin', value: result.btcAddress, key: 'btc' as const },
              { label: 'Ethereum', value: result.ethAddress, key: 'eth' as const },
              { label: 'Dogecoin', value: result.dogeAddress, key: 'doge' as const },
              { label: 'Litecoin', value: result.ltcAddress, key: 'ltc' as const },
              { label: 'Solana', value: result.solAddress, key: 'sol' as const },
            ].map(({ label, value, key }) => (
              <div key={key} className="space-y-1">
                <p className="font-semibold text-white text-sm">{label}</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm text-white/90 break-all min-w-0 flex-1">{value}</code>
                  <button type="button" onClick={() => copy(value, key)} className="shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80">
                    {copied === key ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {linkError && (
            <p className="text-rose-400 text-sm">{linkError}</p>
          )}
          {linked ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm">
              Direcciones vinculadas a tu cuenta. La app usará estas direcciones para Recibir, Enviar y ver saldos (Bitcoin en Mempool, USDT en red ERC-20).
            </div>
          ) : (
            <>
              <p className="text-amber-200/90 text-sm rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-3">
                Guardá la frase en un lugar seguro antes de vincular. Sin ella no podés recuperar los fondos.
              </p>
              <button
                type="button"
                disabled={linking}
                onClick={() => openPasswordModal('link')}
                className="w-full py-4 rounded-2xl bg-exodus text-white font-semibold flex items-center justify-center gap-2 hover:bg-exodus-dark transition-colors disabled:opacity-60"
              >
                <Link2 className="w-5 h-5" />
                {linking ? 'Vinculando…' : 'Vincular estas direcciones a mi cuenta'}
              </button>
            </>
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
