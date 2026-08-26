import { useState, useRef } from 'react'
import { Globe, ChevronDown, CheckCircle2, User } from 'lucide-react'
import { LANGUAGES, type Language, type LanguageCode } from '../types'
import ModelSelector from './ModelSelector'

interface HeaderProps {
  language: LanguageCode
  onLanguageChange: (code: LanguageCode) => void
  abhaLinked: boolean
  abhaId: string | null
  onSummaryOpen: () => void
}

export default function Header({
  language,
  onLanguageChange,
  abhaLinked,
  abhaId,
  onSummaryOpen,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]

  const handleSelect = (lang: Language) => {
    onLanguageChange(lang.code)
    setDropdownOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-surface-border shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* ── Brand ── */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo mark */}
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-cyan flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 8v4l2.5 2.5" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.5 15.5C9.5 17 10.7 18 12 18c1.3 0 2.5-1 3.5-2.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-slate-900 leading-tight truncate">
              Sanjivani <span className="text-brand-cyan">संजीवनी</span>
            </h1>
            <p className="text-[11px] text-slate-500 leading-tight truncate">
              AYUSH &amp; Clinical Intake Assistant
            </p>
          </div>
        </div>

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Model Selector Dropdown */}
          <ModelSelector />

          {/* ABHA Status Chip */}
          {abhaLinked ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            bg-brand-mint-light text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>ABHA: {abhaId ?? 'Linked'}</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            bg-slate-100 text-slate-500 text-xs font-medium">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Walk-in Patient</span>
            </div>
          )}

          {/* Language Switcher */}
          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border
                         bg-white hover:bg-surface-muted text-slate-700 text-xs font-medium
                         transition-colors duration-150 min-h-[40px]"
              onClick={() => setDropdownOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-label="Change language"
            >
              <Globe className="w-3.5 h-3.5 text-brand-cyan flex-shrink-0" />
              <span>{currentLang.nativeLabel}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-panel
                           border border-surface-border overflow-hidden z-50 animate-fade-in"
                role="listbox"
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    className={`w-full flex items-center justify-between px-4 py-2.5
                                text-sm transition-colors duration-100
                                ${lang.code === language
                                  ? 'bg-brand-cyan/10 text-brand-cyan font-semibold'
                                  : 'text-slate-700 hover:bg-surface-muted'
                                }`}
                    role="option"
                    aria-selected={lang.code === language}
                    onClick={() => handleSelect(lang)}
                  >
                    <span>{lang.nativeLabel}</span>
                    <span className="text-xs text-slate-400">{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary Button */}
          <button
            className="btn-secondary text-xs hidden sm:flex min-h-[40px]"
            onClick={onSummaryOpen}
          >
            View Summary
          </button>
        </div>
      </div>
    </header>
  )
}
