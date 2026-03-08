import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
export type AlertType = 'error' | 'success' | 'info'

interface Toast {
  id: number
  message: string
  type: AlertType
}

interface NotificationContextValue {
  showAlert: (message: string, type?: AlertType) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const alertStyles: Record<AlertType, string> = {
  error: 'rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300',
  success: 'rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300',
  info: 'rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300',
}

let toastId = 0

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showAlert = useCallback((message: string, type: AlertType = 'info') => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <NotificationContext.Provider value={{ showAlert }}>
      {children}
      <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[200] max-w-lg w-full px-4 pointer-events-none flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={`text-sm px-4 py-3 shadow-lg ${alertStyles[t.type]}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
