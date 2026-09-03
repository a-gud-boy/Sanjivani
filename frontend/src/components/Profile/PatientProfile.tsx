import { useState } from 'react'
import {
  User as UserIcon,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  Flame,
  Droplet,
  ShieldCheck,
  Briefcase,
  Users,
  Loader2,
} from 'lucide-react'
import type { User } from '../../types'
import { updatePatientProfile, extractErrorMessage } from '../../services/api'
import BrandLogo from '../BrandLogo'

interface PatientProfileProps {
  patient: User
  onSave: (updatedUser: User) => void
  onBackToDashboard: () => void
}

export default function PatientProfile({
  patient,
  onSave,
  onBackToDashboard,
}: PatientProfileProps) {
  const details = patient.patient_details || {}
  const emergency = (details.emergency_contact as { name?: string; relation?: string; phone?: string }) || {}

  // ── Form State ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(patient.name || '')
  const [ageYears, setAgeYears] = useState(String(patient.age_years || 38))
  const [gender, setGender] = useState(patient.gender || 'Male')
  const [phone, setPhone] = useState(patient.phone || '')
  const [email, setEmail] = useState(patient.email || '')

  // Personal details inside JSON
  const [dob, setDob] = useState(details.dob ? String(details.dob) : '')
  const [addressLine, setAddressLine] = useState(
    details.address_line || details.address ? String(details.address_line || details.address) : ''
  )
  const [city, setCity] = useState(details.city ? String(details.city) : '')
  const [state, setState] = useState(details.state ? String(details.state) : '')
  const [pincode, setPincode] = useState(details.pincode ? String(details.pincode) : '')
  const [occupation, setOccupation] = useState(details.occupation ? String(details.occupation) : '')
  const [maritalStatus, setMaritalStatus] = useState(details.marital_status ? String(details.marital_status) : 'Married')
  const [bloodGroup, setBloodGroup] = useState(details.blood_group ? String(details.blood_group) : 'B+')
  const [prakriti, setPrakriti] = useState(details.ayush_prakriti ? String(details.ayush_prakriti) : '')

  // Emergency contact
  const [emergencyName, setEmergencyName] = useState(emergency.name || '')
  const [emergencyRelation, setEmergencyRelation] = useState(emergency.relation || '')
  const [emergencyPhone, setEmergencyPhone] = useState(emergency.phone || '')

  // Allergies & Chronic (comma separated)
  const initialAllergies = Array.isArray(details.allergies) ? details.allergies.join(', ') : ''
  const initialChronic = Array.isArray(details.chronic_conditions)
    ? details.chronic_conditions.join(', ')
    : ''

  const [allergiesText, setAllergiesText] = useState(initialAllergies)
  const [chronicText, setChronicText] = useState(initialChronic)

  // Status
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── Handle Save ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMessage(null)
    setSaveSuccess(false)

    try {
      const parsedAllergies = allergiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const parsedChronic = chronicText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const updatedDetailsPayload = {
        ...details,
        dob,
        address_line: addressLine,
        city,
        state,
        pincode,
        occupation,
        marital_status: maritalStatus,
        blood_group: bloodGroup,
        ayush_prakriti: prakriti,
        allergies: parsedAllergies,
        chronic_conditions: parsedChronic,
        emergency_contact: {
          name: emergencyName,
          relation: emergencyRelation,
          phone: emergencyPhone,
        },
      }

      const res = await updatePatientProfile({
        patient_id: patient.id,
        name: name.trim(),
        gender,
        age_years: parseInt(ageYears, 10) || 38,
        phone: phone.trim(),
        email: email.trim(),
        patient_details: updatedDetailsPayload,
      })

      onSave(res.patient)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      setErrorMessage(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-surface-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-border bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <BrandLogo size="sm" />
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Patient Profile &amp; Demographics
              </h1>
              <p className="text-[11px] text-slate-500">
                Personal details &amp; Ayush health identity
              </p>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Main Form Area ── */}
      <main className="flex-1 max-w-5xl mx-auto p-4 sm:p-6 w-full space-y-6 animate-fade-in">
        {/* Feedback alerts */}
        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Profile details saved successfully to database!</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── ABHA Health Identity Card ── */}
        <div className="bg-gradient-to-r from-cyan-900 via-teal-800 to-emerald-900 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-xl font-black">
              {name.charAt(0) || 'P'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">{name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-cyan-100 border border-white/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-300" />
                  ABHA Verified
                </span>
              </div>
              <p className="text-xs text-cyan-200 font-mono tracking-wider">
                ABHA ID: {patient.abha_id}
              </p>
            </div>
          </div>

          <div className="text-xs text-cyan-100/90 sm:text-right space-y-0.5 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
            <p>Role: <span className="font-semibold text-white">Registered Patient</span></p>
            <p>Linked Mobile: <span className="font-semibold text-white">{phone}</span></p>
          </div>
        </div>

        {/* ── Profile Edit Form ── */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Identity */}
          <div className="bg-white rounded-3xl border border-surface-border shadow-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-surface-border">
              <UserIcon className="w-4 h-4 text-brand-cyan" />
              <span>1. Basic Personal Identity</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  required
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Marital Status
                </label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="Married">Married</option>
                  <option value="Single">Single</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Occupation
                </label>
                <input
                  type="text"
                  placeholder="e.g. School Teacher"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Details & Address */}
          <div className="bg-white rounded-3xl border border-surface-border shadow-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-surface-border">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>2. Contact Details &amp; Residential Address</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Mobile Phone
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 pl-9 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 pl-9 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address Line / House No. / Street
                </label>
                <input
                  type="text"
                  placeholder="e.g. House 42, Green Valley Enclave, Sector 14"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City / District
                </label>
                <input
                  type="text"
                  placeholder="e.g. Palakkad"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="Kerala"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    placeholder="678001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Emergency Contact */}
          <div className="bg-white rounded-3xl border border-surface-border shadow-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-surface-border">
              <Users className="w-4 h-4 text-amber-600" />
              <span>3. Emergency Contact Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spouse, Parent, Sibling"
                  value={emergencyRelation}
                  onChange={(e) => setEmergencyRelation(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Phone Number
                </label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Clinical Baseline & AYUSH */}
          <div className="bg-white rounded-3xl border border-surface-border shadow-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-surface-border">
              <HeartPulse className="w-4 h-4 text-rose-600" />
              <span>4. Baseline Clinical &amp; AYUSH Identifiers</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-rose-500" />
                  <span>Blood Group</span>
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>AYUSH Prakriti Constitution</span>
                </label>
                <select
                  value={prakriti}
                  onChange={(e) => setPrakriti(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="">Not Assessed Yet</option>
                  <option value="Vata">Vata</option>
                  <option value="Pitta">Pitta</option>
                  <option value="Kapha">Kapha</option>
                  <option value="Vata-Pitta">Vata-Pitta</option>
                  <option value="Pitta-Kapha">Pitta-Kapha</option>
                  <option value="Vata-Kapha">Vata-Kapha</option>
                  <option value="Tridoshic">Tridoshic (Samadosha)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Known Drug &amp; Environmental Allergies (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sulfa drugs, Pollen / Dust"
                  value={allergiesText}
                  onChange={(e) => setAllergiesText(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Known Chronic Medical Conditions (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Type 2 Diabetes Mellitus, Hypertension"
                  value={chronicText}
                  onChange={(e) => setChronicText(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-surface-border rounded-xl hover:bg-slate-50 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
