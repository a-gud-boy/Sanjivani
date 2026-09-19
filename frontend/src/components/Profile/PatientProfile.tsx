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
  Users,
  Loader2,
  Dna,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react'
import type { User, FamilyHistoryEntry, AllergyEntry } from '../../types'
import { ALLERGY_CATEGORIES, COMMON_CHRONIC_CONDITIONS } from '../../types'
import { updatePatientProfile, extractErrorMessage } from '../../services/api'
import BrandLogo from '../BrandLogo'
import ThemeToggle from '../ThemeToggle'

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
  const [ageYears, setAgeYears] = useState(patient.age_years ? String(patient.age_years) : '')
  const [gender, setGender] = useState(patient.gender || '')
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
  const [maritalStatus, setMaritalStatus] = useState(details.marital_status ? String(details.marital_status) : '')
  const [bloodGroup, setBloodGroup] = useState(details.blood_group ? String(details.blood_group) : '')
  const [prakriti, setPrakriti] = useState(details.ayush_prakriti ? String(details.ayush_prakriti) : '')

  // Emergency contact
  const [emergencyName, setEmergencyName] = useState(emergency.name || '')
  const [emergencyRelation, setEmergencyRelation] = useState(emergency.relation || '')
  const [emergencyPhone, setEmergencyPhone] = useState(emergency.phone || '')

  // Allergies state (structured list of strings)
  const initialAllergies: string[] = Array.isArray(details.allergies)
    ? (details.allergies as string[]).map((s) => s.trim()).filter(Boolean)
    : []
  const [allergiesList, setAllergiesList] = useState<string[]>(initialAllergies)
  const [selectedAllergyCategory, setSelectedAllergyCategory] = useState<string>('')
  const [customAllergyText, setCustomAllergyText] = useState<string>('')

  // Chronic conditions state (structured list of strings)
  const initialChronic: string[] = Array.isArray(details.chronic_conditions)
    ? (details.chronic_conditions as string[]).map((s) => s.trim()).filter(Boolean)
    : []
  const [chronicList, setChronicList] = useState<string[]>(initialChronic)
  const [selectedChronicCategory, setSelectedChronicCategory] = useState<string>('')
  const [customChronicText, setCustomChronicText] = useState<string>('')

  // Family History (dynamic list)
  const initialFamilyHistory: FamilyHistoryEntry[] = Array.isArray(details.family_history)
    ? (details.family_history as FamilyHistoryEntry[]).filter(
        (e) => e && typeof e.relative === 'string' && typeof e.condition === 'string'
      )
    : []
  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryEntry[]>(initialFamilyHistory)

  // Status
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ── Allergies Helpers ───────────────────────────────────────────────────────
  const handleAddAllergy = () => {
    let toAdd = ''
    if (selectedAllergyCategory === 'Others (specify)' || selectedAllergyCategory === '__other__') {
      toAdd = customAllergyText.trim()
    } else if (selectedAllergyCategory) {
      toAdd = selectedAllergyCategory.trim()
    }

    if (!toAdd) return

    const items = toAdd.split(',').map((s) => s.trim()).filter(Boolean)
    setAllergiesList((prev) => {
      const next = [...prev]
      for (const item of items) {
        if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
          next.push(item)
        }
      }
      return next
    })

    setSelectedAllergyCategory('')
    setCustomAllergyText('')
  }

  const handleRemoveAllergy = (index: number) => {
    setAllergiesList((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Chronic Conditions Helpers ──────────────────────────────────────────────
  const handleAddChronic = () => {
    let toAdd = ''
    if (selectedChronicCategory === 'Others (specify)' || selectedChronicCategory === '__other__') {
      toAdd = customChronicText.trim()
    } else if (selectedChronicCategory) {
      toAdd = selectedChronicCategory.trim()
    }

    if (!toAdd) return

    const items = toAdd.split(',').map((s) => s.trim()).filter(Boolean)
    setChronicList((prev) => {
      const next = [...prev]
      for (const item of items) {
        if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
          next.push(item)
        }
      }
      return next
    })

    setSelectedChronicCategory('')
    setCustomChronicText('')
  }

  const handleRemoveChronic = (index: number) => {
    setChronicList((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Family History Helpers ──────────────────────────────────────────────────
  const addFamilyHistoryEntry = () => {
    setFamilyHistory((prev) => [...prev, { relative: '', condition: '', notes: '' }])
  }

  const updateFamilyHistoryEntry = (
    index: number,
    field: keyof FamilyHistoryEntry,
    value: string
  ) => {
    setFamilyHistory((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    )
  }

  const removeFamilyHistoryEntry = (index: number) => {
    setFamilyHistory((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Handle Save ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrorMessage(null)
    setSaveSuccess(false)

    try {
      // Filter out incomplete family history entries (must have both relative and condition)
      const validFamilyHistory = familyHistory.filter(
        (e) => e.relative.trim() && e.condition.trim()
      ).map((e) => ({
        relative: e.relative.trim(),
        condition: e.condition.trim(),
        notes: e.notes?.trim() || undefined,
      }))

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
        allergies: allergiesList,
        chronic_conditions: chronicList,
        family_history: validFamilyHistory,
        emergency_contact: {
          name: emergencyName,
          relation: emergencyRelation,
          phone: emergencyPhone,
        },
      }

      const parsedAge = ageYears.trim() ? parseInt(ageYears, 10) : undefined

      const res = await updatePatientProfile({
        patient_id: patient.id,
        name: name.trim(),
        gender: gender || undefined,
        age_years: Number.isFinite(parsedAge) ? parsedAge : undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-surface-border dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Dashboard</span>
            </button>
            <BrandLogo size="sm" />
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                Patient Profile &amp; Demographics
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Personal details &amp; Ayush health identity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 flex-shrink-0 animate-spin" aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Form Area ── */}
      <main className="flex-1 max-w-5xl mx-auto p-4 sm:p-6 w-full space-y-6 animate-fade-in">
        {/* Feedback alerts */}
        {saveSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Profile details saved successfully to database!</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 space-y-4 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-surface-border dark:border-slate-800">
              <UserIcon className="w-4 h-4 text-brand-cyan" />
              <span>1. Basic Personal Identity</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  required
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Marital Status
                </label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="">Select Marital Status</option>
                  <option value="Married">Married</option>
                  <option value="Single">Single</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Occupation
                </label>
                <input
                  type="text"
                  placeholder="e.g. School Teacher"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Details & Address */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 space-y-4 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-surface-border dark:border-slate-800">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>2. Contact Details &amp; Residential Address</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Mobile Phone
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 pl-9 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 pl-9 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Address Line / House No. / Street
                </label>
                <input
                  type="text"
                  placeholder="e.g. House 42, Green Valley Enclave, Sector 14"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  City / District
                </label>
                <input
                  type="text"
                  placeholder="e.g. Palakkad"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="Kerala"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    placeholder="678001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Emergency Contact */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 space-y-4 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-surface-border dark:border-slate-800">
              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>3. Emergency Contact Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spouse, Parent, Sibling"
                  value={emergencyRelation}
                  onChange={(e) => setEmergencyRelation(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Emergency Phone Number
                </label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Clinical Baseline & AYUSH */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 space-y-4 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-surface-border dark:border-slate-800">
              <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>4. Baseline Clinical &amp; AYUSH Identifiers</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5 text-rose-500" />
                  <span>Blood Group</span>
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                >
                  <option value="">Not Recorded / Pending Test</option>
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>AYUSH Prakriti Constitution</span>
                </label>
                <select
                  value={prakriti}
                  onChange={(e) => setPrakriti(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
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

              {/* Allergies */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Droplet className="w-3.5 h-3.5 text-rose-500" />
                    <span>Known Drug &amp; Environmental Allergies</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                    {allergiesList.length} recorded
                  </span>
                </label>

                {/* Badges of current allergies */}
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-surface-border dark:border-slate-700/60 items-center">
                  {allergiesList.length === 0 ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic py-0.5">
                      No known allergies recorded. Select or type below to add.
                    </span>
                  ) : (
                    allergiesList.map((allergy, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shadow-xs"
                      >
                        <span>{allergy}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAllergy(idx)}
                          className="hover:bg-rose-200/60 dark:hover:bg-rose-900/60 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-200 rounded p-0.5 transition-colors"
                          title={`Remove ${allergy}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add Allergy Controls */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <select
                    value={selectedAllergyCategory}
                    onChange={(e) => setSelectedAllergyCategory(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  >
                    <option value="">Select common allergy...</option>
                    <optgroup label="Drug Allergies">
                      <option value="Penicillin / Amoxicillin">Penicillin / Amoxicillin</option>
                      <option value="Sulfonamides (Sulfa drugs)">Sulfonamides (Sulfa drugs)</option>
                      <option value="NSAIDs (Aspirin / Ibuprofen)">NSAIDs (Aspirin / Ibuprofen)</option>
                      <option value="Cephalosporins">Cephalosporins</option>
                      <option value="Quinolones (Ciprofloxacin)">Quinolones (Ciprofloxacin)</option>
                      <option value="Tetracyclines">Tetracyclines</option>
                      <option value="Metronidazole">Metronidazole</option>
                      <option value="Codeine / Opioids">Codeine / Opioids</option>
                    </optgroup>
                    <optgroup label="Food Allergies">
                      <option value="Peanuts">Peanuts</option>
                      <option value="Tree Nuts (Cashew, Almond, Walnut)">Tree Nuts (Cashew, Almond, Walnut)</option>
                      <option value="Milk / Dairy (Lactose)">Milk / Dairy (Lactose)</option>
                      <option value="Eggs">Eggs</option>
                      <option value="Wheat / Gluten">Wheat / Gluten</option>
                      <option value="Soy">Soy</option>
                      <option value="Fish / Shellfish">Fish / Shellfish</option>
                      <option value="Sesame">Sesame</option>
                    </optgroup>
                    <optgroup label="Environmental / Inhalant">
                      <option value="Pollen (Seasonal Hay Fever)">Pollen (Seasonal Hay Fever)</option>
                      <option value="Dust Mites">Dust Mites</option>
                      <option value="Animal Dander (Cat / Dog)">Animal Dander (Cat / Dog)</option>
                      <option value="Mould / Fungal Spores">Mould / Fungal Spores</option>
                      <option value="Latex">Latex</option>
                      <option value="Insect Stings (Bee / Wasp)">Insect Stings (Bee / Wasp)</option>
                      <option value="Nickel (Contact Dermatitis)">Nickel (Contact Dermatitis)</option>
                    </optgroup>
                    <optgroup label="Chemical &amp; Other">
                      <option value="Iodine / Contrast Dye">Iodine / Contrast Dye</option>
                      <option value="Anaesthesia (Local / General)">Anaesthesia (Local / General)</option>
                    </optgroup>
                    <option value="Others (specify)">Others (specify)...</option>
                  </select>

                  {/* Others textbox */}
                  {(selectedAllergyCategory === 'Others (specify)' || selectedAllergyCategory === '__other__') && (
                    <input
                      type="text"
                      autoFocus
                      placeholder="Specify allergy name..."
                      value={customAllergyText}
                      onChange={(e) => setCustomAllergyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddAllergy()
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleAddAllergy}
                    disabled={
                      !selectedAllergyCategory ||
                      ((selectedAllergyCategory === 'Others (specify)' || selectedAllergyCategory === '__other__') && !customAllergyText.trim())
                    }
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Chronic Medical Conditions */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-amber-500" />
                    <span>Known Chronic Medical Conditions</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                    {chronicList.length} recorded
                  </span>
                </label>

                {/* Badges of current chronic conditions */}
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-surface-border dark:border-slate-700/60 items-center">
                  {chronicList.length === 0 ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic py-0.5">
                      No chronic conditions recorded. Select or type below to add.
                    </span>
                  ) : (
                    chronicList.map((condition, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs"
                      >
                        <span>{condition}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveChronic(idx)}
                          className="hover:bg-amber-200/60 dark:hover:bg-amber-900/60 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 rounded p-0.5 transition-colors"
                          title={`Remove ${condition}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add Condition Controls */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <select
                    value={selectedChronicCategory}
                    onChange={(e) => setSelectedChronicCategory(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
                  >
                    <option value="">Select common chronic condition...</option>
                    <option value="Type 2 Diabetes Mellitus">Type 2 Diabetes Mellitus</option>
                    <option value="Type 1 Diabetes Mellitus">Type 1 Diabetes Mellitus</option>
                    <option value="Hypertension (High Blood Pressure)">Hypertension (High Blood Pressure)</option>
                    <option value="Bronchial Asthma">Bronchial Asthma</option>
                    <option value="Chronic Obstructive Pulmonary Disease (COPD)">Chronic Obstructive Pulmonary Disease (COPD)</option>
                    <option value="Hypothyroidism / Thyroid Disorder">Hypothyroidism / Thyroid Disorder</option>
                    <option value="Coronary Artery Disease / Heart Disease">Coronary Artery Disease / Heart Disease</option>
                    <option value="Chronic Kidney Disease (CKD)">Chronic Kidney Disease (CKD)</option>
                    <option value="Osteoarthritis / Rheumatoid Arthritis">Osteoarthritis / Rheumatoid Arthritis</option>
                    <option value="Dyslipidemia (High Cholesterol)">Dyslipidemia (High Cholesterol)</option>
                    <option value="Gastroesophageal Reflux Disease (GERD / Acidity)">Gastroesophageal Reflux Disease (GERD / Acidity)</option>
                    <option value="Migraine / Chronic Headache">Migraine / Chronic Headache</option>
                    <option value="Epilepsy / Seizure Disorder">Epilepsy / Seizure Disorder</option>
                    <option value="Chronic Liver Disease / Fatty Liver">Chronic Liver Disease / Fatty Liver</option>
                    <option value="Allergic Rhinitis / Chronic Sinusitis">Allergic Rhinitis / Chronic Sinusitis</option>
                    <option value="Psoriasis / Eczema">Psoriasis / Eczema</option>
                    <option value="Depression / Anxiety Disorder">Depression / Anxiety Disorder</option>
                    <option value="Others (specify)">Others (specify)...</option>
                  </select>

                  {/* Others textbox */}
                  {(selectedChronicCategory === 'Others (specify)' || selectedChronicCategory === '__other__') && (
                    <input
                      type="text"
                      autoFocus
                      placeholder="Specify condition name..."
                      value={customChronicText}
                      onChange={(e) => setCustomChronicText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddChronic()
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleAddChronic}
                    disabled={
                      !selectedChronicCategory ||
                      ((selectedChronicCategory === 'Others (specify)' || selectedChronicCategory === '__other__') && !customChronicText.trim())
                    }
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Family Medical History */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 space-y-4 transition-colors">
            <div className="flex items-center justify-between pb-2 border-b border-surface-border dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Dna className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>5. Family Medical History</span>
              </h3>
              <button
                type="button"
                onClick={addFamilyHistoryEntry}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-xl hover:bg-violet-100 dark:hover:bg-violet-950/60 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Family Member
              </button>
            </div>

            {familyHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-600">
                <Dna className="w-8 h-8 opacity-40" />
                <p className="text-xs font-medium">No family history recorded yet.</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-600">
                  Add hereditary conditions known in your family (e.g. diabetes, hypertension, heart disease).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {familyHistory.map((entry, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 sm:grid-cols-[180px_1fr_1fr_auto] gap-3 p-3 rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40"
                  >
                    {/* Relative */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                        Relative
                      </label>
                      <select
                        value={entry.relative}
                        onChange={(e) => updateFamilyHistoryEntry(index, 'relative', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-300/40"
                      >
                        <option value="">Select relative</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Brother">Brother</option>
                        <option value="Sister">Sister</option>
                        <option value="Paternal Grandfather">Paternal Grandfather</option>
                        <option value="Paternal Grandmother">Paternal Grandmother</option>
                        <option value="Maternal Grandfather">Maternal Grandfather</option>
                        <option value="Maternal Grandmother">Maternal Grandmother</option>
                        <option value="Uncle">Uncle</option>
                        <option value="Aunt">Aunt</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Condition */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                        Condition / Diagnosis
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Type 2 Diabetes, Hypertension"
                        value={entry.condition}
                        onChange={(e) => updateFamilyHistoryEntry(index, 'condition', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300/40"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Diagnosed at age 50"
                        value={entry.notes || ''}
                        onChange={(e) => updateFamilyHistoryEntry(index, 'notes', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300/40"
                      />
                    </div>

                    {/* Remove button */}
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeFamilyHistoryEntry(index)}
                        title="Remove entry"
                        className="p-2 rounded-xl text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-start gap-1 pt-1">
              <span>ℹ️</span>
              <span>
                Recording family medical history helps the AI identify hereditary risk factors during your consultation.
                Only include conditions explicitly known through family diagnosis.
              </span>
            </p>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-surface-border dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Back to Dashboard</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs px-6 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" aria-hidden="true" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
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
