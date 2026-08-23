import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Clinical design tokens
        brand: {
          cyan: '#0891b2',       // Primary action / teal
          'cyan-dark': '#0e7490',
          'cyan-light': '#cffafe',
          mint: '#10b981',       // Success / positive
          'mint-light': '#d1fae5',
          crimson: '#ef4444',    // Emergency / alert
          'crimson-dark': '#dc2626',
          'crimson-light': '#fee2e2',
          slate: '#1e293b',      // Primary text / deep nav
        },
        surface: {
          base: '#f8fafc',       // Page background
          card: '#ffffff',
          muted: '#f1f5f9',
          border: '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      minHeight: {
        'touch': '48px',
        'touch-lg': '56px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'panel': '0 0 0 1px rgb(0 0 0 / 0.05), 0 4px 16px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}

export default config
