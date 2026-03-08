import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Coins, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getNotifyOnReceive,
  setNotifyOnReceive,
  getNotifyOnSend,
  setNotifyOnSend,
} from '../store/notifications'
export function Notifications() {
  const [notifyReceive, setNotifyReceive] = useState(true)
  const [notifySend, setNotifySend] = useState(true)

  useEffect(() => {
    setNotifyReceive(getNotifyOnReceive())
    setNotifySend(getNotifyOnSend())
  }, [])

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Notificaciones</h1>
      </div>

      <p className="text-white/50 text-sm mb-6">
        Elegí qué notificaciones querés recibir
      </p>

      <div className="space-y-6">
        {/* Aviso al recibir nuevos fondos */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl border border-white/5 overflow-hidden"
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Coins className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <p className="font-medium text-white">Recibir nuevos fondos</p>
                <p className="text-sm text-white/50">Aviso con sonido de alcancía</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifyReceive}
              onClick={() => {
                const next = !notifyReceive
                setNotifyOnReceive(next)
                setNotifyReceive(next)
              }}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                notifyReceive ? 'bg-exodus' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  notifyReceive ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </motion.div>

        {/* Aviso al enviar transferencia */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl border border-white/5 overflow-hidden"
        >
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Send className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <p className="font-medium text-white">Enviar transferencia</p>
                <p className="text-sm text-white/50">Aviso con sonido de enviar</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifySend}
              onClick={() => {
                const next = !notifySend
                setNotifyOnSend(next)
                setNotifySend(next)
              }}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                notifySend ? 'bg-exodus' : 'bg-white/20'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  notifySend ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
