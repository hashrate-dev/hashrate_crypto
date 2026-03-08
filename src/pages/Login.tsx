import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, LogIn, UserPlus, Lock, Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Ingresa tu email.')
      return
    }
    if (!password) {
      setError('Ingresa tu contraseña.')
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="bg-animated-exodus absolute inset-0 z-0" aria-hidden />
      <div className="relative z-10 max-w-lg mx-auto w-full px-4 pt-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full"
        >
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-exodus flex items-center justify-center mx-auto mb-4 shadow-glow-exodus">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Imperium Wallet</h1>
          <p className="text-white/50 text-sm mt-1">Inicia sesión para continuar</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass rounded-2xl border border-white/5 p-6 space-y-4"
        >
          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
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
            <label className="block text-sm font-medium text-white/70 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
                autoComplete="current-password"
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Entrar
              </>
            )}
          </button>

          <div className="pt-2 border-t border-white/10">
            <p className="text-center text-white/50 text-sm mb-3">¿No tienes cuenta?</p>
            <Link
              to="/register"
              className="w-full py-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Registrarse
            </Link>
          </div>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">Imperium Wallet</p>
        </motion.div>
      </div>
    </div>
  )
}
