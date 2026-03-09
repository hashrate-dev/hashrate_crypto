import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Bell, Palette, HelpCircle, LogOut, UserCircle, Mail, Wallet, Globe } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const MENU_ITEMS = [
  { icon: Globe, labelKey: 'languages', subKey: 'language_sub', to: '/language' },
  { icon: Shield, labelKey: 'security', subKey: 'pin_access', to: '/security' },
  { icon: Bell, labelKey: 'notifications', subKey: 'alerts_transactions', to: '/notifications' },
  { icon: Palette, labelKey: 'appearance', subKey: 'theme_currency', to: '/appearance' },
  { icon: Wallet, labelKey: 'wallets', subKey: 'seed_lightning', to: '/billeteras' },
  { icon: HelpCircle, labelKey: 'help', subKey: 'faq_support', to: '#' },
] as const

export function Settings() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">{t('settings')}</h1>
      </div>

      {/* Datos de la cuenta */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl border border-white/5 p-5 mb-6"
      >
        <p className="text-sm font-semibold text-white/60 mb-1">{t('id_number')}</p>
        <p className="text-lg font-semibold text-white mb-4">{user?.id ?? '—'}</p>
        <p className="text-sm font-semibold text-white/60 mb-2">{t('email')}</p>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <Mail className="w-5 h-5 text-white/50 shrink-0" />
          <span className="text-white/90 truncate">{user?.email ?? '—'}</span>
        </div>
      </motion.div>

      <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
        {MENU_ITEMS.map((item, i) => {
          const linkProps = (item as { external?: boolean }).external
            ? { to: item.to as string, target: '_blank', rel: 'noopener noreferrer' as const }
            : { to: item.to }
          return (
          <Link key={item.labelKey} {...linkProps}>
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">{t(item.labelKey)}</p>
                <p className="text-sm text-white/50">{t(item.subKey)}</p>
              </div>
            </motion.div>
          </Link>
        )})}
      </div>

      <Link to="/Cuenta">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-4 flex items-center gap-4 p-4 rounded-2xl glass border border-white/5 hover:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-exodus/20 flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-exodus" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">{t('account')}</p>
            <p className="text-sm text-white/50">{t('edit_account')}</p>
          </div>
        </motion.div>
      </Link>

      <motion.button
        type="button"
        onClick={handleLogout}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-rose-500/30 text-rose-400 font-medium hover:bg-rose-500/10 transition-colors"
      >
        <LogOut className="w-5 h-5" /> {t('logout')}
      </motion.button>
    </div>
  )
}
