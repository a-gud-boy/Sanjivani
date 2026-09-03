import { useState } from 'react'
import { X, User, Stethoscope, CheckCircle2, ShieldCheck } from 'lucide-react'
import type { UserType } from '../../types'
import { registerUser } from '../../services/api'

interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  initialRole?: UserType
}

export default function RegisterModal({
  isOpen,
  onClose,
  initialRole = 'patient',
}: RegisterModalProps) {
  const [role, setRole] = useState<UserType>(initialRole)
  const [name, setName] = useState('')
  const [abhaId, setAbhaId] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('Male')
  const [ageYears, setAgeYears] = useState('35')
  const [specialization, setSpecialization] = useState('Ayurvedic Medicine')
  const [licenseNo, setLicenseNo] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await registerUser({
        user_type: role,
        name: name || (role === 'patient' ? 'New Patient' : 'Dr. New Clinician'),
        abha_id: abhaId || (role === 'patient' ? '14-5555-6666-7777' : '14-8888-9999-0000'),
        phone,
        gender,
        age_years: parseInt(ageYears, 10) || 30,
        specialization: role === 'doctor' ? specialization : undefined,
        license_no: role === 'doctor' ? licenseNo : undefined,
      })
      setMessage(res.message)
      setSubmitted(true)
    } catch {
      setMessage('Registration noted. Kiosk KYC simulation active.')
      setSubmitted(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-cyan/10 flex items-center justify-center text-brand-cyan">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Register New {role === 'patient' ? 'Patient' : 'Doctor'}
              </h2>
              <p className="text-[11px] text-slate-500">ABHA National Health Identity Enrollment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Registration Recorded</h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
              {message}
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSubmitted(false)
                  onClose()
                }}
                className="btn-primary px-6 py-2.5 text-sm font-semibold rounded-xl"
              >
                Back to Login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Role switch */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setRole('patient')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  role === 'patient'
                    ? 'bg-white text-brand-cyan shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Patient (मरीज़)
              </button>
              <button
                type="button"
                onClick={() => setRole('doctor')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  role === 'doctor'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                Doctor (चिकित्सक)
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name {role === 'doctor' ? '(with Dr. prefix)' : ''}
                </label>
                <input
                  type="text"
                  required
                  placeholder={role === 'patient' ? 'e.g. Suresh Kumar' : 'e.g. Dr. Rajesh Verma'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Desired ABHA ID (14 Digits)
                </label>
                <input
                  type="text"
                  required
                  placeholder="14-XXXX-XXXX-XXXX"
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                {role === 'patient' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Age &amp; Gender
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Age"
                        value={ageYears}
                        onChange={(e) => setAgeYears(e.target.value)}
                        className="w-16 px-2 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted text-center"
                      />
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="flex-1 px-2 py-2 text-xs rounded-xl border border-surface-border bg-surface-muted"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Medical License No.
                    </label>
                    <input
                      type="text"
                      placeholder="AYUSH-REG-2024"
                      value={licenseNo}
                      onChange={(e) => setLicenseNo(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted"
                    />
                  </div>
                )}
              </div>

              {role === 'doctor' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clinical Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Panchakarma &amp; Internal Medicine (BAMS, MD)"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted"
                  />
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Note:</span> Live national ABHA registration requires active NHA sandbox certificates. For testing, please use the pre-seeded demo accounts on the login screen.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary px-5 py-2 text-xs font-semibold rounded-xl"
              >
                Submit Registration
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
