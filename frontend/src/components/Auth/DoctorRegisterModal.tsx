import { useState } from 'react'
import {
  X,
  Stethoscope,
  Sparkles,
  RefreshCw,
  QrCode,
  ArrowRight,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  BadgeCheck,
  LogIn,
  GraduationCap,
  FileCheck,
} from 'lucide-react'
import type { Doctor } from '../../types'
import { registerDoctor, extractErrorMessage } from '../../services/api'

interface DoctorRegisterModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccessLogin?: (doctor: Doctor, token?: string) => void
  onPrefillLogin?: (hpId: string) => void
}

function generateRandomHpId(): string {
  const state = ['MH', 'DL', 'KA', 'TN', 'UP', 'GJ', 'RJ', 'WB'][Math.floor(Math.random() * 8)]
  const num = Math.floor(10000 + Math.random() * 90000)
  return `HP-${state}-${num}`
}

export default function DoctorRegisterModal({
  isOpen,
  onClose,
  onSuccessLogin,
  onPrefillLogin,
}: DoctorRegisterModalProps) {
  const [name, setName] = useState('')
  const [hpId, setHpId] = useState(() => generateRandomHpId())
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('Male')
  const [ageYears, setAgeYears] = useState('')

  // Doctor clinical credentials
  const [specialization, setSpecialization] = useState('')
  const [licenseNo, setLicenseNo] = useState('')
  const [hospital, setHospital] = useState('')
  const [department, setDepartment] = useState('')
  const [qualifications, setQualifications] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registeredDoctor, setRegisteredDoctor] = useState<Doctor | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  if (!isOpen) return null

  const handleGenerateHpId = () => {
    setHpId(generateRandomHpId())
    setError(null)
  }

  const handleReset = () => {
    setRegisteredDoctor(null)
    setSessionToken(null)
    setError(null)
    setLoading(false)
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanHpId = hpId.trim()
    if (!cleanHpId) {
      setError('Please provide a valid HP ID (Health Professional ID).')
      return
    }

    setLoading(true)

    try {
      const generatedLicense = licenseNo.trim() || `HP-REG-${cleanHpId.replace(/-/g, '').slice(-6).toUpperCase()}`
      const generatedEmail = email.trim() || `${cleanHpId.toLowerCase().replace(/[^a-z0-9]/g, '')}@hp.gov.in`

      const payload = {
        name: name.trim(),
        hp_id: cleanHpId,
        phone: phone.trim() || '9876543210',
        email: generatedEmail,
        gender,
        age_years: parseInt(ageYears, 10) || 38,
        specialization: specialization.trim(),
        license_no: generatedLicense,
        hospital: hospital.trim(),
        department: department.trim(),
        qualifications: qualifications.trim(),
      }

      const res = await registerDoctor(payload)
      const docUser = res.user as Doctor

      setRegisteredDoctor(docUser)
      setSessionToken(res.token || null)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto transition-colors">
        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b border-surface-border dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {registeredDoctor ? 'Healthcare Professional Registry (HPR) Card Issued' : 'Register New Ayush Clinician'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                National Healthcare Professional Registry (HPR) • Ayush Grid
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Body ── */}
        {registeredDoctor ? (
          // ── SUCCESS VIEW: Doctor HP ID Digital Credential Card ──
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-1 ring-1 ring-emerald-500/20">
                <BadgeCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Clinician Registration Verified
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Your credentials have been securely verified and enrolled into the National Healthcare Professional Registry (HPR).
              </p>
            </div>

            {/* Doctor HP ID Digital Card */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 p-5 sm:p-6 text-white shadow-xl">
              {/* Top Banner */}
              <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-black text-xs">
                    🇮🇳
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">
                      National Health Authority • Ayush Grid
                    </p>
                    <p className="text-xs font-black tracking-tight text-white">
                      Healthcare Professional Registry (HPR)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                  Verified Clinician
                </span>
              </div>

              {/* Card Body */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/30 flex flex-col items-center justify-center text-white flex-shrink-0 shadow-inner">
                  <Stethoscope className="w-10 h-10 text-emerald-300" />
                  <span className="text-[9px] font-medium text-emerald-100 mt-1">Verified</span>
                </div>

                {/* Details */}
                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {registeredDoctor.name}
                    </h4>
                    <p className="text-xs text-emerald-200 font-medium">
                      {registeredDoctor.specialization || 'Ayush Medical Practitioner'} • {registeredDoctor.qualifications || 'BAMS, MD'}
                    </p>
                  </div>

                  <div className="pt-1">
                    <p className="text-[10px] uppercase text-emerald-200/80 font-bold tracking-wider">
                      HP ID (Healthcare Professional ID)
                    </p>
                    <p className="text-lg font-mono font-black tracking-widest text-amber-300 drop-shadow-sm">
                      {registeredDoctor.hp_id}
                    </p>
                  </div>

                  {registeredDoctor.hospital && (
                    <p className="text-[11px] text-emerald-100/90 truncate">
                      {registeredDoctor.hospital}
                    </p>
                  )}
                  {registeredDoctor.license_no && (
                    <p className="text-[10px] text-emerald-200/80 font-mono">
                      License: {registeredDoctor.license_no}
                    </p>
                  )}
                </div>

                {/* QR Code Graphic Simulation */}
                <div className="hidden sm:flex flex-col items-center justify-center bg-white p-2 rounded-xl text-slate-900 shadow-md flex-shrink-0">
                  <QrCode className="w-14 h-14" />
                  <span className="text-[8px] font-mono font-bold mt-1 text-slate-600">Scan for HPR</span>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-emerald-200">
                <span>HPR Registry Compliant • 256-bit Encrypted</span>
                <span>Active Status: On Duty</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3 pt-2">
              {onSuccessLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onSuccessLogin(registeredDoctor, sessionToken || undefined)
                    handleClose()
                  }}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Enter Doctor Clinical Portal Immediately</span>
                </button>
              )}

              {onPrefillLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onPrefillLogin(registeredDoctor.hp_id)
                    handleClose()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm rounded-xl transition-colors"
                >
                  <span>Sign In with OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          // ── REGISTRATION FORM VIEW ──
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
            {/* Error Banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div className="flex-1">
                  <p className="font-semibold">{error}</p>
                  {error.includes('already exists') && (
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateHpId}
                        className="text-[11px] underline font-bold text-rose-700 dark:text-rose-300 hover:opacity-80"
                      >
                        Generate Different HP ID
                      </button>
                      {onPrefillLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            onPrefillLogin(hpId)
                            handleClose()
                          }}
                          className="text-[11px] underline font-bold text-emerald-600 hover:opacity-80 ml-2"
                        >
                          Sign In with this HP ID
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Basic Info Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Doctor Identity Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Doctor Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Harish Chandra Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* HP ID with Auto-generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      HP ID (Health Professional ID) *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateHpId}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Generate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HP-MH-84729"
                    value={hpId}
                    onChange={(e) => setHpId(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Format: HP-[State]-[Number] (e.g. HP-MH-84729)
                  </p>
                </div>
              </div>

              {/* Phone and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile Number (for OTP SMS verification)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="e.g. 9876543299"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Professional Email
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      placeholder="doctor@hp.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Gender and Age */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    min="24"
                    max="90"
                    value={ageYears}
                    onChange={(e) => setAgeYears(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Clinical & Institutional Credentials */}
            <div className="space-y-3 pt-2 border-t border-surface-border dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Clinical Credentials & Affiliation</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Medical Specialization *
                  </label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="Kayachikitsa (Ayurvedic Internal Medicine)">Kayachikitsa (Ayurvedic Internal Medicine)</option>
                    <option value="Panchakarma (Detoxification & Rejuvenation)">Panchakarma (Detoxification & Rejuvenation)</option>
                    <option value="Shalya Tantra (Surgical & Para-surgical)">Shalya Tantra (Surgical & Para-surgical)</option>
                    <option value="Prasuti & Stri Roga (Gynecology)">Prasuti & Stri Roga (Gynecology)</option>
                    <option value="Kaumarbhritya (Pediatrics)">Kaumarbhritya (Pediatrics)</option>
                    <option value="General Integrative AYUSH Practice">General Integrative AYUSH Practice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Medical Registration / License No.
                  </label>
                  <div className="relative">
                    <FileCheck className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. AYUSH-MH-2024-8841"
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 font-mono text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Hospital / Healthcare Facility
                  </label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. All India Institute of Ayurveda"
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Degrees / Qualifications
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BAMS, MD (Ayurveda)"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Enrolling in Healthcare Professional Registry...</span>
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4" />
                    <span>Issue Verified HP ID & Enroll Clinician</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
                Enrolled under National Healthcare Professional Registry (HPR) • Ayush Grid
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
