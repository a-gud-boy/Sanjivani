import { useState } from 'react'
import {
  X,
  User as UserIcon,
  Stethoscope,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  QrCode,
  ArrowRight,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  HeartPulse,
  BadgeCheck,
  LogIn,
} from 'lucide-react'
import type { User, UserType } from '../../types'
import { registerUser, extractErrorMessage } from '../../services/api'

interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  initialRole?: UserType
  onSuccessLogin?: (user: User, token?: string) => void
  onPrefillLogin?: (abhaId: string, role: UserType) => void
}

function generateRandomAbha(): string {
  const p1 = Math.floor(1000 + Math.random() * 9000)
  const p2 = Math.floor(1000 + Math.random() * 9000)
  const p3 = Math.floor(1000 + Math.random() * 9000)
  return `14-${p1}-${p2}-${p3}`
}

export default function RegisterModal({
  isOpen,
  onClose,
  initialRole = 'patient',
  onSuccessLogin,
  onPrefillLogin,
}: RegisterModalProps) {
  const [role, setRole] = useState<UserType>(initialRole)
  const [name, setName] = useState('')
  const [abhaId, setAbhaId] = useState(() => generateRandomAbha())
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('Male')
  const [ageYears, setAgeYears] = useState('32')
  const [dob, setDob] = useState('1994-05-15')

  // Patient fields
  const [bloodGroup, setBloodGroup] = useState('B+')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('New Delhi')
  const [state, setState] = useState('Delhi')
  const [pincode, setPincode] = useState('110001')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('Spouse')

  // Doctor fields
  const [specialization, setSpecialization] = useState('Kayachikitsa (Ayurvedic Internal Medicine)')
  const [licenseNo, setLicenseNo] = useState('')
  const [hospital, setHospital] = useState('All India Institute of Ayurveda (AIIA)')
  const [department, setDepartment] = useState('Kayachikitsa OPD')
  const [qualifications, setQualifications] = useState('BAMS, MD (Ayurveda)')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registeredUser, setRegisteredUser] = useState<User | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  if (!isOpen) return null

  const handleGenerateAbha = () => {
    setAbhaId(generateRandomAbha())
    setError(null)
  }

  const handleReset = () => {
    setRegisteredUser(null)
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

    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }

    if (!abhaId.trim()) {
      setError('Please provide or generate a 14-digit ABHA ID.')
      return
    }

    setLoading(true)

    try {
      const res = await registerUser({
        user_type: role,
        name: name.trim(),
        abha_id: abhaId.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gender,
        age_years: parseInt(ageYears, 10) || 30,
        dob: dob || undefined,
        blood_group: role === 'patient' ? bloodGroup : undefined,
        address_line: role === 'patient' ? addressLine.trim() || undefined : undefined,
        city: role === 'patient' ? city.trim() || undefined : undefined,
        state: role === 'patient' ? state.trim() || undefined : undefined,
        pincode: role === 'patient' ? pincode.trim() || undefined : undefined,
        emergency_contact_name: role === 'patient' ? emergencyName.trim() || undefined : undefined,
        emergency_contact_phone: role === 'patient' ? emergencyPhone.trim() || undefined : undefined,
        emergency_contact_relation: role === 'patient' ? emergencyRelation.trim() || undefined : undefined,
        specialization: role === 'doctor' ? specialization.trim() || undefined : undefined,
        license_no: role === 'doctor' ? (licenseNo.trim() || `AYUSH-REG-${abhaId.replace(/-/g, '').slice(-6)}`) : undefined,
        hospital: role === 'doctor' ? hospital.trim() || undefined : undefined,
        department: role === 'doctor' ? department.trim() || undefined : undefined,
        qualifications: role === 'doctor' ? qualifications.trim() || undefined : undefined,
      })

      if (res.user) {
        setRegisteredUser(res.user)
        if (res.token) {
          setSessionToken(res.token)
        }
      }
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-surface-border dark:border-slate-800 overflow-hidden my-auto transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-cyan/10 dark:bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {registeredUser ? 'ABHA Health Card Issued' : `Register New ${role === 'patient' ? 'Patient' : 'Ayush Clinician'}`}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ayushman Bharat Digital Mission (ABDM) • Ayush Grid
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {registeredUser ? (
          /* SUCCESS VIEW: Digital ABHA Card */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 text-xs font-bold mb-1">
                <BadgeCheck className="w-4 h-4" />
                <span>Identity Successfully Created in Supabase Health Registry</span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Welcome to Sanjivani, {registeredUser.name}!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Your digital ABHA record is now live and linked with India's Ayush Grid. You can log in immediately or sign in using simulated OTP.
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
                  {registeredUser.user_type === 'doctor' ? 'Clinician' : 'Citizen'}
                </span>
              </div>

              {/* Card Body */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/30 flex flex-col items-center justify-center text-white flex-shrink-0 shadow-inner">
                  {registeredUser.user_type === 'doctor' ? (
                    <Stethoscope className="w-10 h-10 text-cyan-300" />
                  ) : (
                    <UserIcon className="w-10 h-10 text-cyan-300" />
                  )}
                  <span className="text-[9px] font-medium text-cyan-100 mt-1">Verified</span>
                </div>

                {/* Details */}
                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-white tracking-wide">
                      {registeredUser.name}
                    </h4>
                    <p className="text-xs text-cyan-200 font-medium">
                      {registeredUser.user_type === 'doctor'
                        ? (registeredUser.doctor_details?.specialization || 'Ayush Medical Practitioner')
                        : `Blood Group: ${registeredUser.patient_details?.blood_group || 'O+'} • ${registeredUser.gender || 'Male'}, ${registeredUser.age_years || 30} yrs`}
                    </p>
                  </div>

                  <div className="pt-1">
                    <p className="text-[10px] uppercase text-cyan-200/80 font-bold tracking-wider">
                      ABHA Number
                    </p>
                    <p className="text-lg font-mono font-black tracking-widest text-amber-300 drop-shadow-sm">
                      {registeredUser.abha_id}
                    </p>
                  </div>

                  {registeredUser.user_type === 'doctor' && registeredUser.doctor_details?.hospital && (
                    <p className="text-[11px] text-cyan-100/90 truncate">
                      {registeredUser.doctor_details.hospital}
                    </p>
                  )}
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

            {/* Next Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {onSuccessLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onSuccessLogin(registeredUser, sessionToken || undefined)
                    handleClose()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-cyan hover:bg-cyan-600 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In Immediately</span>
                </button>
              )}

              {onPrefillLogin && (
                <button
                  type="button"
                  onClick={() => {
                    onPrefillLogin(registeredUser.abha_id, role)
                    handleClose()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm rounded-xl transition-colors"
                >
                  <span>Login with OTP (123456)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Role switch */}
            <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => {
                  setRole('patient')
                  setError(null)
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  role === 'patient'
                    ? 'bg-white dark:bg-slate-700 text-brand-cyan shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Patient Registration (मरीज़)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('doctor')
                  setError(null)
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  role === 'doctor'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>Ayush Doctor / Clinician (चिकित्सक)</span>
              </button>
            </div>

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
                        onClick={handleGenerateAbha}
                        className="text-[11px] underline font-bold text-rose-700 dark:text-rose-300 hover:opacity-80"
                      >
                        Generate Different ABHA
                      </button>
                      {onPrefillLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            onPrefillLogin(abhaId, role)
                            handleClose()
                          }}
                          className="text-[11px] underline font-bold text-brand-cyan hover:opacity-80 ml-2"
                        >
                          Sign In with this ABHA
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
                    placeholder={role === 'patient' ? 'e.g. Anand Mahindra' : 'e.g. Dr. Harish Chandra'}
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
                      <Sparkles className="w-3 h-3" />
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
                    Mobile Number (for simulated OTP)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="9876543210"
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

              {/* Age, Gender & DOB */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
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
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
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
                    className="w-full px-2 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
              </div>
            </div>

            {/* ROLE-SPECIFIC FIELDS */}
            {role === 'patient' ? (
              /* Patient Demographics & Emergency Contact */
              <div className="space-y-3 pt-2 border-t border-surface-border dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>Clinical &amp; Emergency Demographics</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Blood Group
                    </label>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full px-2 py-2 text-xs font-bold rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                    >
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-surface-border dark:border-slate-800 space-y-2">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Emergency Contact (Optional)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-surface-border dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                      type="tel"
                      placeholder="Contact Phone"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-surface-border dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Relation (e.g. Spouse/Parent)"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-surface-border dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Doctor Credentials */
              <div className="space-y-3 pt-2 border-t border-surface-border dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Medical Council &amp; Hospital Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Ayush Medical License No.
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AYUSH-REG-84729"
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Qualifications / Degree
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BAMS, MD (Ayurveda)"
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Kayachikitsa / Panchakarma"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hospital / Institution
                    </label>
                    <input
                      type="text"
                      value={hospital}
                      onChange={(e) => setHospital(e.target.value)}
                      placeholder="e.g. All India Institute of Ayurveda"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Department / Ward
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Kayachikitsa OPD"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Note banner */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Persistent Cloud Sync:</strong> Newly created profiles are saved directly to your Supabase PostgreSQL database and can immediately be used for OTP login or instant session startup.
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary px-6 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating ABHA ID...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Enrollment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
