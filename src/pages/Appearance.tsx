import { motion } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme, type ThemeId } from '../context/ThemeContext'

const themes: { id: ThemeId; name: string; desc: string; preview: string[] }[] = [
  {
    id: 'original',
    name: 'Original',
    desc: 'Azul y púrpura, estilo Exodus',
    preview: ['#0f0f1a', '#1898EE', '#7C3AED', '#1e293b'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    desc: 'Cian y teal, frío y claro',
    preview: ['#0a1628', '#22d3ee', '#06b6d4', '#0f2847'],
  },
  {
    id: 'forest',
    name: 'Forest',
    desc: 'Verde esmeralda, natural',
    preview: ['#0a1a0f', '#34d399', '#10b981', '#0d2b0d'],
  },
  {
    id: 'ember',
    name: 'Ember',
    desc: 'Ámbar y coral, cálido',
    preview: ['#1a0f0a', '#f59e0b', '#ea580c', '#2a1f18'],
  },
]

export function Appearance() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings" className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <h1 className="text-xl font-bold text-white">Apariencia</h1>
      </div>

      <p className="text-white/50 text-sm mb-6">Elegí un estilo de color para la app.</p>

      <div className="space-y-4">
        {themes.map((t, i) => {
          const isSelected = theme === t.id
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
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
                <div className="flex gap-1 rounded-xl overflow-hidden border border-white/10 shrink-0">
                  {t.preview.map((color, j) => (
                    <div
                      key={j}
                      className="w-10 h-10 sm:w-12 sm:h-12"
                      style={{ background: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-sm text-white/50 truncate">{t.desc}</p>
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

      <p className="text-center text-white/30 text-xs mt-8">El tema se guarda automáticamente.</p>
    </div>
  )
}
