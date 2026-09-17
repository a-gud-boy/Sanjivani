import { useState } from 'react'
import {
  User as UserIcon,
  Stethoscope,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import type { User, UserType, LanguageCode } from '../../types'
import {
  requestPatientOtp,
  verifyPatientOtp,
  requestDoctorOtp,
  verifyDoctorOtp,
  extractErrorMessage,
} from '../../services/api'
import BrandLogo from '../BrandLogo'
import PatientRegisterModal from './PatientRegisterModal'
import DoctorRegisterModal from './DoctorRegisterModal'
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
  const [idInput, setIdInput] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPatientRegisterOpen, setIsPatientRegisterOpen] = useState(false)
  const [isDoctorRegisterOpen, setIsDoctorRegisterOpen] = useState(false)

  const t = useTranslation(language)

  // ── Handle Role Switch ─────────────────────────────────────────
  const handleRoleChange = (newRole: UserType) => {
    setRole(newRole)
    setError(null)
    setOtpSent(false)
    setOtp('')
    setIdInput('')
    setUserName(null)
    setMaskedPhone(null)
  }

  // ── Step 1: Request OTP ────────────────────────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanId = idInput.trim()
    if (!cleanId) {
      setError(
        role === 'doctor'
          ? 'Please enter your HP ID (Healthcare Professional ID).'
          : 'Please enter your 14-digit ABHA ID.',
      )
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (role === 'doctor') {
        const res = await requestDoctorOtp(cleanId)
        setOtpSent(true)
        setMaskedPhone(res.masked_phone || null)
        setUserName(res.user_name)
      } else {
        const res = await requestPatientOtp(cleanId)
        setOtpSent(true)
        setMaskedPhone(res.masked_phone || null)
        setUserName(res.user_name)
      }
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP & Login ─────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanOtp = otp.trim()
    if (!cleanOtp) {
      setError('Please enter the 6-digit OTP verification code.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      if (role === 'doctor') {
        const res = await verifyDoctorOtp(idInput.trim(), cleanOtp)
        onLoginSuccess(res.user)
      } else {
        const res = await verifyPatientOtp(idInput.trim(), cleanOtp)
        onLoginSuccess(res.user)
      }
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
            onClick={() => {
              if (role === 'doctor') {
                setIsDoctorRegisterOpen(true)
              } else {
                setIsPatientRegisterOpen(true)
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-cyan dark:text-cyan-300 bg-brand-cyan/10 dark:bg-cyan-950/60 hover:bg-brand-cyan/20 dark:hover:bg-cyan-900/50 border border-transparent dark:border-cyan-800/60 rounded-xl transition-colors min-h-[38px]"
          >
            <UserPlus className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
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
              {role === 'doctor' ? (
                <Stethoscope className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldCheck className="w-7 h-7 text-brand-cyan" />
              )}
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {role === 'doctor' ? t.auth.doctorTitle : t.auth.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {role === 'doctor' ? t.auth.doctorSubtitle : t.auth.subtitle}
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
                <UserIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
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
                <Stethoscope className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
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
              // ── Step 1: Identifier Form ──
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    {role === 'patient' ? t.auth.patientAbhaLabel : t.auth.doctorAbhaLabel}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder={role === 'doctor' ? 'e.g. HP-MH-84729' : '14-XXXX-XXXX-XXXX'}
                      value={idInput}
                      onChange={(e) => setIdInput(e.target.value)}
                      className="w-full px-3.5 py-3 text-sm font-medium rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800/90 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 tracking-wide"
                    />
                    <KeyRound className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400 dark:text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {role === 'doctor' ? t.auth.doctorFormat : t.auth.abhaFormat}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" aria-hidden="true" />
                      <span>{t.auth.sendingOtp}</span>
                    </>
                  ) : (
                    <>
                      <span>{role === 'doctor' ? t.auth.doctorRequestOtp : t.auth.requestOtp}</span>
                      <ArrowRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              // ── Step 2: OTP Verification ──
              <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
                <div className="p-3.5 bg-brand-cyan-light/30 dark:bg-brand-cyan-light/10 rounded-2xl border border-brand-cyan/20 dark:border-brand-cyan/30">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-brand-cyan dark:text-cyan-400">
                      {userName
                        ? `${t.auth.welcome}, ${role === 'doctor' && !userName.startsWith('Dr.') ? 'Dr. ' : ''}${userName}`
                        : role === 'doctor'
                          ? t.auth.doctorOtpSent
                          : t.auth.otpSent}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
                    >
                      <ArrowLeft className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                      <span>{role === 'doctor' ? t.auth.changeHpId : t.auth.changeAbha}</span>
                    </button>
                  </div>
                  {maskedPhone && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {t.auth.sentToMobile} <span className="font-semibold text-slate-800 dark:text-slate-100">{maskedPhone}</span>
                    </p>
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
                    placeholder="••••••"
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
                      <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" aria-hidden="true" />
                      <span>{t.auth.verifying}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span>{t.auth.verifyAndEnter}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── Direct Role-Specific Registration Card ── */}
            <div className="pt-3 border-t border-surface-border dark:border-slate-800">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-cyan/5 via-cyan-500/5 to-teal-500/10 border border-brand-cyan/20 dark:border-cyan-800/40 text-center space-y-2.5">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {role === 'doctor'
                      ? t.auth.registerDoctorPrompt
                      : t.auth.registerPatientPrompt}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {role === 'doctor'
                      ? t.auth.registerDoctorDesc
                      : t.auth.registerPatientDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (role === 'doctor') {
                      setIsDoctorRegisterOpen(true)
                    } else {
                      setIsPatientRegisterOpen(true)
                    }
                  }}
                  className="w-full py-2.5 px-3 text-xs font-bold text-brand-cyan dark:text-cyan-300 bg-white dark:bg-slate-800 hover:bg-brand-cyan/10 dark:hover:bg-cyan-900/40 border border-brand-cyan/30 dark:border-cyan-700/60 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>
                    {role === 'doctor'
                      ? t.auth.registerDoctorButton
                      : t.auth.registerPatientButton}
                  </span>
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

      {/* Citizen Registration Modal */}
      <PatientRegisterModal
        isOpen={isPatientRegisterOpen}
        onClose={() => setIsPatientRegisterOpen(false)}
        onSuccessLogin={(patient) => {
          onLoginSuccess(patient)
        }}
        onPrefillLogin={(prefillAbha) => {
          setRole('patient')
          setIdInput(prefillAbha)
          setError(null)
          setOtpSent(false)
          setOtp('')
        }}
      />

      {/* Clinician Registration Modal (Zero mention of ABHA) */}
      <DoctorRegisterModal
        isOpen={isDoctorRegisterOpen}
        onClose={() => setIsDoctorRegisterOpen(false)}
        onSuccessLogin={(doctor) => {
          onLoginSuccess(doctor)
        }}
        onPrefillLogin={(prefillHpId) => {
          setRole('doctor')
          setIdInput(prefillHpId)
          setError(null)
          setOtpSent(false)
          setOtp('')
        }}
      />
    </div>
  )
}

