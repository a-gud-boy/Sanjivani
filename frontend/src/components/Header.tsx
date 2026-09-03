import { ArrowLeft, CheckCircle2, Loader2, Save, User as UserIcon } from 'lucide-react'
import type { LanguageCode, User } from '../types'
import BrandLogo from './BrandLogo'
import LanguageSelector from './LanguageSelector'
import { useTranslation } from '../i18n/translations'

interface HeaderProps {
  language: LanguageCode
  onLanguageChange: (code: LanguageCode) => void
  abhaLinked: boolean
  abhaId: string | null
  onSummaryOpen: () => void
  user?: User | null
  onBackToDashboard?: () => void
  onOpenProfile?: () => void
  onSubmitDetails?: () => void
  isSubmitting?: boolean
}

export default function Header({
  language,
  onLanguageChange,
  abhaLinked,
  abhaId,
  onSummaryOpen,
  user,
  onBackToDashboard,
  onOpenProfile,
  onSubmitDetails,
  isSubmitting = false,
}: HeaderProps) {
  const t = useTranslation(language)

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-surface-border shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* ── Brand & Back to Dashboard ── */}
        <div className="flex items-center gap-3 min-w-0">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-surface-border bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.header.dashboard}</span>
            </button>
          )}

          <BrandLogo size="md" />
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-slate-900 leading-tight truncate">
              {user ? (
                <>
                  {user.name} <span className="text-xs font-normal text-slate-400">({user.user_type === 'patient' ? t.auth.patient : t.auth.doctor})</span>
                </>
              ) : (
                <>
                  Sanjivani <span className="text-brand-cyan">संजीवनी</span>
                </>
              )}
            </h1>
            <p className="text-[11px] text-slate-500 leading-tight truncate">
              {user ? `ABHA: ${user.abha_id}` : 'AYUSH & Clinical Intake Assistant'}
            </p>
          </div>
        </div>

        {/* ── Right Controls ── */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* ABHA Status Chip */}
          {abhaLinked ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            bg-brand-mint-light text-emerald-700 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t.header.abhaLinked}: {abhaId ?? 'Linked'}</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            bg-slate-100 text-slate-500 text-xs font-medium">
              <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t.header.walkInPatient}</span>
            </div>
          )}

          {/* Profile Navigation Button */}
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border
                         bg-white hover:bg-surface-muted text-slate-700 text-xs font-semibold
                         transition-colors duration-150 min-h-[40px]"
              title="View & Edit Patient Profile"
            >
              <UserIcon className="w-3.5 h-3.5 text-brand-cyan flex-shrink-0" />
              <span className="hidden sm:inline">{t.header.profile}</span>
            </button>
          )}

          {/* Language Switcher */}
          <LanguageSelector
            language={language}
            onLanguageChange={onLanguageChange}
          />

          {/* Summary Button */}
          <button
            className="btn-secondary text-xs hidden sm:flex min-h-[40px]"
            onClick={onSummaryOpen}
          >
            {t.header.viewSummary}
          </button>

          {/* Submit Details Button (Save to Health Record) */}
          {onSubmitDetails && (
            <button
              onClick={onSubmitDetails}
              disabled={isSubmitting}
              className="btn-primary text-xs px-3.5 py-2 min-h-[40px] flex items-center gap-1.5 shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.header.saving}</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.header.submitDetails}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
