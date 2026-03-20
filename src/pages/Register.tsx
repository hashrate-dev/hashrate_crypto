import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, UserPlus, Mail, User, Lock, Eye, FileInput, KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser, isPasswordValid, updateUserWallets } from '../api/users'
import { useAuth } from '../context/AuthContext'
import { deriveAddressesFromMnemonic, generateSeedPhraseAndWallets, isValidMnemonic } from '../lib/seedPhrase'
import { encryptSeed } from '../lib/seedEncryption'

type RegisterStep = 'choice' | 'form' | 'seed'
type RegisterMode = 'import' | 'new'

export function Register() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<RegisterStep>('choice')
  const [registerMode, setRegisterMode] = useState<RegisterMode | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [secondName, setSecondName] = useState('')
  const [firstSurname, setFirstSurname] = useState('')
  const [secondSurname, setSecondSurname] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [importWords, setImportWords] = useState<string[]>(() => Array(12).fill(''))

  const wantImportSeed = registerMode === 'import'

  const validateForm = () => {
    setError('')
    if (!email.trim()) {
      setError('El email es obligatorio.')
      return false
    }
    if (!password) {
      setError('La contraseña es obligatoria.')
      return false
    }
    if (!isPasswordValid(password)) {
      setError('La contraseña debe tener mínimo 6 caracteres, letras o números y al menos una mayúscula.')
      return false
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return false
    }
    if (!firstName.trim()) {
      setError('El primer nombre es obligatorio.')
      return false
    }
    if (!firstSurname.trim()) {
      setError('El primer apellido es obligatorio.')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (step === 'seed') {
      const phrase = importWords.map((w) => w.trim()).join(' ').trim()
      if (!phrase) {
        setError('Ingresá las 12 palabras de tu frase semilla.')
        return
      }
      const words = phrase.split(/\s+/).filter(Boolean)
      if (words.length !== 12) {
        setError('La frase debe tener exactamente 12 palabras.')
        return
      }
      if (!isValidMnemonic(phrase)) {
        setError('Frase semilla inválida. Revisá que las 12 palabras sean correctas y estén en el orden de tu backup.')
        return
      }
    } else {
      if (!validateForm()) return
      if (wantImportSeed) {
        setStep('seed')
        return
      }
    }
    setLoading(true)
    try {
      const { user } = await registerUser({
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        secondName: secondName.trim() || undefined,
        firstSurname: firstSurname.trim(),
        secondSurname: secondSurname.trim() || undefined,
      })
      setUser(user)
      if (wantImportSeed) {
        const phrase = importWords.map((w) => w.trim()).join(' ').trim()
        try {
          const derived = deriveAddressesFromMnemonic(phrase)
          const { salt, encrypted } = await encryptSeed(phrase, password)
          const { user: updated } = await updateUserWallets(user.id, {
            btcAddress: derived.btcAddress,
            usdtAddress: derived.ethAddress,
            dogeAddress: derived.dogeAddress,
            ltcAddress: derived.ltcAddress,
            ethAddress: derived.ethAddress,
            solAddress: derived.solAddress,
            encryptedSeed: encrypted,
            seedSalt: salt,
            password,
          })
          setUser(updated)
        } catch (seedErr) {
          setError(seedErr instanceof Error ? seedErr.message : 'Error al vincular la frase semilla.')
          setLoading(false)
          return
        }
        navigate('/', { replace: true })
      } else {
        // Nueva frase: generar, derivar todas las direcciones (BTC, USDT, DOGE, LTC, ETH, SOL) y vincular a la cuenta
        try {
          const derived = generateSeedPhraseAndWallets()
          const { salt, encrypted } = await encryptSeed(derived.mnemonic, password)
          const { user: updated } = await updateUserWallets(user.id, {
            btcAddress: derived.btcAddress,
            usdtAddress: derived.ethAddress,
            dogeAddress: derived.dogeAddress,
            ltcAddress: derived.ltcAddress,
            ethAddress: derived.ethAddress,
            solAddress: derived.solAddress,
            encryptedSeed: encrypted,
            seedSalt: salt,
          })
          setUser(updated)
          navigate('/seed-phrase', { replace: true, state: { fromRegister: true, mnemonic: derived.mnemonic } })
        } catch (seedErr) {
          setError(seedErr instanceof Error ? seedErr.message : 'Error al configurar la frase semilla.')
          setLoading(false)
          return
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="bg-animated-exodus absolute inset-0 z-0" aria-hidden />
      <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-6">
          {step === 'form' ? (
            <button
              type="button"
              onClick={() => { setStep('choice'); setRegisterMode(null); setError(''); }}
              className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/80" />
            </button>
          ) : step === 'seed' ? (
            <button
              type="button"
              onClick={() => { setStep('form'); setError(''); }}
              className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/80" />
            </button>
          ) : (
            <Link to="/login" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/80" />
            </Link>
          )}
          <h1 className="text-xl font-bold text-white">
            {step === 'seed' ? 'Frase semilla' : 'Registrarse'}
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {step === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex gap-3">
                <KeyRound className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-white/70 text-sm">
                  Todas las monedas (Bitcoin, Ethereum, USDT, Dogecoin, Litecoin, Solana) quedarán conectadas a la misma frase semilla. Elegí si usás una frase existente o si generamos una nueva para tu cuenta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setRegisterMode('import'); setStep('form'); setError(''); }}
                className="w-full py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors border border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              >
                <FileInput className="w-5 h-5" />
                Registrarme con una frase semilla existente
              </button>
              <button
                type="button"
                onClick={() => { setRegisterMode('new'); setStep('form'); setError(''); }}
                className="w-full py-4 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors border border-exodus/60 bg-exodus/10 text-exodus hover:bg-exodus/20"
              >
                <KeyRound className="w-5 h-5" />
                Registrarme con una nueva frase semilla
              </button>
            </motion.div>
          ) : step === 'seed' ? (
            <motion.form
              key="seed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleSubmit}
              className="glass rounded-2xl border border-white/5 p-5 space-y-4 w-full"
            >
              {error && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
                  {error}
                </div>
              )}
              <p className="text-white/70 text-sm">
                Ingresá las 12 palabras de tu frase semilla. Se vincularán a tu nueva cuenta y se derivarán las direcciones de todas las monedas (Bitcoin, Ethereum, USDT, Dogecoin, Litecoin, Solana) desde esta frase.
              </p>
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
                      setError('')
                    }}
                    onPaste={(e) => {
                      if (i !== 0) return
                      e.preventDefault()
                      const pasted = e.clipboardData.getData('text').toLowerCase().trim().split(/\s+/).filter(Boolean)
                      if (pasted.length >= 12) {
                        setImportWords(pasted.slice(0, 12))
                        setError('')
                      }
                    }}
                    className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm font-mono focus:border-exodus focus:outline-none focus:ring-1 focus:ring-exodus/50"
                    disabled={loading}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Crear cuenta
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={handleSubmit}
              className="glass rounded-2xl border border-white/5 p-5 space-y-4 w-full"
            >
        {error && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
              autoComplete="email"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Contraseña *</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mín. 6 caracteres, una mayúscula"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
              title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              tabIndex={-1}
            >
              <Eye className="w-4 h-4 text-white/50" />
            </button>
          </div>
          <p className="text-xs text-white/40 mt-1">Mínimo 6 caracteres, letras o números y al menos una mayúscula.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Repetir contraseña *</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
              autoComplete="new-password"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors"
              title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              tabIndex={-1}
            >
              <Eye className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Primer nombre *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej. Juan"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
                autoComplete="given-name"
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Segundo nombre</label>
            <input
              type="text"
              value={secondName}
              onChange={(e) => setSecondName(e.target.value)}
              placeholder="Ej. Carlos"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
              autoComplete="additional-name"
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Primer apellido *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={firstSurname}
                onChange={(e) => setFirstSurname(e.target.value)}
                placeholder="Ej. García"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
                autoComplete="family-name"
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Segundo apellido</label>
            <input
              type="text"
              value={secondSurname}
              onChange={(e) => setSecondSurname(e.target.value)}
              placeholder="Ej. López"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
              autoComplete="family-name"
              disabled={loading}
            />
          </div>
        </div>

        {!wantImportSeed && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Crear cuenta
                </>
              )}
            </button>
          )}
          {wantImportSeed && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl border border-exodus/60 bg-exodus/10 text-exodus font-semibold hover:bg-exodus/20 transition-colors flex items-center justify-center gap-2"
            >
              Siguiente
            </button>
          )}
            </motion.form>
          )}
        </AnimatePresence>

        <p className="text-center text-white/40 text-xs mt-5">
          Al registrarte se te asignará un ID NUMBER vinculado a tus datos.
        </p>
        <p className="text-center mt-3">
          <Link to="/login" className="text-sm text-white/50 hover:text-white/70">¿Ya tienes cuenta? Entrar</Link>
        </p>
      </div>
    </div>
  )
}
