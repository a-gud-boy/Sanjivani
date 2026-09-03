import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

interface ThemeToggleProps {
  variant?: 'default' | 'subtle'
  className?: string
}

export default function ThemeToggle({ variant = 'default', className = '' }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  useEffect(() => {
    // Sync state with HTML element class
    const updateThemeState = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }

    // Listen for custom event across components
    window.addEventListener('sanjivani-theme-change', updateThemeState)

    // Listen to OS system color scheme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('sanjivani_theme')
      if (!stored) {
        if (e.matches) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        updateThemeState()
      }
    }

    mediaQuery.addEventListener('change', handleMediaChange)
    updateThemeState()

    return () => {
      window.removeEventListener('sanjivani-theme-change', updateThemeState)
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)

    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('sanjivani_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('sanjivani_theme', 'light')
    }

    window.dispatchEvent(
      new CustomEvent('sanjivani-theme-change', { detail: nextDark ? 'dark' : 'light' })
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl border text-xs font-semibold
                 transition-all duration-200 min-h-[38px] min-w-[38px] shadow-sm select-none ${
                   variant === 'subtle'
                     ? 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-surface-border dark:border-slate-700 text-slate-700 dark:text-slate-200'
                     : 'bg-white hover:bg-surface-muted dark:bg-slate-800 dark:hover:bg-slate-700 border-surface-border dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-cyan/40 dark:hover:border-brand-cyan/40'
                 } ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transform transition-transform duration-300 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-slate-600 transform transition-transform duration-300 rotate-0 hover:-rotate-12" />
        )}
      </div>
    </button>
  )
}
