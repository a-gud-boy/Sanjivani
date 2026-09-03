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
import ThemeToggle from '../ThemeToggle'

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-surface-border dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {doctor.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Doctor Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                {String(details.specialization || 'Integrative AYUSH Clinician')} • ABHA: {doctor.abha_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-surface-border dark:border-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>{String(details.hospital || 'CHC Nemmara Wellness Kiosk')}</span>
            </div>

            <ThemeToggle />

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 rounded-xl transition-colors"
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
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-surface-border dark:border-slate-800 shadow-card transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Registered Patients</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.total_patients}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Live database records</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-surface-border dark:border-slate-800 shadow-card transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Triage Red Flags</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${stats.red_flag_patients > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.red_flag_patients}</p>
            <p className={`text-[11px] mt-0.5 ${stats.red_flag_patients > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {stats.red_flag_patients > 0 ? 'Urgent attention needed' : 'All vitals stable'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-surface-border dark:border-slate-800 shadow-card transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Digitized Prescriptions</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.total_prescriptions}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Verified via AI Vision OCR</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-surface-border dark:border-slate-800 shadow-card transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Consultation Sessions</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.total_consultations}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">AI intake consultations</p>
          </div>
        </div>

        {/* ── Search, Filter & Refresh Toolbar ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-surface-border dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search patients by name or ABHA ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-surface-border dark:border-slate-700 bg-surface-muted dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-cyan/20"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterRedFlag((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                filterRedFlag
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-surface-border dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Red Flags Only</span>
            </button>

            <button
              onClick={() => setFilterWithDocs((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                filterWithDocs
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-surface-border dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>With Documents</span>
            </button>

            <button
              onClick={fetchPatients}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Refresh Patient Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

           {/* ── Patient Records Table / Queue ── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-card overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-surface-border dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Registered Patients in Database ({displayedPatients.length})
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Click any patient to review their complete clinical dossier, consultations, and prescriptions
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
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
            <div className="divide-y divide-surface-border dark:divide-slate-800">
              {displayedPatients.map((p) => {
                const details = p.patient_details || {}
                const allergies = (details.allergies as string[]) || []
                const chronic = (details.chronic_conditions as string[]) || []
                const chiefComplaint = p.latest_session?.chief_complaint?.symptom

                return (
                  <div
                    key={p.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    {/* Patient Overview */}
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-brand-cyan/10 dark:bg-brand-cyan/20 text-brand-cyan dark:text-cyan-400 flex items-center justify-center font-bold text-base flex-shrink-0">
                        {p.name.charAt(0)}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            ({p.age_years || 38}y, {p.gender || 'Male'})
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-0.5">
                            <Droplet className="w-3 h-3" />
                            {String(details.blood_group || 'B+')}
                          </span>
                          {p.has_red_flags && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              Red Flag Alert
                            </span>
                          )}
                        </div>

                        {/* Complaint or Conditions */}
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-1">
                          {chiefComplaint ? (
                            <span><span className="font-semibold text-slate-900 dark:text-white">Latest Complaint:</span> {chiefComplaint}</span>
                          ) : chronic.length > 0 ? (
                            <span><span className="font-semibold text-slate-900 dark:text-white">Chronic:</span> {chronic.join(', ')}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">No acute intake recorded yet</span>
                          )}
                        </p>

                        {/* Metadata Row */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5 flex-wrap">
                          <span className="font-mono text-slate-700 dark:text-slate-300">ABHA: {p.abha_id}</span>
                          <span>•</span>
                          <span>{p.total_sessions_count} consultation{p.total_sessions_count === 1 ? '' : 's'}</span>
                          <span>•</span>
                          <span>{p.total_documents_count} attached doc{p.total_documents_count === 1 ? '' : 's'}</span>
                          {p.latest_session && (
                            <>
                              <span>•</span>
                              <span>Latest: {new Date(p.latest_session.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-3 self-end md:self-center">
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
              <p className="text-sm font-semibold">No patients found matching your search.</p>
              <p className="text-xs mt-1">Try changing your filters or search keywords.</p>
            </div>
          )}
        </div>
      </main>

      {/* ── Patient Dossier Detail Modal ── */}
      {selectedPatientId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-surface-border dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto transition-colors">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-surface-border dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-cyan text-white flex items-center justify-center font-bold text-lg">
                  {dossier?.patient.name.charAt(0) || 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {dossier?.patient.name || 'Patient Dossier'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      ABHA Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ABHA ID: {dossier?.patient.abha_id} • {dossier?.patient.age_years}y, {dossier?.patient.gender}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseDossier}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                title="Close Dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {dossierLoading ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-brand-cyan" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading complete clinical records...</p>
              </div>
            ) : dossierError ? (
              <div className="p-8 text-center text-rose-600 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto" />
                <p className="text-sm font-semibold">{dossierError}</p>
              </div>
            ) : dossier ? (
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Dossier Tabs */}
                <div className="flex items-center gap-2 px-6 pt-4 border-b border-surface-border dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold transition-colors">
                  <button
                    onClick={() => setActiveDossierTab('consultations')}
                    className={`pb-3 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeDossierTab === 'consultations'
                        ? 'border-brand-cyan text-brand-cyan font-bold'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
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
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
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
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
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
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
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
                              className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-surface-border dark:border-slate-700 p-5 space-y-4 shadow-sm transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border dark:border-slate-700 pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                                      {sess.chief_complaint?.symptom || 'Clinical Intake Session'}
                                    </span>
                                    {sess.red_flag_active && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                        Red Flag
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    Session Date: {new Date(sess.session_date).toLocaleString('en-IN')} • Status: {sess.status}
                                  </p>
                                </div>

                                {sess.chat_history && sess.chat_history.length > 0 && (
                                  <button
                                    onClick={() =>
                                      setExpandedSessionChatId(isChatExpanded ? null : sess.id)
                                    }
                                    className="px-3 py-1 text-xs font-semibold text-brand-cyan dark:text-cyan-400 bg-brand-cyan/10 dark:bg-brand-cyan/20 hover:bg-brand-cyan/20 border border-brand-cyan/20 dark:border-brand-cyan/30 rounded-xl flex items-center gap-1 transition-colors self-start sm:self-center"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>{isChatExpanded ? 'Hide Chat Transcript' : 'View Full Transcript'}</span>
                                    {isChatExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>

                              {/* AI Clinical Summary */}
                              {sess.ai_summary_text && (
                                <div className="p-4 bg-white dark:bg-slate-850 rounded-xl border border-surface-border dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 space-y-1">
                                  <span className="font-bold text-brand-cyan block">AI Clinical Narrative Summary:</span>
                                  <p className="whitespace-pre-line leading-relaxed">{sess.ai_summary_text}</p>
                                </div>
                              )}

                              {/* Expanded Chat History */}
                              {isChatExpanded && sess.chat_history && (
                                <div className="p-4 bg-white dark:bg-slate-850 rounded-xl border border-surface-border dark:border-slate-700 space-y-2 animate-fade-in">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                                    Full Kiosk Dialogue Transcript ({sess.chat_history.length} turns):
                                  </span>
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {sess.chat_history.map((m, idx) => (
                                      <div
                                        key={idx}
                                        className={`p-2.5 rounded-xl text-xs ${
                                          m.role === 'user'
                                            ? 'bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900 text-slate-800 dark:text-slate-100 ml-6'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-6'
                                        }`}
                                      >
                                        <span className="font-bold block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
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
                              className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-surface-border dark:border-slate-700 p-5 space-y-3 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-brand-cyan" />
                                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{doc.filename}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase">
                                  {doc.file_type}
                                </span>
                              </div>

                              {/* Meds extracted */}
                              {meds.length > 0 && (
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                                    Prescribed Medications ({meds.length}):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {meds.map((m, i) => (
                                      <span key={i} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-surface-border dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 font-medium">
                                        <span className="font-bold text-brand-cyan">{m.drug_name}</span> {m.dosage ? `(${m.dosage})` : ''} - {m.frequency}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Labs extracted */}
                              {labs.length > 0 && (
                                <div>
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                                    Diagnostic Lab Parameters ({labs.length}):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {labs.map((l, i) => (
                                      <span
                                        key={i}
                                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                                          l.is_abnormal
                                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900 font-bold'
                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-surface-border dark:border-slate-700'
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
                                <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-surface-border dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 font-mono whitespace-pre-line leading-relaxed">
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
                        <div className="flex items-center gap-1 bg-surface-muted dark:bg-slate-800 p-1 rounded-xl border border-surface-border dark:border-slate-700">
                          <button
                            onClick={() => setDoctorMedFilter('all')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                              doctorMedFilter === 'all'
                                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                            }`}
                          >
                            All ({dossier.active_medications.length + (dossier.past_medications || []).length})
                          </button>
                          <button
                            onClick={() => setDoctorMedFilter('active')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                              doctorMedFilter === 'active'
                                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-100 dark:border-emerald-800'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span>Active ({dossier.active_medications.length})</span>
                          </button>
                          <button
                            onClick={() => setDoctorMedFilter('past')}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                              doctorMedFilter === 'past'
                                ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-600'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                            <span>Past ({(dossier.past_medications || []).length})</span>
                          </button>
                        </div>

                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
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
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-surface-border dark:border-slate-700">
                              No medications found for the selected filter.
                            </p>
                          )
                        }

                        return (
                          <div className="overflow-x-auto rounded-2xl border border-surface-border dark:border-slate-700">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase border-b border-surface-border dark:border-slate-700">
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
                              <tbody className="divide-y divide-surface-border dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {displayedMeds.map((m, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                                    <td className="p-3">
                                      {m.is_active ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full text-[10px]">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                          Active
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full text-[10px]">
                                          Completed
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 font-bold text-slate-900 dark:text-white">{m.drug_name}</td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300">{m.dosage || '—'}</td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300">{m.frequency || '—'}</td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300">{m.duration || '—'}</td>
                                    <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                                      {m.prescription_date ? (
                                        <span>
                                          {m.prescription_date} {m.end_date ? `→ ${m.end_date}` : ''}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="p-3 text-slate-400 dark:text-slate-500 font-mono text-[11px]">{m.source_document}</td>
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
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-surface-border dark:border-slate-700 space-y-2 transition-colors">
                              <span className="font-bold text-slate-900 dark:text-white block">Personal Demographics</span>
                              <p><span className="text-slate-500 dark:text-slate-400">Full Name:</span> <span className="text-slate-800 dark:text-slate-200">{dossier.patient.name}</span></p>
                              <p><span className="text-slate-500 dark:text-slate-400">Date of Birth:</span> <span className="text-slate-800 dark:text-slate-200">{String(d.dob || '—')}</span></p>
                              <p><span className="text-slate-500 dark:text-slate-400">Gender &amp; Age:</span> <span className="text-slate-800 dark:text-slate-200">{dossier.patient.gender}, {dossier.patient.age_years} years</span></p>
                              <p><span className="text-slate-500 dark:text-slate-400">Occupation:</span> <span className="text-slate-800 dark:text-slate-200">{String(d.occupation || '—')}</span></p>
                              <p><span className="text-slate-500 dark:text-slate-400">Marital Status:</span> <span className="text-slate-800 dark:text-slate-200">{String(d.marital_status || '—')}</span></p>
                              <p><span className="text-slate-500 dark:text-slate-400">Contact Phone:</span> <span className="text-slate-800 dark:text-slate-200">{dossier.patient.phone || '—'}</span></p>
                              <p><span className="text-slate-500 dark:text-slate-400">Email:</span> <span className="text-slate-800 dark:text-slate-200">{dossier.patient.email || '—'}</span></p>
                              <p><span className="text-slate-500 dark:text-slate-400">Address:</span> <span className="text-slate-800 dark:text-slate-200">{String(d.address_line || d.address || '—')}, {String(d.city || '')}, {String(d.state || '')} {String(d.pincode || '')}</span></p>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-surface-border dark:border-slate-700 space-y-2 transition-colors">
                              <span className="font-bold text-slate-900 dark:text-white block">Clinical &amp; AYUSH Baseline</span>
                              <p className="flex items-center gap-1">
                                <span className="text-slate-500 dark:text-slate-400">Blood Group:</span>
                                <span className="font-bold text-rose-600 dark:text-rose-400">{String(d.blood_group || '—')}</span>
                              </p>
                              <p className="flex items-center gap-1">
                                <span className="text-slate-500 dark:text-slate-400">AYUSH Prakriti:</span>
                                <span className="font-bold text-amber-700 dark:text-amber-400">{String(d.ayush_prakriti || '—')}</span>
                              </p>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block mb-1">Known Allergies:</span>
                                <div className="flex flex-wrap gap-1">
                                  {allergies.length > 0 ? (
                                    allergies.map((a, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 font-semibold text-[10px]">
                                        {a}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 italic">No known allergies</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-slate-400 block mb-1">Chronic Illnesses:</span>
                                <div className="flex flex-wrap gap-1">
                                  {chronic.length > 0 ? (
                                    chronic.map((c, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 font-semibold text-[10px]">
                                        {c}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 italic">No chronic illnesses reported</span>
                                  )}
                                </div>
                              </div>
                              <div className="pt-2 border-t border-surface-border dark:border-slate-700">
                                <span className="text-slate-500 dark:text-slate-400 block">Emergency Contact:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
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
            <div className="px-6 py-3 border-t border-surface-border dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between transition-colors">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Sanjivani Kiosk Health Records Engine • Ministry of Ayush
              </span>
              <button
                onClick={handleCloseDossier}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-surface-border dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
