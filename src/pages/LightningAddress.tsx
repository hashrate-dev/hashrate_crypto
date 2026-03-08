import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Zap, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateUser } from '../api/users'

export function LightningAddress() {
  const { user, setUser } = useAuth()
  const [lightningAddress, setLightningAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setLightningAddress(user.lightningAddress ?? '')
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!user) return
    setLoading(true)
    try {
      const { user: updated } = await updateUser(user.id, {
        lightningAddress: lightningAddress.trim() || null,
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

  if (!user) {
    return (
      <div className="px-4 pt-6 pb-8 flex flex-col items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-exodus/30 border-t-exodus rounded-full animate-spin" />
        <p className="text-white/50 text-sm mt-3">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Dirección Lightning</h1>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl border border-white/5 p-5"
      >
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-amber-400/90" />
          Dirección Lightning (opcional)
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm px-4 py-3">
              Cambios guardados.
            </div>
          )}

          <div className="relative">
            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400/80" />
            <input
              type="text"
              value={lightningAddress}
              onChange={(e) => setLightningAddress(e.target.value)}
              placeholder="usuario@dominio.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-exodus/50 focus:border-transparent"
              autoComplete="off"
              disabled={loading}
            />
          </div>
          <p className="text-white/40 text-sm">
            Para recibir pagos por Lightning. Si no la configurás, se usa tu email.
          </p>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white/60 space-y-3">
            <p className="font-medium text-white/70">¿Cómo hacer que funcione de verdad?</p>
            <p>
              Tu correo (@hotmail, @gmail, etc.) no recibe Bitcoin. Necesitás una{' '}
              <strong className="text-white/80">dirección Lightning</strong> de un proveedor:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li>
                Creá una cuenta en{' '}
                <a
                  href="https://getalby.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-exodus hover:underline"
                >
                  Getalby.com
                </a>{' '}
                (o Strike, Wallet of Satoshi).
              </li>
              <li>
                Ahí te dan una dirección tipo{' '}
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/80">tuusuario@getalby.com</code>.
              </li>
              <li>Copiá esa dirección y pegala acá arriba. Guardá cambios.</li>
            </ol>
            <p>
              Cuando alguien te envíe a esa dirección, los satoshis llegan a tu cuenta en ese proveedor. Esta app
              solo muestra la dirección para que la compartas.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-exodus hover:bg-exodus/90 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar cambios
              </>
            )}
          </button>
        </form>
      </motion.section>
    </div>
  )
}
