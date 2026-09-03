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
import type { User, UserType } from '../../types'
import { requestOtp, verifyOtp, extractErrorMessage } from '../../services/api'
import BrandLogo from '../BrandLogo'
import RegisterModal from './RegisterModal'

interface LoginPageProps {
  onLoginSuccess: (user: User) => void
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
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
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40 flex flex-col justify-between">
      {/* ── Top Bar ── */}
      <header className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              Sanjivani <span className="text-brand-cyan">संजीवनी</span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Ministry of Ayush • National Health Authority
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-cyan bg-brand-cyan/10 hover:bg-brand-cyan/20 rounded-xl transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>
      </header>

      {/* ── Center Login Card ── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-surface-border overflow-hidden animate-fade-in">
          {/* Card Header */}
          <div className="p-6 pb-5 text-center border-b border-surface-border bg-slate-50/50">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-brand-cyan/10 text-brand-cyan mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Sign In with ABHA
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Ayushman Bharat Health Account &amp; OTP Authentication
            </p>

            {/* Role Switcher */}
            <div className="mt-5 flex rounded-2xl bg-slate-200/70 p-1">
              <button
                type="button"
                onClick={() => handleRoleChange('patient')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  role === 'patient'
                    ? 'bg-white text-brand-cyan shadow-sm scale-[1.01]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Patient (मरीज़)</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('doctor')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  role === 'doctor'
                    ? 'bg-white text-emerald-600 shadow-sm scale-[1.01]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>Doctor (चिकित्सक)</span>
              </button>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span className="flex-1 font-medium">{error}</span>
              </div>
            )}

            {!otpSent ? (
              // ── Step 1: ABHA Form ──
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {role === 'patient' ? 'Patient ABHA ID / Health Card Number' : 'Doctor ABHA ID / Practitioner Number'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 14-1234-5678-9012"
                      value={abhaId}
                      onChange={(e) => setAbhaId(e.target.value)}
                      className="w-full px-3.5 py-3 text-sm font-medium rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 tracking-wide text-slate-800"
                    />
                    <KeyRound className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Standard 14-digit national identity format
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
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Request ABHA OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              // ── Step 2: OTP Verification ──
              <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
                <div className="p-3 bg-brand-cyan-light/30 rounded-2xl border border-brand-cyan/20">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-brand-cyan">
                      {userName ? `Welcome, ${userName}` : 'OTP Dispatched'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                    >
                      Change ABHA
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Sent to registered mobile <span className="font-semibold text-slate-800">{maskedPhone}</span>
                  </p>
                  {simulatedOtp && (
                    <div
                      onClick={() => setOtp(simulatedOtp)}
                      className="mt-2.5 px-2.5 py-1.5 bg-white rounded-lg border border-brand-cyan/30 flex items-center justify-between cursor-pointer hover:bg-brand-cyan/5 transition-colors"
                      title="Click to auto-fill"
                    >
                      <span className="text-[11px] font-medium text-slate-600">
                        Demo Sandbox Code:
                      </span>
                      <span className="text-xs font-mono font-bold text-brand-cyan tracking-wider">
                        {simulatedOtp} (Click to Fill)
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Enter 6-Digit OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg px-3 py-2.5 rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 text-slate-900"
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
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify &amp; Enter Portal</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── 1-Click Demo Sandbox Fast Logins ── */}
            <div className="pt-4 border-t border-surface-border space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>One-Click Test Accounts</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAutofillDemo('patient')}
                  className="p-2.5 text-left rounded-xl border border-surface-border hover:border-brand-cyan/40 bg-slate-50 hover:bg-brand-cyan-light/20 transition-all group"
                >
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-brand-cyan" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-brand-cyan">
                      Demo Patient
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Ramesh Sharma (38y)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleAutofillDemo('doctor')}
                  className="p-2.5 text-left rounded-xl border border-surface-border hover:border-emerald-500/40 bg-slate-50 hover:bg-emerald-50 transition-all group"
                >
                  <div className="flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                      Demo Doctor
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Dr. Priya Nair (MD)
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="py-4 text-center text-xs text-slate-400">
        Sanjivani Clinical AI • Built for Indian Healthcare Facilities &amp; AYUSH Centers
      </footer>

      {/* Register Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialRole={role}
      />
    </div>
  )
}
