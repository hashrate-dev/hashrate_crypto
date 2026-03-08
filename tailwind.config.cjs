/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Exodus primary: blue → purple gradient
        exodus: {
          DEFAULT: '#1898EE',
          light: '#3BA8F5',
          dark: '#1486AA',
          purple: '#7C3AED',
        },
        // Dark blue-black (Exodus dark theme)
        surface: {
          950: '#020509',
          900: '#0a0f1a',
          800: '#0f1729',
          700: '#151d33',
          600: '#1e293b',
          500: '#334155',
        },
        // Asset colors (for icons in list)
        btc: '#f7931a',
        'btc-dim': '#e68a19',
        lightning: '#8b5cf6',
        usdt: '#26a17b',
      },
      boxShadow: {
        'glow-exodus': '0 0 32px -8px rgba(24, 152, 238, 0.35)',
        'glow-btc': '0 0 24px -6px rgba(247, 147, 26, 0.3)',
        'glow-lightning': '0 0 24px -6px rgba(139, 92, 246, 0.3)',
        'glow-usdt': '0 0 24px -6px rgba(38, 161, 123, 0.3)',
      },
    },
  },
  plugins: [],
}
