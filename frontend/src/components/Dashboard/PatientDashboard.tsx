import { useState } from 'react'
import {
  User as UserIcon,
  PlusCircle,
  FileText,
  Pill,
  HeartPulse,
  AlertCircle,
  Trash2,
  Calendar,
  LogOut,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2,
  Phone,
  Flame,
  Droplet,
  Clock,
  History,
} from 'lucide-react'
import type { User, PatientDashboardData, SavedDocument, LanguageCode } from '../../types'
import BrandLogo from '../BrandLogo'
import LanguageSelector from '../LanguageSelector'
import ThemeToggle from '../ThemeToggle'
import { useTranslation } from '../../i18n/translations'

interface PatientDashboardProps {
  patient: User
  dashboardData: PatientDashboardData | null
  isLoading: boolean
  language: LanguageCode
  onLanguageChange: (code: LanguageCode) => void
  onStartIntake: () => void
  onOpenProfile: () => void
  onLogout: () => void
  onDeleteDocument: (docId: string) => Promise<void>
  onDeleteIntakeSession: (sessionId: string) => Promise<void>
}

export default function PatientDashboard({
  patient,
  dashboardData,
  isLoading,
  language,
  onLanguageChange,
  onStartIntake,
  onOpenProfile,
  onLogout,
  onDeleteDocument,
  onDeleteIntakeSession,
}: PatientDashboardProps) {
  const t = useTranslation(language)
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

  const patientDetails = patient.patient_details || {}
  const allergies = (patientDetails.allergies as string[]) || []
  const chronicConditions = (patientDetails.chronic_conditions as string[]) || []
  const emergencyContact = (patientDetails.emergency_contact as { name?: string; relation?: string; phone?: string }) || {}

  const [medicationTab, setMedicationTab] = useState<'active' | 'past'>('active')
  const documents = dashboardData?.documents || []
  const intakeSessions = dashboardData?.intake_sessions || []
  const activeMedications = dashboardData?.active_medications || []
  const pastMedications = dashboardData?.past_medications || []

  const handleDeleteDoc = async (doc: SavedDocument) => {
    if (!window.confirm(`Are you sure you want to delete '${doc.filename}' from your health record?`)) {
      return
    }
    setDeletingDocId(doc.id)
    try {
      await onDeleteDocument(doc.id)
    } finally {
      setDeletingDocId(null)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this intake consultation session from your health record?')) {
      return
    }
    setDeletingSessionId(sessionId)
    try {
      await onDeleteIntakeSession(sessionId)
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
      {/* ── Dashboard Header ── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-surface-border dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {patient.name}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-cyan/10 dark:bg-brand-cyan/20 text-brand-cyan dark:text-cyan-400 border border-brand-cyan/20 dark:border-brand-cyan/30">
                  ABHA Linked
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                ABHA ID: {patient.abha_id} • {patient.age_years || 38}y, {patient.gender || 'Male'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <ThemeToggle />

            <LanguageSelector
              language={language}
              onLanguageChange={onLanguageChange}
            />

            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-surface-border dark:border-slate-700 rounded-xl transition-colors"
              title="View & Edit Full Personal Profile"
            >
              <UserIcon className="w-3.5 h-3.5 text-brand-cyan" />
              <span>{t.dashboard.profile}</span>
            </button>

            <button
              onClick={onStartIntake}
              className="btn-primary text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{t.dashboard.addDetails}</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-surface-border dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.dashboard.signOut}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Dashboard Body ── */}
      <main className="flex-1 max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-6">
        {/* ── Basic Personal Identity Summary Bar ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-surface-border dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center font-bold text-base">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{patient.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">({patient.age_years || 38}y, {patient.gender || 'Male'})</span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Droplet className="w-3 h-3" />
                  {String(patientDetails.blood_group || 'B+')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ABHA: <span className="font-mono text-slate-700 dark:text-slate-300">{patient.abha_id}</span> • Phone: {patient.phone || '+91 98765 43210'}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenProfile}
            className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold text-brand-cyan hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 bg-brand-cyan-light/30 dark:bg-brand-cyan-light/10 hover:bg-brand-cyan-light/50 dark:hover:bg-brand-cyan-light/20 border border-brand-cyan/20 dark:border-brand-cyan/30 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Edit Personal Details →</span>
          </button>
        </div>

        {/* ── Welcome & "Add Details" Hero Banner ── */}
        <div className="rounded-3xl bg-gradient-to-r from-cyan-900 via-teal-800 to-emerald-900 text-white p-6 sm:p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold text-cyan-200">
                <HeartPulse className="w-3.5 h-3.5" />
                <span>Ayush &amp; Clinical Medical Overview</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Medical Records &amp; Active Prescriptions
              </h2>
              <p className="text-xs sm:text-sm text-cyan-100 leading-relaxed">
                Review your active medications, verified diagnostic lab reports, and AI intake consultations below. Click <span className="font-semibold text-white">Add Details</span> to consult with Sanjivani AI or scan new prescription slips.
              </p>
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={onStartIntake}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white text-brand-cyan hover:bg-cyan-50 font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
              >
                <PlusCircle className="w-4 h-4 text-brand-cyan" />
                <span>Add Details (नया विवरण जोड़ें)</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Medical Baseline Snapshot ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 transition-colors">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-border dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Clinical &amp; AYUSH Medical Baseline</span>
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Personalized health indicators
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Chronic Conditions */}
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1.5">Known Chronic Conditions:</span>
              <div className="flex flex-wrap gap-1.5">
                {chronicConditions.length > 0 ? (
                  chronicConditions.map((cond, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-medium">
                      {cond}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-xs">None documented</span>
                )}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1.5">Known Drug Allergies:</span>
              <div className="flex flex-wrap gap-1.5">
                {allergies.length > 0 ? (
                  allergies.map((allergy, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {allergy}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-xs">No known drug allergies</span>
                )}
              </div>
            </div>

            {/* Ayush Prakriti */}
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1.5">AYUSH Prakriti Constitution:</span>
              {patientDetails.ayush_prakriti ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
                  <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  {String(patientDetails.ayush_prakriti)}
                </span>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 text-xs">Not assessed yet</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Prescriptions & Medications (Active vs Past) ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Medications Schedule</span>
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Active medications are determined by comparing prescription date and duration against current date
              </p>
            </div>

            {/* Segmented Toggle: Active vs Past */}
            <div className="flex items-center gap-1 bg-surface-muted dark:bg-slate-800 p-1 rounded-2xl border border-surface-border dark:border-slate-700 self-start sm:self-auto">
              <button
                onClick={() => setMedicationTab('active')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  medicationTab === 'active'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-100 dark:border-emerald-800'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Active ({activeMedications.length})</span>
              </button>
              <button
                onClick={() => setMedicationTab('past')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  medicationTab === 'past'
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Past Medications ({pastMedications.length})</span>
              </button>
            </div>
          </div>

          {medicationTab === 'active' ? (
            activeMedications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {activeMedications.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 transition-colors space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{med.drug_name}</span>
                      {med.dosage && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                          {med.dosage}
                        </span>
                      )}
                    </div>
                    {med.frequency && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        Frequency: <span className="text-slate-800 dark:text-slate-100">{med.frequency}</span>
                      </p>
                    )}
                    {med.duration && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Duration: <span className="font-semibold text-slate-700 dark:text-slate-200">{med.duration}</span>
                      </p>
                    )}

                    {med.prescription_date && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Prescription Date: <span className="font-semibold text-slate-700 dark:text-slate-200">{med.prescription_date}</span>
                      </p>
                    )}

                    {/* Active Status Badge & Expiry countdown */}
                    <div className="pt-1.5 border-t border-emerald-100 dark:border-emerald-900/60 flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {med.days_remaining && med.days_remaining > 0
                          ? `Active (${med.days_remaining}d left)`
                          : 'Active course'}
                      </span>
                      {med.end_date && (
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                          Valid until {med.end_date}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-1">
                      Source: {med.source_document}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-surface-border dark:border-slate-800">
                <Pill className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No active medications currently.</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  All prescribed courses are completed. Newly uploaded prescriptions will appear here while active.
                </p>
              </div>
            )
          ) : (
            pastMedications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {pastMedications.map((med, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl border border-surface-border dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors space-y-2 opacity-85"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{med.drug_name}</span>
                      {med.dosage && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-surface-border dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          {med.dosage}
                        </span>
                      )}
                    </div>
                    {med.frequency && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Frequency: <span className="text-slate-700 dark:text-slate-200">{med.frequency}</span>
                      </p>
                    )}
                    {med.duration && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Completed course: {med.duration}
                      </p>
                    )}

                    {med.prescription_date && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Prescription Date: <span className="font-semibold text-slate-700 dark:text-slate-200">{med.prescription_date}</span>
                      </p>
                    )}

                    {/* Completed Badge */}
                    <div className="pt-1.5 border-t border-surface-border dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-700/80 px-2 py-0.5 rounded-md text-[10px]">
                        <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                        Completed / Expired
                      </span>
                      {med.end_date && (
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                          Ended {med.end_date}
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pt-1">
                      Source: {med.source_document}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-surface-border dark:border-slate-800">
                <History className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No past medications on record.</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Expired or finished prescription medications will be cataloged here for historical reference.
                </p>
              </div>
            )
          )}
        </div>

        {/* ── Medical Documents & Prescriptions Gallery ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Scanned Medical Documents ({documents.length})</span>
            </h3>
            <button
              onClick={onStartIntake}
              className="text-xs font-semibold text-brand-cyan hover:underline flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Upload New
            </button>
          </div>

          {documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => {
                const isExpanded = expandedDocId === doc.id
                const meds = doc.structured_result?.medications || []
                const labs = doc.structured_result?.lab_investigations || []
                const isDeleting = deletingDocId === doc.id

                return (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-surface-border dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40 overflow-hidden transition-colors"
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                            {doc.filename}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            <span>Uploaded: {new Date(doc.created_at).toLocaleDateString('en-IN')}</span>
                            <span>•</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{meds.length} meds</span>
                            {labs.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-purple-700 dark:text-purple-400 font-semibold">{labs.length} labs</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-surface-border dark:border-slate-700 rounded-xl flex items-center gap-1 transition-colors"
                        >
                          <span>{isExpanded ? 'Hide' : 'View Data'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleDeleteDoc(doc)}
                          disabled={isDeleting}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors disabled:opacity-50"
                          title="Delete document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white dark:bg-slate-900 border-t border-surface-border dark:border-slate-800 space-y-3 animate-fade-in text-xs transition-colors">
                        {meds.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Medications:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {meds.map((m, i) => (
                                <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <span className="font-bold text-slate-900 dark:text-slate-100">{m.drug_name}</span>
                                  <span className="text-slate-500 dark:text-slate-400 ml-2">{m.dosage || ''} {m.frequency ? `• ${m.frequency}` : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {labs.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Laboratory Findings:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {labs.map((l, i) => (
                                <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between">
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{l.parameter_name}</span>
                                  <span className="font-bold text-slate-900 dark:text-slate-100">{l.observed_value} {l.unit || ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {doc.structured_result?.raw_text && (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Raw Transcription:</span>
                            <pre className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {doc.structured_result.raw_text}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-surface-border dark:border-slate-800">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">No medical documents uploaded yet.</p>
            </div>
          )}
        </div>

        {/* ── Consultation Intake History ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Intake Consultations History ({intakeSessions.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Documented AI sessions
            </span>
          </div>

          {intakeSessions.length > 0 ? (
            <div className="space-y-4">
              {intakeSessions.map((sess) => {
                const isExpanded = expandedSessionId === sess.id
                return (
                  <div
                    key={sess.id}
                    className="rounded-2xl border border-surface-border dark:border-slate-800 bg-surface-muted/30 dark:bg-slate-800/40 overflow-hidden transition-colors"
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Session on {new Date(sess.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            {sess.status === 'submitted' ? 'Saved to Health Record' : sess.status}
                          </span>
                        </div>
                        {sess.chief_complaint?.symptom && (
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            <span className="font-semibold text-slate-900 dark:text-white">Complaint:</span> {sess.chief_complaint.symptom} {sess.chief_complaint.duration ? `(${sess.chief_complaint.duration})` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : sess.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-surface-border dark:border-slate-700 rounded-xl flex items-center gap-1 transition-colors"
                        >
                          <span>{isExpanded ? 'Hide Summary' : 'View Summary'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleDeleteSession(sess.id)}
                          disabled={deletingSessionId === sess.id}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors disabled:opacity-50"
                          title="Delete consultation session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white dark:bg-slate-900 border-t border-surface-border dark:border-slate-800 space-y-3 animate-fade-in text-xs transition-colors">
                        {sess.ai_summary_text && (
                          <div className="p-3.5 bg-surface-muted dark:bg-slate-800 rounded-xl border border-surface-border dark:border-slate-700 text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                            {sess.ai_summary_text}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-surface-border dark:border-slate-800">
              <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">No consultation sessions saved yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
