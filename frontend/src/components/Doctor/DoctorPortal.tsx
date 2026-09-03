import { useState, useEffect, useCallback } from 'react'
import {
  Stethoscope,
  LogOut,
  Users,
  AlertTriangle,
  FileCheck2,
  Activity,
  Calendar,
  Building2,
  Clock,
  Award,
  Search,
  Filter,
  FileText,
  ChevronRight,
  X,
  Pill,
  Droplet,
  Phone,
  MapPin,
  HeartPulse,
  Flame,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type {
  User,
  DoctorPatientSummary,
  DoctorPortalStats,
  PatientDashboardData,
  SavedIntakeSession,
  SavedDocument,
} from '../../types'
import { getDoctorPatients, getDoctorPatientDossier, extractErrorMessage } from '../../services/api'
import BrandLogo from '../BrandLogo'

interface DoctorPortalProps {
  doctor: User
  onLogout: () => void
}

export default function DoctorPortal({ doctor, onLogout }: DoctorPortalProps) {
  const details = doctor.doctor_details || {}

  // ── State ──────────────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([])
  const [stats, setStats] = useState<DoctorPortalStats>({
    total_patients: 0,
    red_flag_patients: 0,
    total_prescriptions: 0,
    total_consultations: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRedFlag, setFilterRedFlag] = useState(false)
  const [filterWithDocs, setFilterWithDocs] = useState(false)

  // Selected Patient Dossier (Detail View)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [dossier, setDossier] = useState<PatientDashboardData | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierError, setDossierError] = useState<string | null>(null)
  const [activeDossierTab, setActiveDossierTab] = useState<'consultations' | 'prescriptions' | 'medications' | 'baseline'>('consultations')
  const [expandedSessionChatId, setExpandedSessionChatId] = useState<string | null>(null)
  const [doctorMedFilter, setDoctorMedFilter] = useState<'all' | 'active' | 'past'>('all')

  // ── Fetch Patients from Live Database ───────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await getDoctorPatients(searchQuery, filterRedFlag)
      setPatients(res.patients)
      setStats(res.stats)
    } catch (err) {
      setErrorMessage(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, filterRedFlag])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  // ── Open Patient Dossier ───────────────────────────────────────────────────
  const handleOpenDossier = async (patientId: string) => {
    setSelectedPatientId(patientId)
    setDossier(null)
    setDossierLoading(true)
    setDossierError(null)
    setActiveDossierTab('consultations')

    try {
      const data = await getDoctorPatientDossier(patientId)
      setDossier(data)
    } catch (err) {
      setDossierError(extractErrorMessage(err))
    } finally {
      setDossierLoading(false)
    }
  }

  const handleCloseDossier = () => {
    setSelectedPatientId(null)
    setDossier(null)
    setDossierError(null)
  }

  // Filtered patients for local document filtering
  const displayedPatients = patients.filter((p) => {
    if (filterWithDocs && p.total_documents_count === 0) return false
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ── Top Doctor Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-surface-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {doctor.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Doctor Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md">
                {String(details.specialization || 'Integrative AYUSH Clinician')} • ABHA: {doctor.abha_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-surface-border">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{String(details.hospital || 'CHC Nemmara Wellness Kiosk')}</span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-6">
        {/* Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-800 text-white p-6 sm:p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold text-white">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Doctor Clinical Oversight Station (EHR Database Access)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Clinical Review &amp; Patient Records Registry
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
              Live healthcare provider portal connecting to all registered patients in the database.
              Inspect AI-digitized intake transcripts, multimodal OCR verified prescriptions, and AYUSH Prakriti assessments.
            </p>
          </div>

          {/* Quick Doctor Badges */}
          <div className="mt-6 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <span className="truncate">Lic: {String(details.license_no || 'AYU-KL-2018')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-300 flex-shrink-0" />
              <span>{String(details.opd_hours || '09:00 - 16:30')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-300 flex-shrink-0" />
              <span>Duty: {String(details.duty_status || 'On-Duty Active')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-white/80 flex-shrink-0" />
              <span>Today: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Live Metric Cards from Database */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Registered Patients</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total_patients}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Live database records</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Triage Red Flags</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${stats.red_flag_patients > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.red_flag_patients}</p>
            <p className={`text-[11px] mt-0.5 ${stats.red_flag_patients > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}`}>
              {stats.red_flag_patients > 0 ? 'Urgent attention needed' : 'All vitals stable'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Digitized Prescriptions</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total_prescriptions}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Verified via AI Vision OCR</p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Consultation Sessions</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total_consultations}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">AI intake consultations</p>
          </div>
        </div>

        {/* ── Search, Filter & Refresh Toolbar ── */}
        <div className="bg-white rounded-2xl border border-surface-border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients by name or ABHA ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-surface-border bg-surface-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterRedFlag((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                filterRedFlag
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-white text-slate-600 border-surface-border hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Red Flags Only</span>
            </button>

            <button
              onClick={() => setFilterWithDocs((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                filterWithDocs
                  ? 'bg-purple-50 text-purple-700 border-purple-300'
                  : 'bg-white text-slate-600 border-surface-border hover:bg-slate-50'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-purple-600" />
              <span>With Documents</span>
            </button>

            <button
              onClick={fetchPatients}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-surface-border hover:bg-slate-50 transition-colors"
              title="Refresh Patient Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Patient Records Table / Queue ── */}
        <div className="bg-white rounded-3xl border border-surface-border shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Registered Patients in Database ({displayedPatients.length})
              </h3>
              <p className="text-xs text-slate-400">
                Click any patient to review their complete clinical dossier, consultations, and prescriptions
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Connected
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-cyan" />
              <p className="text-xs">Loading patient registry from database...</p>
            </div>
          ) : displayedPatients.length > 0 ? (
            <div className="divide-y divide-surface-border">
              {displayedPatients.map((p) => {
                const details = p.patient_details || {}
                const allergies = (details.allergies as string[]) || []
                const chronic = (details.chronic_conditions as string[]) || []
                const chiefComplaint = p.latest_session?.chief_complaint?.symptom

                return (
                  <div
                    key={p.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Patient Overview */}
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center font-bold text-base flex-shrink-0">
                        {p.name.charAt(0)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                          <span className="text-xs text-slate-400">
                            ({p.age_years || 38}y, {p.gender || 'Male'})
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5">
                            <Droplet className="w-3 h-3" />
                            {String(details.blood_group || 'B+')}
                          </span>
                          {p.has_red_flags && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Red Flag Alert
                            </span>
                          )}
                        </div>

                        {/* Complaint or Conditions */}
                        <p className="text-xs text-slate-700 font-medium line-clamp-1">
                          {chiefComplaint ? (
                            <span><span className="font-semibold text-slate-900">Latest Complaint:</span> {chiefComplaint}</span>
                          ) : chronic.length > 0 ? (
                            <span><span className="font-semibold text-slate-900">Chronic:</span> {chronic.join(', ')}</span>
                          ) : (
                            <span className="text-slate-400 italic">No acute intake recorded yet</span>
                          )}
                        </p>

                        {/* Metadata Row */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5 flex-wrap">
                          <span className="font-mono text-slate-700">ABHA: {p.abha_id}</span>
                          <span>•</span>
                          <span>{p.total_sessions_count} consultation{p.total_sessions_count === 1 ? '' : 's'}</span>
                          <span>•</span>
                          <span>{p.total_documents_count} attached doc{p.total_documents_count === 1 ? '' : 's'}</span>
                          {details.city ? (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {String(details.city)}, {String(details.state || '')}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5 self-end md:self-center">
                      <button
                        onClick={() => handleOpenDossier(p.id)}
                        className="btn-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Clinical Dossier</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600">No patients found matching your search.</p>
              <p className="text-[11px] text-slate-400 mt-1">Try clearing your filters or search query.</p>
            </div>
          )}
        </div>
      </main>

      {/* ── PATIENT CLINICAL DOSSIER MODAL ────────────────────────────────────── */}
      {selectedPatientId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-surface-border shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-surface-border bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-cyan text-white flex items-center justify-center font-bold text-lg">
                  {dossier?.patient.name.charAt(0) || 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {dossier?.patient.name || 'Patient Dossier'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ABHA Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    ABHA ID: {dossier?.patient.abha_id} • {dossier?.patient.age_years}y, {dossier?.patient.gender}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseDossier}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title="Close Dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {dossierLoading ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-brand-cyan" />
                <p className="text-sm font-medium text-slate-600">Loading complete clinical records...</p>
              </div>
            ) : dossierError ? (
              <div className="p-8 text-center text-rose-600 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto" />
                <p className="text-sm font-semibold">{dossierError}</p>
              </div>
            ) : dossier ? (
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Dossier Tabs */}
                <div className="flex items-center gap-2 px-6 pt-4 border-b border-surface-border bg-white text-xs font-semibold">
                  <button
                    onClick={() => setActiveDossierTab('consultations')}
                    className={`pb-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeDossierTab === 'consultations'
                        ? 'border-brand-cyan text-brand-cyan font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Intake Consultations ({dossier.intake_sessions.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveDossierTab('prescriptions')}
                    className={`pb-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeDossierTab === 'prescriptions'
                        ? 'border-brand-cyan text-brand-cyan font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Prescriptions &amp; Labs ({dossier.documents.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveDossierTab('medications')}
                    className={`pb-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeDossierTab === 'medications'
                        ? 'border-brand-cyan text-brand-cyan font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Pill className="w-3.5 h-3.5" />
                    <span>Medications ({dossier.active_medications.length + (dossier.past_medications || []).length})</span>
                  </button>

                  <button
                    onClick={() => setActiveDossierTab('baseline')}
                    className={`pb-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeDossierTab === 'baseline'
                        ? 'border-brand-cyan text-brand-cyan font-bold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <HeartPulse className="w-3.5 h-3.5" />
                    <span>Baseline &amp; Demographics</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-6 flex-1 space-y-6">
                  {/* TAB 1: CONSULTATIONS */}
                  {activeDossierTab === 'consultations' && (
                    <div className="space-y-4">
                      {dossier.intake_sessions.length > 0 ? (
                        dossier.intake_sessions.map((sess) => {
                          const isChatExpanded = expandedSessionChatId === sess.id
                          return (
                            <div
                              key={sess.id}
                              className="bg-slate-50 rounded-2xl border border-surface-border p-5 space-y-4 shadow-sm"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900">
                                      {sess.chief_complaint?.symptom || 'Clinical Intake Session'}
                                    </span>
                                    {sess.red_flag_active && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                        Red Flag
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Session Date: {new Date(sess.session_date).toLocaleString('en-IN')} • Status: {sess.status}
                                  </p>
                                </div>

                                {sess.chat_history && sess.chat_history.length > 0 && (
                                  <button
                                    onClick={() =>
                                      setExpandedSessionChatId(isChatExpanded ? null : sess.id)
                                    }
                                    className="px-3 py-1 text-xs font-semibold text-brand-cyan bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/20 rounded-xl flex items-center gap-1 transition-colors self-start sm:self-center"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>{isChatExpanded ? 'Hide Chat Transcript' : 'View Full Transcript'}</span>
                                    {isChatExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>

                              {/* AI Clinical Summary */}
                              {sess.ai_summary_text && (
                                <div className="p-4 bg-white rounded-xl border border-surface-border text-xs text-slate-800 space-y-1">
                                  <span className="font-bold text-brand-cyan block">AI Clinical Narrative Summary:</span>
                                  <p className="whitespace-pre-line leading-relaxed">{sess.ai_summary_text}</p>
                                </div>
                              )}

                              {/* Expanded Chat History */}
                              {isChatExpanded && sess.chat_history && (
                                <div className="p-4 bg-white rounded-xl border border-surface-border space-y-2 animate-fade-in">
                                  <span className="text-xs font-bold text-slate-700 block mb-2">
                                    Full Kiosk Dialogue Transcript ({sess.chat_history.length} turns):
                                  </span>
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {sess.chat_history.map((m, idx) => (
                                      <div
                                        key={idx}
                                        className={`p-2.5 rounded-xl text-xs ${
                                          m.role === 'user'
                                            ? 'bg-cyan-50 border border-cyan-100 text-slate-800 ml-6'
                                            : 'bg-slate-100 text-slate-800 mr-6'
                                        }`}
                                      >
                                        <span className="font-bold block text-[10px] text-slate-500 mb-0.5">
                                          {m.role === 'user' ? 'Patient' : 'Sanjivani Kiosk AI'}
                                        </span>
                                        <p>{m.content}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-xs text-slate-400 italic">No consultation sessions documented for this patient.</p>
                      )}
                    </div>
                  )}

                  {/* TAB 2: PRESCRIPTIONS & LABS */}
                  {activeDossierTab === 'prescriptions' && (
                    <div className="space-y-4">
                      {dossier.documents.length > 0 ? (
                        dossier.documents.map((doc) => {
                          const res = (doc.structured_result || {}) as Record<string, any>
                          const meds = (res.medications as Array<{ drug_name: string; dosage?: string; frequency?: string }>) || []
                          const labs = (res.lab_investigations as Array<{ parameter_name: string; observed_value: string; unit?: string; is_abnormal?: boolean }>) || []

                          return (
                            <div
                              key={doc.id}
                              className="bg-slate-50 rounded-2xl border border-surface-border p-5 space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-brand-cyan" />
                                  <span className="font-bold text-xs sm:text-sm text-slate-900">{doc.filename}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                                  {doc.file_type}
                                </span>
                              </div>

                              {/* Meds extracted */}
                              {meds.length > 0 && (
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Prescribed Medications ({meds.length}):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {meds.map((m, i) => (
                                      <span key={i} className="px-2.5 py-1 rounded-lg bg-white border border-surface-border text-xs text-slate-800 font-medium">
                                        <span className="font-bold text-brand-cyan">{m.drug_name}</span> {m.dosage ? `(${m.dosage})` : ''} - {m.frequency}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Labs extracted */}
                              {labs.length > 0 && (
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                    Diagnostic Lab Parameters ({labs.length}):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {labs.map((l, i) => (
                                      <span
                                        key={i}
                                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                                          l.is_abnormal
                                            ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                                            : 'bg-white text-slate-800 border-surface-border'
                                        }`}
                                      >
                                        {l.parameter_name}: {l.observed_value} {l.unit}
                                        {l.is_abnormal ? ' (Abnormal)' : ''}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* OCR raw text preview */}
                              {res.raw_text && (
                                <div className="p-3 bg-white rounded-xl border border-surface-border text-[11px] text-slate-600 font-mono whitespace-pre-line leading-relaxed">
                                  {res.raw_text}
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-xs text-slate-400 italic">No medical documents uploaded.</p>
                      )}
                    </div>
                  )}

                  {/* TAB 3: MEDICATIONS (ACTIVE & PAST) */}
                  {activeDossierTab === 'medications' && (
                    <div className="space-y-4">
                      {/* Sub-filter controls */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1 bg-surface-muted p-1 rounded-xl border border-surface-border">
                          <button
                            onClick={() => setDoctorMedFilter('all')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                              doctorMedFilter === 'all'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            All ({dossier.active_medications.length + (dossier.past_medications || []).length})
                          </button>
                          <button
                            onClick={() => setDoctorMedFilter('active')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                              doctorMedFilter === 'active'
                                ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span>Active ({dossier.active_medications.length})</span>
                          </button>
                          <button
                            onClick={() => setDoctorMedFilter('past')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                              doctorMedFilter === 'past'
                                ? 'bg-white text-slate-700 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                            <span>Past ({(dossier.past_medications || []).length})</span>
                          </button>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          Classified by prescription dates &amp; course durations
                        </span>
                      </div>

                      {(() => {
                        const activeList = dossier.active_medications || []
                        const pastList = dossier.past_medications || []
                        const displayedMeds =
                          doctorMedFilter === 'active'
                            ? activeList
                            : doctorMedFilter === 'past'
                            ? pastList
                            : [...activeList, ...pastList]

                        if (displayedMeds.length === 0) {
                          return (
                            <p className="text-xs text-slate-400 italic p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-surface-border">
                              No medications found for the selected filter.
                            </p>
                          )
                        }

                        return (
                          <div className="overflow-x-auto rounded-2xl border border-surface-border">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-surface-border">
                                <tr>
                                  <th className="p-3">Status</th>
                                  <th className="p-3">Drug Name</th>
                                  <th className="p-3">Dosage</th>
                                  <th className="p-3">Frequency</th>
                                  <th className="p-3">Duration</th>
                                  <th className="p-3">Prescription Dates</th>
                                  <th className="p-3">Source Document</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-surface-border bg-white">
                                {displayedMeds.map((m, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3">
                                      {m.is_active ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          Active
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[10px]">
                                          Completed
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 font-bold text-slate-900">{m.drug_name}</td>
                                    <td className="p-3 text-slate-600">{m.dosage || '—'}</td>
                                    <td className="p-3 text-slate-600">{m.frequency || '—'}</td>
                                    <td className="p-3 text-slate-600">{m.duration || '—'}</td>
                                    <td className="p-3 text-slate-500 text-[11px]">
                                      {m.prescription_date ? (
                                        <span>
                                          {m.prescription_date} {m.end_date ? `→ ${m.end_date}` : ''}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="p-3 text-slate-400 font-mono text-[11px]">{m.source_document}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* TAB 4: BASELINE & DEMOGRAPHICS */}
                  {activeDossierTab === 'baseline' && (
                    <div className="space-y-4">
                      {(() => {
                        const d = dossier.patient.patient_details || {}
                        const allergies = (d.allergies as string[]) || []
                        const chronic = (d.chronic_conditions as string[]) || []
                        const emergency = (d.emergency_contact as { name?: string; relation?: string; phone?: string }) || {}

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-surface-border space-y-2">
                              <span className="font-bold text-slate-900 block">Personal Demographics</span>
                              <p><span className="text-slate-500">Full Name:</span> {dossier.patient.name}</p>
                              <p><span className="text-slate-500">Date of Birth:</span> {String(d.dob || '—')}</p>
                              <p><span className="text-slate-500">Gender &amp; Age:</span> {dossier.patient.gender}, {dossier.patient.age_years} years</p>
                              <p><span className="text-slate-500">Occupation:</span> {String(d.occupation || '—')}</p>
                              <p><span className="text-slate-500">Marital Status:</span> {String(d.marital_status || '—')}</p>
                              <p><span className="text-slate-500">Contact Phone:</span> {dossier.patient.phone || '—'}</p>
                              <p><span className="text-slate-500">Email:</span> {dossier.patient.email || '—'}</p>
                              <p><span className="text-slate-500">Address:</span> {String(d.address_line || d.address || '—')}, {String(d.city || '')}, {String(d.state || '')} {String(d.pincode || '')}</p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-surface-border space-y-2">
                              <span className="font-bold text-slate-900 block">Clinical &amp; AYUSH Baseline</span>
                              <p className="flex items-center gap-1">
                                <span className="text-slate-500">Blood Group:</span>
                                <span className="font-bold text-rose-600">{String(d.blood_group || '—')}</span>
                              </p>
                              <p className="flex items-center gap-1">
                                <span className="text-slate-500">AYUSH Prakriti:</span>
                                <span className="font-bold text-amber-700">{String(d.ayush_prakriti || '—')}</span>
                              </p>
                              <div>
                                <span className="text-slate-500 block mb-1">Known Allergies:</span>
                                <div className="flex flex-wrap gap-1">
                                  {allergies.length > 0 ? (
                                    allergies.map((a, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold text-[10px]">
                                        {a}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic">No known allergies</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500 block mb-1">Chronic Illnesses:</span>
                                <div className="flex flex-wrap gap-1">
                                  {chronic.length > 0 ? (
                                    chronic.map((c, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                                        {c}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic">No chronic illnesses reported</span>
                                  )}
                                </div>
                              </div>
                              <div className="pt-2 border-t border-surface-border">
                                <span className="text-slate-500 block">Emergency Contact:</span>
                                <span className="font-semibold text-slate-800">
                                  {emergency.name ? `${emergency.name} (${emergency.relation}) - ${emergency.phone}` : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-surface-border bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Sanjivani Kiosk Health Records Engine • Ministry of Ayush
              </span>
              <button
                onClick={handleCloseDossier}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-surface-border hover:bg-slate-100 transition-colors"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
