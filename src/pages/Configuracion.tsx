import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Mail, User, Save, Trash2, AlertTriangle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateUser, deleteUser } from '../api/users'

export function Configuracion() {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [secondName, setSecondName] = useState('')
  const [firstSurname, setFirstSurname] = useState('')
  const [secondSurname, setSecondSurname] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setFirstName(user.firstName)
      setSecondName(user.secondName ?? '')
      setFirstSurname(user.firstSurname)
      setSecondSurname(user.secondSurname ?? '')
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!user) return
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
      const { user: updated } = await updateUser(user.id, {
        firstName: firstName.trim(),
        secondName: secondName.trim() || null,
        firstSurname: firstSurname.trim(),
        secondSurname: secondSurname.trim() || null,
      })
      setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setLoading(false)
    }
  }

  const openDeleteConfirm = () => setShowDeleteConfirm(true)

  const handleDeleteAccount = async () => {
    if (!user) return
    setShowDeleteConfirm(false)
    setError('')
    setDeleting(true)
    try {
      await deleteUser(user.id)
      logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la cuenta.')
    } finally {
      setDeleting(false)
    }
  }

  if (!user) {
    return (
      <div className="px-4 pt-6 pb-8 flex flex-col items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-exodus/30 border-t-exodus rounded-full animate-spin" />
        <p className="text-white/50 text-sm mt-3">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            key="delete-confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass rounded-2xl border border-white/10 overflow-hidden shadow-xl"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">¿Eliminar tu cuenta?</h3>
                <p className="text-white/60 text-sm">
                  Se borrarán todos tus datos. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3 p-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-white/20 text-white/80 font-medium hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Eliminar cuenta'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 mb-6">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Configuración</h1>
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
        {saved && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm px-4 py-3">
            Datos guardados correctamente.
          </div>
        )}

        <p className="text-white/50 text-sm">ID NUMBER: <span className="font-mono text-white">{user.id}</span></p>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="email"
              value={email}
              readOnly
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white/70 cursor-not-allowed"
              aria-label="Email (no editable)"
            />
          </div>
          <p className="text-white/40 text-xs mt-1">El email no se puede cambiar una vez registrada la cuenta.</p>
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
          disabled={loading || deleting}
          className="w-full py-3.5 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Guardar cambios
            </>
          )}
        </button>
      </motion.form>

      <div className="mt-8 pt-6 border-t border-white/10">
        <button
          type="button"
          onClick={openDeleteConfirm}
          disabled={loading || deleting}
          className="w-full py-3.5 rounded-xl border border-rose-500/40 text-rose-400 font-medium hover:bg-rose-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {deleting ? (
            <>
              <span className="w-4 h-4 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
              Eliminando...
            </>
          ) : (
            <>
              <Trash2 className="w-5 h-5" />
              Eliminar cuenta
            </>
          )}
        </button>
        <p className="text-center text-white/40 text-xs mt-2">Se borrará tu cuenta y todos los datos asociados.</p>
      </div>
    </div>
  )
}
