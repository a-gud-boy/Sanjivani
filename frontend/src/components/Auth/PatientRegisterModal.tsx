import { useState } from 'react'
import {
  X,
  User as UserIcon,
  Sparkles,
  RefreshCw,
  QrCode,
  ArrowRight,
  AlertCircle,
  Phone,
  Mail,
  HeartPulse,
  BadgeCheck,
  LogIn,
} from 'lucide-react'
import type { Patient } from '../../types'
import { registerPatient, extractErrorMessage } from '../../services/api'

interface PatientRegisterModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccessLogin?: (patient: Patient, token?: string) => void
  onPrefillLogin?: (abhaId: string) => void
}

function generateRandomAbha(): string {
  const p1 = Math.floor(1000 + Math.random() * 9000)
  const p2 = Math.floor(1000 + Math.random() * 9000)
  const p3 = Math.floor(1000 + Math.random() * 9000)
  return `14-${p1}-${p2}-${p3}`
}

export default function PatientRegisterModal({
  isOpen,
  onClose,
  onSuccessLogin,
  onPrefillLogin,
}: PatientRegisterModalProps) {
  const [name, setName] = useState('')
  const [abhaId, setAbhaId] = useState(() => generateRandomAbha())
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('Male')
  const [ageYears, setAgeYears] = useState('')
  const [dob, setDob] = useState('')

  // Patient fields
  const [bloodGroup, setBloodGroup] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registeredPatient, setRegisteredPatient] = useState<Patient | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  if (!isOpen) return null

  const handleGenerateAbha = () => {
    setAbhaId(generateRandomAbha())
    setError(null)
  }

  const handleReset = () => {
    setRegisteredPatient(null)
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

    const cleanAbhaId = abhaId.trim()
    if (!cleanAbhaId) {
      setError('Please provide a valid 14-digit ABHA ID.')
      return
    }

    setLoading(true)

    try {
      const generatedEmail = email.trim() || `${cleanAbhaId.replace(/[^0-9]/g, '')}@abha.gov.in`

      const payload = {
        name: name.trim(),
        abha_id: cleanAbhaId,
        phone: phone.trim() || '9876543210',
        email: generatedEmail,
        gender,
        age_years: parseInt(ageYears, 10) || 30,
        dob,
        blood_group: bloodGroup,
        address_line: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        pincode: pincode.trim() || undefined,
        emergency_contact_name: emergencyName.trim() || undefined,
        emergency_contact_phone: emergencyPhone.trim() || undefined,
        emergency_contact_relation: emergencyRelation || undefined,
      }

      const res = await registerPatient(payload)
      const patientUser = res.user as Patient

      setRegisteredPatient(patientUser)
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
            <div className="w-9 h-9 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center font-bold">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {registeredPatient ? 'ABHA Health Card Issued' : 'Register New Citizen Patient'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ayushman Bharat Digital Mission (ABDM) • National Health Authority
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close patient registration"
          >
            <X className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          </button>
        </div>

        {/* ── Modal Body ── */}
        {registeredPatient ? (
          // ── SUCCESS VIEW: Patient ABHA Health Card ──
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mb-1 ring-1 ring-emerald-500/20">
                <BadgeCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Registration Successful
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Your Ayushman Bharat Digital Health Account has been initialized and registered in the National Health Database.
              </p>
            </div>

            {/* ABHA Digital Card */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-brand-cyan/40 bg-gradient-to-br from-teal-600 via-cyan-700 to-slate-900 p-5 sm:p-6 text-white shadow-xl">
              {/* Top Banner */}
              <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-black text-xs">
                    🇮🇳
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-cyan-200">
                      National Health Authority • Ayush Grid
                    </p>
                    <p className="text-xs font-black tracking-tight text-white">
                      Digital ABHA Health ID Card
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                  Citizen
                </span>
              </div>

              {/* Card Body */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/30 flex flex-col items-center justify-center text-white flex-shrink-0 shadow-inner">
                  <UserIcon className="w-10 h-10 text-cyan-300" />
                  <span className="text-[9px] font-medium text-cyan-100 mt-1">Verified</span>
                </div>

                {/* Details */}
                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {registeredPatient.name}
                    </h4>
                    <p className="text-xs text-cyan-200 font-medium">
                      Blood Group: {registeredPatient.patient_details?.blood_group || 'O+'} • {registeredPatient.gender || 'Male'}, {registeredPatient.age_years || 30} yrs
                    </p>
                  </div>

                  <div className="pt-1">
                    <p className="text-[10px] uppercase text-cyan-200/80 font-bold tracking-wider">
                      ABHA Number
                    </p>
                    <p className="text-lg font-mono font-black tracking-widest text-amber-300 drop-shadow-sm">
                      {registeredPatient.abha_id}
                    </p>
                  </div>
                </div>

                {/* QR Code Graphic Simulation */}
                <div className="hidden sm:flex flex-col items-center justify-center bg-white p-2 rounded-xl text-slate-900 shadow-md flex-shrink-0">
                  <QrCode className="w-14 h-14" />
                  <span className="text-[8px] font-mono font-bold mt-1 text-slate-600">Scan at Kiosk</span>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-cyan-200">
                <span>ABDM Compliant • 256-bit Encrypted</span>
                <span>Active Status: Enrolled</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3 pt-2">
              {onSuccessLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onSuccessLogin(registeredPatient, sessionToken || undefined)
                    handleClose()
                  }}
                  className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/20"
                >
                  <LogIn className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span>Enter Patient Dashboard Immediately</span>
                </button>
              )}

              {onPrefillLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onPrefillLogin(registeredPatient.abha_id)
                    handleClose()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm rounded-xl transition-colors"
                >
                  <span>Sign In with OTP</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
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
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleGenerateAbha}
                        className="inline-flex items-center gap-1 text-[11px] underline font-bold text-rose-700 dark:text-rose-300 hover:opacity-80"
                      >
                        <RefreshCw className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                        <span>Generate Different ABHA</span>
                      </button>
                      {onPrefillLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            onPrefillLogin(abhaId)
                            handleClose()
                          }}
                          className="inline-flex items-center gap-1 text-[11px] underline font-bold text-brand-cyan hover:opacity-80 ml-2"
                        >
                          <LogIn className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                          <span>Sign In with this ABHA</span>
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
                <UserIcon className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Primary Identity Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anand Mahindra"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>

                {/* ABHA ID with Auto-generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      14-digit ABHA ID *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAbha}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-cyan hover:text-cyan-700 dark:hover:text-cyan-300"
                    >
                      <Sparkles className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                      <span>Auto-Generate</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="14-XXXX-XXXX-XXXX"
                    value={abhaId}
                    onChange={(e) => setAbhaId(e.target.value)}
                    className="w-full px-3 py-2 font-mono text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20 font-bold"
                  />
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
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      placeholder="citizen@abha.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                    />
                  </div>
                </div>
              </div>

              {/* Gender, Age, DOB, and Blood Group */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
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
                    min="1"
                    max="120"
                    value={ageYears}
                    onChange={(e) => setAgeYears(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Address & Emergency Section */}
            <div className="space-y-3 pt-2 border-t border-surface-border dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                <span>Address & Emergency Contact</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flat 101, Green Valley Apts"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Suman Sharma"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543211"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Relation
                  </label>
                  <select
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Friend">Friend</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/20 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" aria-hidden="true" />
                    <span>Issuing Digital ABHA Health Card...</span>
                  </>
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span>Generate & Issue Digital ABHA Card</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
                Conforms to National Health Authority (NHA) & ABDM Standards
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
