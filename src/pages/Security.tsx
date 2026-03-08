import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Shield, Lock, Smartphone, Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  hasPin,
  setPin,
  removePin,
  isPinValid,
} from '../store/security'
import { setUserPin, clearUserPin, getTotpSetup, enableTotp, disableTotp, changePassword, isPasswordValid } from '../api/users'
import { useAuth } from '../context/AuthContext'

export function Security() {
  const { user, setUser } = useAuth()
  const [pinActive, setPinActive] = useState(false)
  const [faceIdOn, setFaceIdOn] = useState(false)
  const [step, setStep] = useState<'menu' | 'set' | 'confirm' | 'remove'>('menu')
  const [pinValue, setPinValue] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const [totpStep, setTotpStep] = useState<'idle' | 'setup' | 'disabling'>('idle')
  const [totpSecret, setTotpSecret] = useState('')
  const [totpOtpAuthUrl, setTotpOtpAuthUrl] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpDisablePassword, setTotpDisablePassword] = useState('')
  const [totpError, setTotpError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [usePinMode, setUsePinMode] = useState(false)
  const [changePwPin, setChangePwPin] = useState('')
  const [mainScreen, setMainScreen] = useState<'menu' | 'pin' | 'totp' | 'password'>('menu')

  useEffect(() => {
    setPinActive(hasPin())
  }, [])

  const handleTurnOnPin = () => {
    setStep('set')
    setPinValue('')
    setConfirmValue('')
    setError('')
  }

  const handleSetPin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isPinValid(pinValue)) {
      setError('El PIN debe tener entre 4 y 6 dígitos (solo números).')
      return
    }
    setStep('confirm')
    setConfirmValue('')
  }

  const handleConfirmPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (pinValue !== confirmValue) {
      setError('Los PIN no coinciden.')
      return
    }
    if (!isPinValid(confirmValue)) {
      setError('El PIN debe tener entre 4 y 6 dígitos (solo números).')
      return
    }
    setLoading(true)
    try {
      await setPin(confirmValue)
      if (user?.id) {
        try {
          await setUserPin(user.id, confirmValue)
        } catch {
          // PIN guardado localmente; backend puede no estar disponible
        }
      }
      setPinActive(true)
      setStep('menu')
      setPinValue('')
      setConfirmValue('')
      setMainScreen('menu')
      setSuccess('PIN activado correctamente.')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('No se pudo guardar el PIN.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelPin = () => {
    setStep('menu')
    setPinValue('')
    setConfirmValue('')
    setError('')
  }

  const goBackToMenu = () => {
    setMainScreen('menu')
    setStep('menu')
    setTotpStep('idle')
    setTotpError('')
    setTotpCode('')
    setTotpDisablePassword('')
  }

  const handleChangePin = () => {
    setStep('set')
    setPinValue('')
    setConfirmValue('')
    setError('')
  }

  const handleRemovePin = async () => {
    if (user?.id) {
      try {
        await clearUserPin(user.id)
      } catch {
        // seguir aunque falle el backend
      }
    }
    removePin()
    setPinActive(false)
    setStep('menu')
    setMainScreen('menu')
    setSuccess('PIN desactivado.')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleStartTotpSetup = async () => {
    if (!user?.id) return
    setTotpError('')
    setTotpStep('setup')
    setTotpCode('')
    try {
      const { secret, otpauthUrl } = await getTotpSetup(user.id)
      setTotpSecret(secret)
      setTotpOtpAuthUrl(otpauthUrl)
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : 'Error al generar código 2FA')
      setTotpStep('idle')
    }
  }

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !totpSecret) return
    const code = totpCode.replace(/\D/g, '').trim()
    if (code.length !== 6) {
      setTotpError('El código debe tener 6 dígitos.')
      return
    }
    setTotpError('')
    setLoading(true)
    try {
      const { user: updated } = await enableTotp(user.id, totpSecret, code)
      setUser(updated)
      setTotpStep('idle')
      setTotpSecret('')
      setTotpOtpAuthUrl('')
      setTotpCode('')
      setSuccess('Google Authenticator activado. Se pedirá al enviar fondos.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : 'Código incorrecto')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !totpDisablePassword.trim()) return
    setTotpError('')
    setLoading(true)
    try {
      const { user: updated } = await disableTotp(user.id, totpDisablePassword.trim())
      setUser(updated)
      setTotpStep('idle')
      setTotpDisablePassword('')
      setSuccess('Google Authenticator desactivado.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : 'Error al desactivar')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)
    if (!user) return
    if (usePinMode) {
      if (!changePwPin || !isPinValid(changePwPin)) {
        setPasswordError('El PIN debe tener entre 4 y 6 dígitos (solo números).')
        return
      }
    } else {
      if (!currentPassword) {
        setPasswordError('Ingresá tu contraseña actual.')
        return
      }
    }
    if (!newPassword) {
      setPasswordError('Ingresá la nueva contraseña.')
      return
    }
    if (!isPasswordValid(newPassword)) {
      setPasswordError('La nueva contraseña debe tener mínimo 6 caracteres, letras o números y al menos una mayúscula.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.')
      return
    }
    setPasswordLoading(true)
    try {
      if (usePinMode) {
        await changePassword(user.id, { pin: changePwPin, newPassword })
      } else {
        await changePassword(user.id, { currentPassword, newPassword })
      }
      setPasswordSaved(true)
      setCurrentPassword('')
      setChangePwPin('')
      setNewPassword('')
      setConfirmNewPassword('')
      setUsePinMode(false)
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Error al cambiar la contraseña.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const pinInputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-center text-2xl tracking-[0.5em] placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Seguridad</h1>
        {mainScreen !== 'menu' && (
          <button
            type="button"
            onClick={goBackToMenu}
            className="ml-auto p-2 rounded-xl hover:bg-white/5 transition-colors text-white/80 text-sm font-medium"
          >
            Volver
          </button>
        )}
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm px-4 py-3 mb-6"
        >
          {success}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {mainScreen === 'menu' && (
          <motion.div
            key="security-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <button
              type="button"
              onClick={() => { setMainScreen('pin'); setStep('menu'); }}
              className="w-full glass rounded-2xl border border-white/5 overflow-hidden flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">PIN de acceso</p>
                <p className="text-sm text-white/50">4 a 6 dígitos numéricos</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/40 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setMainScreen('totp')}
              className="w-full glass rounded-2xl border border-white/5 overflow-hidden flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">Google Authenticator</p>
                <p className="text-sm text-white/50">Código requerido al enviar fondos</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/40 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => setMainScreen('password')}
              className="w-full glass rounded-2xl border border-white/5 overflow-hidden flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">Cambiar contraseña</p>
                <p className="text-sm text-white/50">Contraseña actual o PIN</p>
              </div>
              <ArrowRight className="w-5 h-5 text-white/40 shrink-0" />
            </button>
          </motion.div>
        )}

        {mainScreen === 'pin' && step === 'menu' && (
          <motion.div
            key="pin-card"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="glass rounded-2xl border border-white/5 overflow-hidden"
          >
            <div className="p-4 border-b border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">PIN de acceso</p>
                <p className="text-sm text-white/50">4 a 6 dígitos numéricos</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {pinActive ? (
                <>
                  <p className="text-sm text-emerald-400/90">PIN activado</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleChangePin}
                      className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/80 text-sm font-medium hover:bg-white/5 transition-colors"
                    >
                      Cambiar PIN
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePin}
                      className="flex-1 py-2.5 rounded-xl border border-rose-500/30 text-rose-400/90 text-sm font-medium hover:bg-rose-500/10 transition-colors"
                    >
                      Desactivar PIN
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleTurnOnPin}
                  className="w-full py-2.5 rounded-xl bg-exodus/20 text-exodus font-medium hover:bg-exodus/30 transition-colors"
                >
                  Activar PIN
                </button>
              )}
            </div>
          </motion.div>
        )}

        {mainScreen === 'totp' && totpStep === 'idle' && (
          <motion.div
            key="totp-card"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="glass rounded-2xl border border-white/5 overflow-hidden"
          >
            <div className="p-4 border-b border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Google Authenticator</p>
                <p className="text-sm text-white/50">Código requerido al enviar fondos</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {user?.totpEnabled ? (
                <>
                  <p className="text-sm text-emerald-400/90">Activado: se pedirá el código al enviar</p>
                  <button
                    type="button"
                    onClick={() => { setTotpStep('disabling'); setTotpError(''); setTotpDisablePassword(''); }}
                    className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400/90 text-sm font-medium hover:bg-rose-500/10 transition-colors"
                  >
                    Desactivar 2FA
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartTotpSetup}
                  className="w-full py-2.5 rounded-xl bg-exodus/20 text-exodus font-medium hover:bg-exodus/30 transition-colors"
                >
                  Activar Google Authenticator
                </button>
              )}
            </div>
          </motion.div>
        )}

        {mainScreen === 'password' && (
          <motion.form
            key="password-form"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            onSubmit={handleChangePassword}
            className="glass rounded-2xl border border-white/5 overflow-hidden"
          >
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white/80" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Cambiar contraseña</p>
                  <p className="text-sm text-white/50">Contraseña actual o PIN</p>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {passwordError && (
                  <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
                    {passwordError}
                  </div>
                )}
                {passwordSaved && (
                  <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm px-4 py-3">
                    Contraseña actualizada correctamente.
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    {usePinMode ? 'PIN de acceso' : 'Contraseña actual'}
                  </label>
                  {usePinMode ? (
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={changePwPin}
                      onChange={(e) => setChangePwPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-center text-xl tracking-[0.4em] placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoComplete="off"
                      disabled={passwordLoading}
                    />
                  ) : (
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50"
                        autoComplete="current-password"
                        disabled={passwordLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white/80"
                        title={showCurrentPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                  {hasPin() && (
                    <button
                      type="button"
                      onClick={() => { setUsePinMode((v) => !v); setPasswordError(''); setChangePwPin(''); setCurrentPassword(''); }}
                      className="mt-1.5 text-xs text-exodus hover:underline"
                    >
                      {usePinMode ? 'Usar contraseña actual' : '¿No recordás tu contraseña? Usar PIN'}
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mín. 6 caracteres, una mayúscula"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50"
                      autoComplete="new-password"
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white/80"
                      title={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Repetir nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50"
                      autoComplete="new-password"
                      disabled={passwordLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white/80"
                      title={showConfirmNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      tabIndex={-1}
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full py-3 rounded-xl border border-white/20 text-white/90 font-medium hover:bg-white/5 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {passwordLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Cambiar contraseña
                    </>
                  )}
                </button>
              </div>
            </motion.form>
        )}

        {mainScreen === 'pin' && (step === 'set' || step === 'confirm') && (
          <motion.div
            key="pin-form"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="glass rounded-2xl border border-white/5 p-5 space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <h2 className="font-medium text-white">
                  {step === 'set' ? 'Crear PIN' : 'Confirmar PIN'}
                </h2>
                <p className="text-sm text-white/50">
                  {step === 'set'
                    ? 'Elegí un PIN de 4 a 6 dígitos (solo números)'
                    : 'Ingresá el mismo PIN de nuevo'}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
                {error}
              </div>
            )}

            {step === 'set' && (
              <form onSubmit={handleSetPin} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className={pinInputClass}
                  autoFocus
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelPin}
                    className="flex-1 py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-medium"
                  >
                    Siguiente
                  </button>
                </div>
              </form>
            )}

            {step === 'confirm' && (
              <form onSubmit={handleConfirmPin} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className={pinInputClass}
                  autoFocus
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('set')}
                    className="flex-1 py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Activar PIN'
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}

        {mainScreen === 'totp' && (totpStep === 'setup' || totpStep === 'disabling') && (
          <motion.div
            key="totp-form"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="glass rounded-2xl border border-white/5 p-5 space-y-4"
          >
            {totpStep === 'setup' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <Smartphone className="w-10 h-10 text-exodus" />
                  <div>
                    <h2 className="font-medium text-white">Configurar Google Authenticator</h2>
                    <p className="text-sm text-white/50">Escaneá el QR con la app o ingresá la clave manualmente</p>
                  </div>
                </div>
                {totpOtpAuthUrl && (
                  <div className="flex justify-center py-4 bg-white rounded-xl">
                    <QRCodeSVG value={totpOtpAuthUrl} size={180} level="M" />
                  </div>
                )}
                {totpSecret && (
                  <p className="text-center text-white/60 text-xs font-mono break-all px-2">{totpSecret}</p>
                )}
                {totpError && (
                  <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
                    {totpError}
                  </div>
                )}
                <form onSubmit={handleEnableTotp} className="space-y-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Código de 6 dígitos"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-center text-xl tracking-[0.4em] placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-exodus/50"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setTotpStep('idle'); setTotpSecret(''); setTotpOtpAuthUrl(''); setTotpCode(''); setTotpError(''); }}
                      className="flex-1 py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || totpCode.replace(/\D/g, '').length !== 6}
                      className="flex-1 py-3 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-medium disabled:opacity-50"
                    >
                      {loading ? '...' : 'Activar'}
                    </button>
                  </div>
                </form>
              </>
            )}
            {totpStep === 'disabling' && (
              <>
                <h2 className="font-medium text-white">Desactivar Google Authenticator</h2>
                <p className="text-sm text-white/50">Ingresá tu contraseña para desactivar el código 2FA.</p>
                {totpError && (
                  <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
                    {totpError}
                  </div>
                )}
                <form onSubmit={handleDisableTotp} className="space-y-4">
                  <input
                    type="password"
                    placeholder="Contraseña"
                    value={totpDisablePassword}
                    onChange={(e) => setTotpDisablePassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-exodus/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setTotpStep('idle'); setTotpDisablePassword(''); setTotpError(''); }}
                      className="flex-1 py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !totpDisablePassword.trim()}
                      className="flex-1 py-3 rounded-xl bg-rose-500/20 text-rose-400 font-medium hover:bg-rose-500/30 disabled:opacity-50"
                    >
                      {loading ? '...' : 'Desactivar 2FA'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
