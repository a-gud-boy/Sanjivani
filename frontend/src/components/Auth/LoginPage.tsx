import { useState } from 'react'
import {
  User as UserIcon,
  Stethoscope,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import type { User, UserType, LanguageCode } from '../../types'
import { requestOtp, verifyOtp, extractErrorMessage } from '../../services/api'
import BrandLogo from '../BrandLogo'
import RegisterModal from './RegisterModal'
import LanguageSelector from '../LanguageSelector'
import ThemeToggle from '../ThemeToggle'
import { useTranslation } from '../../i18n/translations'

interface LoginPageProps {
  onLoginSuccess: (user: User) => void
  language: LanguageCode
  onLanguageChange: (code: LanguageCode) => void
}

export default function LoginPage({
  onLoginSuccess,
  language,
  onLanguageChange,
}: LoginPageProps) {
  const [role, setRole] = useState<UserType>('patient')
  const [abhaId, setAbhaId] = useState('14-1234-5678-9012')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null)
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)

  const t = useTranslation(language)

  // ── Handle Role Switch ─────────────────────────────────────────
  const handleRoleChange = (newRole: UserType) => {
    setRole(newRole)
    setError(null)
    setOtpSent(false)
    setOtp('')
    if (newRole === 'patient') {
      setAbhaId('14-1234-5678-9012')
    } else {
      setAbhaId('14-9988-7766-5544')
    }
  }

  // ── Quick Fill Demo Accounts ───────────────────────────────────
  const handleAutofillDemo = async (demoRole: UserType) => {
    setRole(demoRole)
    setError(null)
    const targetAbha = demoRole === 'patient' ? '14-1234-5678-9012' : '14-9988-7766-5544'
    setAbhaId(targetAbha)
    setLoading(true)

    try {
      const res = await requestOtp(targetAbha, demoRole)
      setOtpSent(true)
      setSimulatedOtp(res.simulated_otp)
      setMaskedPhone(res.masked_phone || '+91 ******3210')
      setUserName(res.user_name)
      setOtp(res.simulated_otp) // auto-fill OTP for test convenience
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: Request OTP ────────────────────────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!abhaId.trim()) {
      setError('Please enter a valid 14-digit ABHA ID.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await requestOtp(abhaId.trim(), role)
      setOtpSent(true)
      setSimulatedOtp(res.simulated_otp)
      setMaskedPhone(res.masked_phone || '+91 ******3210')
      setUserName(res.user_name)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP & Login ─────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP code.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await verifyOtp(abhaId.trim(), otp.trim(), role)
      onLoginSuccess(res.user)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/30 flex flex-col justify-between transition-colors">
      {/* ── Top Bar ── */}
      <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Sanjivani <span className="text-brand-cyan">संजीवनी</span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Ministry of Ayush • National Health Authority
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle variant="subtle" />

          {/* Language Selector */}
          <LanguageSelector
            language={language}
            onLanguageChange={onLanguageChange}
            variant="subtle"
          />

          <button
            onClick={() => setIsRegisterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-cyan dark:text-cyan-300 bg-brand-cyan/10 dark:bg-cyan-950/60 hover:bg-brand-cyan/20 dark:hover:bg-cyan-900/50 border border-transparent dark:border-cyan-800/60 rounded-xl transition-colors min-h-[38px]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t.auth.register}</span>
          </button>
        </div>
      </header>

      {/* ── Center Login Card ── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-surface-border dark:border-slate-800 p-6 sm:p-8 space-y-5 animate-fade-in transition-colors">
          {/* Card Header */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-brand-cyan/10 dark:bg-cyan-950/60 text-brand-cyan dark:text-cyan-400 mb-3 ring-1 ring-brand-cyan/20 dark:ring-cyan-500/30">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t.auth.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.auth.subtitle}
            </p>

            {/* Role Switcher */}
            <div className="mt-5 flex rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-surface-border/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => handleRoleChange('patient')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  role === 'patient'
                    ? 'bg-white dark:bg-slate-700 text-brand-cyan dark:text-cyan-300 shadow-sm border border-transparent dark:border-slate-600/50 scale-[1.01]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>{t.auth.patientRoleTag}</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('doctor')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  role === 'doctor'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm border border-transparent dark:border-slate-600/50 scale-[1.01]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>{t.auth.doctorRoleTag}</span>
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span className="flex-1 font-medium">{error}</span>
              </div>
            )}

            {!otpSent ? (
              // ── Step 1: ABHA Form ──
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    {role === 'patient' ? t.auth.patientAbhaLabel : t.auth.doctorAbhaLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 14-1234-5678-9012"
                      value={abhaId}
                      onChange={(e) => setAbhaId(e.target.value)}
                      className="w-full px-3.5 py-3 text-sm font-medium rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800/90 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 tracking-wide"
                    />
                    <KeyRound className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400 dark:text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {t.auth.abhaFormat}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.auth.sendingOtp}</span>
                    </>
                  ) : (
                    <>
                      <span>{t.auth.requestOtp}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              // ── Step 2: OTP Verification ──
              <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
                <div className="p-3 bg-brand-cyan-light/30 dark:bg-brand-cyan-light/10 rounded-2xl border border-brand-cyan/20 dark:border-brand-cyan/30">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-brand-cyan dark:text-cyan-400">
                      {userName ? `${t.auth.welcome}, ${userName}` : t.auth.otpSent}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline"
                    >
                      {t.auth.changeAbha}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {t.auth.sentToMobile} <span className="font-semibold text-slate-800 dark:text-slate-100">{maskedPhone}</span>
                  </p>
                  {simulatedOtp && (
                    <div
                      onClick={() => setOtp(simulatedOtp)}
                      className="mt-2.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-brand-cyan/30 dark:border-brand-cyan/40 flex items-center justify-between cursor-pointer hover:bg-brand-cyan/5 dark:hover:bg-slate-750 transition-colors"
                      title="Click to auto-fill"
                    >
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        {t.auth.demoSandboxCode}:
                      </span>
                      <span className="text-xs font-mono font-bold text-brand-cyan dark:text-cyan-400 tracking-wider">
                        {simulatedOtp} ({t.auth.clickToFill})
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.auth.enterOtp}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg px-3 py-2.5 rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t.auth.verifying}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t.auth.verifyAndEnter}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── Direct Registration Action ── */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsRegisterOpen(true)}
                className="text-xs font-semibold text-brand-cyan hover:underline inline-flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-brand-cyan/5 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New patient or doctor? Register &amp; generate ABHA ID</span>
              </button>
            </div>

            {/* ── 1-Click Demo Sandbox Fast Logins ── */}
            <div className="pt-3 border-t border-surface-border dark:border-slate-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>{t.auth.oneClickTestAccounts}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleAutofillDemo('patient')}
                  className="p-3 text-left rounded-xl border border-surface-border dark:border-slate-700/80 hover:border-brand-cyan/50 dark:hover:border-cyan-500/60 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-cyan-50/50 dark:hover:bg-slate-800 transition-all group shadow-sm hover:shadow"
                >
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-brand-cyan dark:text-cyan-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand-cyan dark:group-hover:text-cyan-300">
                      {t.auth.demoPatient}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Ramesh Sharma (38y)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleAutofillDemo('doctor')}
                  className="p-3 text-left rounded-xl border border-surface-border dark:border-slate-700/80 hover:border-emerald-500/50 dark:hover:border-emerald-400/60 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-emerald-50/50 dark:hover:bg-slate-800 transition-all group shadow-sm hover:shadow"
                >
                  <div className="flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                      {t.auth.demoDoctor}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Dr. Priya Nair (MD)
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-400">
        {t.auth.footer}
      </footer>

      {/* Register Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialRole={role}
        onSuccessLogin={(user) => {
          onLoginSuccess(user)
        }}
        onPrefillLogin={(prefillAbha, prefillRole) => {
          setRole(prefillRole)
          setAbhaId(prefillAbha)
          setError(null)
          setOtpSent(false)
          setOtp('')
          setSimulatedOtp(null)
        }}
      />
    </div>
  )
}
