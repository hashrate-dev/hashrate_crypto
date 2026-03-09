import { motion } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import type { Locale } from '../locales/translations'

const FLAG_CDN = 'https://flagcdn.com/w80'

const LOCALES: { value: Locale; labelKey: string; regionKey: string; flag: string }[] = [
  { value: 'es', labelKey: 'spanish', regionKey: 'region_spain', flag: `${FLAG_CDN}/es.png` },
  { value: 'en', labelKey: 'english', regionKey: 'region_usa', flag: `${FLAG_CDN}/us.png` },
  { value: 'pt', labelKey: 'portuguese', regionKey: 'region_brazil', flag: `${FLAG_CDN}/br.png` },
]

export function Language() {
  const { locale, setLocale, t } = useLanguage()

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">{t('languages')}</h1>
      </div>

      <p className="text-white/50 text-sm mb-6">{t('language_choose')}</p>

      <div className="space-y-4">
        {LOCALES.map((loc, i) => {
          const isSelected = locale === loc.value
          return (
            <motion.button
              key={loc.value}
              type="button"
              onClick={() => setLocale(loc.value)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-exodus bg-exodus/10 shadow-lg shadow-exodus/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-10 sm:w-16 sm:h-12 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-white/5">
                  <img
                    src={loc.flag}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{t(loc.labelKey)}</p>
                  <p className="text-sm text-white/50 truncate">
                    {t('language_type')}: {t(loc.regionKey)}
                  </p>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-exodus flex items-center justify-center shrink-0"
                  >
                    <Check className="w-4 h-4 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      <p className="text-center text-white/30 text-xs mt-8">{t('language_saved_auto')}</p>
    </div>
  )
}
