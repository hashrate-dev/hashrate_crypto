import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, BarChart3, Send, QrCode, History, Settings } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const navItems = [
  { path: '/', icon: Home, labelKey: 'portfolio' },
  { path: '/mercado', icon: BarChart3, labelKey: 'market' },
  { path: '/send', icon: Send, labelKey: 'send_nav' },
  { path: '/receive', icon: QrCode, labelKey: 'receive_nav' },
  { path: '/history', icon: History, labelKey: 'history' },
  { path: '/settings', icon: Settings, labelKey: 'settings_nav' },
]

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { t } = useLanguage()

  return (
    <div className="h-full min-h-screen flex flex-col relative overflow-hidden">
      <div className="bg-animated-exodus" aria-hidden />
      <header className="sticky top-0 z-50 glass border-b border-white/5 safe-bottom relative z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-exodus flex items-center justify-center shadow-glow-exodus">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">{t('imperium_wallet')}</span>
          </Link>
          <div className="w-9" />
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-24 max-w-lg mx-auto w-full relative z-10 scrollbar-hide">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-[100] w-full safe-bottom">
        <div className="max-w-lg mx-auto w-full">
          <div className="glass border-t border-white/5 rounded-t-2xl bg-surface-900/95 backdrop-blur-xl">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map(({ path, icon: Icon, labelKey }) => {
              const isActive = path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/')
              return (
                <Link
                  key={path}
                  to={path}
                  className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 rounded-xl transition-colors ${
                    isActive ? 'text-exodus' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {isActive ? (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-exodus/10 border border-exodus/20"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                    />
                  ) : null}
                  <span className="relative z-10">
                    <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span className="relative z-10 text-[10px] font-medium">{t(labelKey)}</span>
                </Link>
              )
            })}
          </div>
          </div>
        </div>
      </nav>
    </div>
  )
}
