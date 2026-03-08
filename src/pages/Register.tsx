import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, UserPlus, Mail, User, Lock, Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { registerUser, isPasswordValid } from '../api/users'
import { useAuth } from '../context/AuthContext'

export function Register() {
  const { setUser } = useAuth()
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
  const [registeredUser, setRegisteredUser] = useState<{ id: number; email: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('El email es obligatorio.')
      return
    }
    if (!password) {
      setError('La contraseña es obligatoria.')
      return
    }
    if (!isPasswordValid(password)) {
      setError('La contraseña debe tener mínimo 6 caracteres, letras o números y al menos una mayúscula.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!firstName.trim()) {
      setError('El primer nombre es obligatorio.')
      return
    }
    if (!firstSurname.trim()) {
      setError('El primer apellido es obligatorio.')
      return
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
      setRegisteredUser({ id: user.id, email: user.email })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar.')
    } finally {
      setLoading(false)
    }
  }

  if (registeredUser) {
    return (
      <div className="min-h-screen flex flex-col relative">
        <div className="bg-animated-exodus absolute inset-0 z-0" aria-hidden />
        <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white/80" />
            </Link>
            <h1 className="text-xl font-bold text-white">Registro</h1>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl border border-white/5 p-6 text-center"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-white mb-1">Usuario registrado</p>
            <p className="text-white/60 text-sm mb-6">Tu cuenta ha sido creada correctamente.</p>
            <div className="bg-white/5 rounded-xl p-4 text-left space-y-2">
              <p className="flex justify-between items-center">
                <span className="text-white/50 text-sm">ID NUMBER</span>
                <span className="font-mono font-bold text-white text-lg">{registeredUser.id}</span>
              </p>
              <p className="flex justify-between items-center">
                <span className="text-white/50 text-sm">Email</span>
                <span className="font-medium text-white truncate ml-2">{registeredUser.email}</span>
              </p>
            </div>
            <Link
              to="/"
              className="mt-6 inline-block w-full py-3 rounded-xl bg-exodus/90 hover:bg-exodus text-white font-medium text-center transition-colors"
            >
              Ir al portfolio
            </Link>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="bg-animated-exodus absolute inset-0 z-0" aria-hidden />
      <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/login" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </Link>
          <h1 className="text-xl font-bold text-white">Registrarse</h1>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
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
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
              title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
