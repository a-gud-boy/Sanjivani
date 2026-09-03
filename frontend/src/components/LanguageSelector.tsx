import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown } from 'lucide-react'
import { LANGUAGES, type Language, type LanguageCode } from '../types'

interface LanguageSelectorProps {
  language: LanguageCode
  onLanguageChange: (code: LanguageCode) => void
  variant?: 'default' | 'subtle'
}

export default function LanguageSelector({
  language,
  onLanguageChange,
  variant = 'default',
}: LanguageSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]

  const handleSelect = (lang: Language) => {
    onLanguageChange(lang.code)
    setDropdownOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold
                   transition-all duration-150 min-h-[38px] shadow-sm ${
                     variant === 'subtle'
                       ? 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-surface-border dark:border-slate-700 text-slate-700 dark:text-slate-200'
                       : 'bg-white hover:bg-surface-muted dark:bg-slate-800 dark:hover:bg-slate-700 border-surface-border dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-cyan/40 dark:hover:border-brand-cyan/40'
                   }`}
        onClick={() => setDropdownOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={dropdownOpen}
        aria-label="Change language"
      >
        <Globe className="w-3.5 h-3.5 text-brand-cyan flex-shrink-0" />
        <span className="font-medium text-slate-800 dark:text-slate-100">{currentLang.nativeLabel}</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform duration-150 ${
            dropdownOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {dropdownOpen && (
        <div
          className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 rounded-2xl shadow-xl
                     border border-surface-border dark:border-slate-750 overflow-hidden z-50 animate-fade-in py-1"
          role="listbox"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`w-full flex items-center justify-between px-3.5 py-2.5
                          text-xs transition-colors duration-100 text-left
                          ${
                            lang.code === language
                              ? 'bg-brand-cyan/10 dark:bg-brand-cyan/20 text-brand-cyan dark:text-cyan-400 font-bold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
              role="option"
              aria-selected={lang.code === language}
              onClick={() => handleSelect(lang)}
            >
              <span className="font-medium">{lang.nativeLabel}</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
