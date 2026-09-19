import { useState, useCallback, useEffect, useRef } from 'react'
import { MessageSquare, ScanLine, LayoutDashboard, CheckCircle2 } from 'lucide-react'
import type {
  IntakeState,
  ChatMessage,
  LanguageCode,
  ChatHistoryEntry,
  ActiveTab,
  ScannedDocument,
  User,
  AppView,
  PatientDashboardData,
} from './types'
import {
  getInitialGreeting,
  sendChatMessage,
  scanDocument,
  generateSummary,
  extractErrorMessage,
  getPatientDashboard,
  saveIntakeSession,
  deletePatientDocument,
  deleteIntakeSession,
} from './services/api'

import Header from './components/Header'
import RedFlagAlert from './components/RedFlagAlert'
import ChatInterface from './components/Chat/ChatInterface'
import ScannerPanel from './components/DocumentScanner/ScannerPanel'
import SummaryModal from './components/ClinicalSummary/SummaryModal'
import LoginPage from './components/Auth/LoginPage'
import PatientDashboard from './components/Dashboard/PatientDashboard'
import DoctorPortal from './components/Doctor/DoctorPortal'
import PatientProfile from './components/Profile/PatientProfile'

// ── Lightweight UUID util ────────────────────────────────────────────────────
function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ── Stored language helper ───────────────────────────────────────────────────
const getStoredLanguage = (): LanguageCode => {
  try {
    const saved = localStorage.getItem('sanjivani_language')
    if (saved && ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu'].includes(saved)) {
      return saved as LanguageCode
    }
  } catch (err) {
    console.warn('Unable to read stored language preference:', err)
  }
  return 'en'
}

// ── Client-side Fallback Greetings for Instant Response on Network/LLM Latency ──
const CLIENT_FALLBACK_GREETINGS: Record<LanguageCode, { greeting: string; chips: string[] }> = {
  en: {
    greeting: 'I am Sanjivani AI. Tell me what symptoms or health problems you are experiencing.',
    chips: ['Headache / Body Ache', 'Fever, Cold or Cough', 'Stomach or Digestion issue', 'General Health Checkup'],
  },
  hi: {
    greeting: 'मैं संजीवनी एआई हूँ। कृपया बताएं कि आज आपको क्या स्वास्थ्य समस्या या लक्षण हैं।',
    chips: ['सिरदर्द / बदन दर्द', 'बुखार, सर्दी या खांसी', 'पेट या पाचन की समस्या', 'सामान्य स्वास्थ्य जांच'],
  },
  ta: {
    greeting: 'வணக்கம்! நான் சஞ்சீவனி, உங்கள் மருத்துவ உதவி AI. இன்று உங்களுக்கு என்ன உடல்நல பிரச்சனை அல்லது அறிகுறிகள் உள்ளன?',
    chips: ['தலைவலி / உடல் வலி', 'காய்ச்சல் / சளி / இருமல்', 'வயிற்று வலி / செரிமான பிரச்சனை', 'பொதுவான உடல் பரிசோதனை'],
  },
  te: {
    greeting: 'నమస్కారం! నేను సంజీవని, మీ క్లినికల్ ఇన్‌టేక్ అసిస్టెంట్‌ని. ఈ రోజు మీకు ఏ విధమైన అనారోగ్య సమస్య లేదా లక్షణాలు ఉన్నాయి?',
    chips: ['తలనొప్పి / ఒంటి నొప్పులు', 'జ్వరం / జలుबु / దగ్గు', 'కడుపు నొప్పి / జీర్ణ సమస్య', 'సాధారణ ఆరోగ్య పరీక్ష'],
  },
  bn: {
    greeting: 'আমি সঞ্জীবনী এআই। বলুন আজ আপনার কী কী শারীরিক সমস্যা বা উপসর্গ দেখা দিচ্ছে।',
    chips: ['মাথাব্যথা / শরীরে ব্যথা', 'জ্বর, সর্দি বা কাশি', 'পেট বা হজমের সমস্যা', 'সাধারণ স্বাস্থ্য পরীক্ষা'],
  },
  mr: {
    greeting: 'मी संजीवनी एआय आहे. कृपया सांगा आज आपल्याला कोणता त्रास किंवा लक्षणे जाणवत आहेत.',
    chips: ['डोकेदुखी / अंगदुखी', 'ताप, सर्दी किंवा खोकला', 'पोटाची किंवा पचनाची समस्या', 'नियमित आरोग्य तपासणी'],
  },
  gu: {
    greeting: 'હું સંજીવની એઆઈ છું. કૃપા કરીને જણાવો કે આજે તમને શું સ્વાસ્થ્ય સમસ્યા અથવા લક્ષણો છે.',
    chips: ['માથાનો દુખાવો / શરીરનો દુખાવો', 'તાવ, શરદી અથવા ઉધરસ', 'પેટ અથવા પાચનની તકલીફ', 'સામાન્ય આરોગ્ય તપાસ'],
  },
}

// ── Initial state ────────────────────────────────────────────────────────────
const INITIAL_STATE: IntakeState = {
  language: getStoredLanguage(),
  abhaLinked: false,
  abhaId: null,
  messages: [],
  chatStatus: 'active',
  clinicalRecord: null,
  redFlagActive: false,
  scannedDocuments: [],
  activeTab: 'chat',
  summaryOpen: false,
  aiSummaryText: null,
  aiSummarySections: null,
  summaryLoading: false,
  summaryLanguage: null,
}
// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const lastFetchedLangRef = useRef<string | null>(null)
  // ── Authentication & View Management ───────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const token = localStorage.getItem('sanjivani_auth_token')
      const saved = localStorage.getItem('sanjivani_auth_user')
      if (token && saved) {
        return JSON.parse(saved)
      }
      if (saved && !token) {
        localStorage.removeItem('sanjivani_auth_user')
      }
      return null
    } catch {
      return null
    }
  })

  const [currentView, setCurrentView] = useState<AppView>(() => {
    try {
      const token = localStorage.getItem('sanjivani_auth_token')
      const saved = localStorage.getItem('sanjivani_auth_user')
      if (token && saved) {
        const u: User = JSON.parse(saved)
        return u.user_type === 'doctor' ? 'doctor_portal' : 'patient_dashboard'
      }
    } catch (err) {
      console.warn('Unable to read stored user for current view:', err)
    }
    return 'login'
  })

  // ── Patient Dashboard Data ─────────────────────────────────────────────────
  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false)
  const [submitNotice, setSubmitNotice] = useState<string | null>(null)

  // ── Intake State ───────────────────────────────────────────────────────────
  const [state, setState] = useState<IntakeState>(INITIAL_STATE)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  // ── Logout Handler ─────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    lastFetchedLangRef.current = null
    try {
      localStorage.removeItem('sanjivani_auth_user')
      localStorage.removeItem('sanjivani_auth_token')
    } catch (err) {
      console.warn('Unable to remove stored auth user or token:', err)
    }
    setCurrentUser(null)
    setDashboardData(null)
    setCurrentView('login')
    setState((s) => ({
      ...INITIAL_STATE,
      language: s.language,
    }))
  }, [])

  // ── Global Auth Expiry Listener (triggers on HTTP 401) ──────────────────────
  useEffect(() => {
    const onAuthExpired = () => {
      handleLogout()
    }
    window.addEventListener('sanjivani:auth-expired', onAuthExpired)
    return () => {
      window.removeEventListener('sanjivani:auth-expired', onAuthExpired)
    }
  }, [handleLogout])

  // ── Load Dashboard Data ────────────────────────────────────────────────────
  const loadDashboard = useCallback(async (patientId: string) => {
    const token = localStorage.getItem('sanjivani_auth_token')
    if (!token) {
      handleLogout()
      return
    }
    setDashboardLoading(true)
    try {
      const data = await getPatientDashboard(patientId)
      setDashboardData(data)
    } catch (err: unknown) {
      console.warn('Failed to load patient dashboard:', err)
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401 || status === 403) {
        handleLogout()
      }
    } finally {
      setDashboardLoading(false)
    }
  }, [handleLogout])

  useEffect(() => {
    if (currentUser?.user_type === 'patient') {
      loadDashboard(currentUser.id)
      setState((s) => ({
        ...s,
        abhaLinked: true,
        abhaId: currentUser.abha_id,
      }))
    }
  }, [currentUser, loadDashboard])

  // ── Login Success Handler ──────────────────────────────────────────────────
  const handleLoginSuccess = (user: User) => {
    try {
      localStorage.setItem('sanjivani_auth_user', JSON.stringify(user))
    } catch (err) {
      console.warn('Unable to persist auth user:', err)
    }
    setCurrentUser(user)
    if (user.user_type === 'doctor') {
      setCurrentView('doctor_portal')
    } else {
      setCurrentView('patient_dashboard')
      loadDashboard(user.id)
      setState((s) => ({
        ...s,
        abhaLinked: true,
        abhaId: user.abha_id,
      }))
    }
  }

  const handleStartIntake = () => {
    setCurrentView('intake')
  }

  const handleBackToDashboard = () => {
    if (currentUser) {
      loadDashboard(currentUser.id)
    }
    setCurrentView('patient_dashboard')
  }

  const handleOpenProfile = () => {
    setCurrentView('patient_profile')
  }

  const handleSaveProfile = (updatedUser: User) => {
    try {
      localStorage.setItem('sanjivani_auth_user', JSON.stringify(updatedUser))
    } catch (err) {
      console.warn('Unable to persist updated profile:', err)
    }
    setCurrentUser(updatedUser)
    loadDashboard(updatedUser.id)
  }

  // ── Auto-initialize dynamic AI opening greeting ───────────────────────────
  useEffect(() => {
    if (currentView !== 'intake') return

    const hasUserMessage = state.messages.some((m) => m.role === 'user')
    if (hasUserMessage) return

    const isOnlyInitialAssistant =
      state.messages.length === 1 && state.messages[0].role === 'assistant'

    if (
      state.messages.length === 0 ||
      (isOnlyInitialAssistant && lastFetchedLangRef.current !== state.language)
    ) {
      let isSubscribed = true
      setChatLoading(true)
      setChatError(null)

      getInitialGreeting(state.language, currentUser?.name)
        .then((res) => {
          if (!isSubscribed) return
          lastFetchedLangRef.current = state.language
          const assistantMsg: ChatMessage = {
            id: newId(),
            role: 'assistant',
            content: res.greeting,
            timestamp: new Date(),
            quickReplies: res.suggested_quick_replies,
          }
          setState((s) => ({
            ...s,
            messages: [assistantMsg],
          }))
        })
        .catch((err) => {
          if (!isSubscribed) return
          console.warn('Initial greeting fetch failed or timed out, applying client fallback greeting:', err)
          lastFetchedLangRef.current = state.language
          const fallback = CLIENT_FALLBACK_GREETINGS[state.language] || CLIENT_FALLBACK_GREETINGS.en
          const assistantMsg: ChatMessage = {
            id: newId(),
            role: 'assistant',
            content: fallback.greeting,
            timestamp: new Date(),
            quickReplies: fallback.chips,
          }
          setState((s) => ({
            ...s,
            messages: [assistantMsg],
          }))
        })
        .finally(() => {
          if (isSubscribed) setChatLoading(false)
        })

      return () => {
        isSubscribed = false
      }
    }
  }, [state.language, currentView, currentUser?.name, state.messages])

  // ── Language ────────────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback((code: LanguageCode) => {
    try {
      localStorage.setItem('sanjivani_language', code)
    } catch (err) {
      console.warn('Unable to persist language preference:', err)
    }
    setState((s) => {
      const languageChanged = s.language !== code
      return {
        ...s,
        language: code,
        ...(languageChanged
          ? {
              aiSummaryText: null,
              aiSummarySections: null,
              summaryLanguage: null,
            }
          : {}),
      }
    })
  }, [])

  // ── Chat ────────────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (text: string) => {
    setChatError(null)

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    const updatedMessages = [...state.messages, userMsg]
    setState((s) => ({
      ...s,
      messages: updatedMessages,
      aiSummaryText: null,
      aiSummarySections: null,
    }))
    setChatLoading(true)

    try {
      const historyPayload: ChatHistoryEntry[] = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await sendChatMessage(
        text,
        state.language,
        historyPayload,
        state.clinicalRecord,
      )

      const record = response.data
      const isRedFlag = Boolean(record.red_flag_alert)

      const assistantContent = record.next_question_to_ask_patient ??
        'Thank you for sharing. Could you tell me more?'

      const quickReplies: string[] = record.suggested_quick_replies ?? []

      const assistantMsg: ChatMessage = {
        id: newId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        quickReplies,
        hasRedFlag: isRedFlag,
      }

      setState((s) => ({
        ...s,
        messages: [...s.messages, assistantMsg],
        clinicalRecord: record,
        redFlagActive: s.redFlagActive || isRedFlag,
      }))
    } catch (err) {
      const msg = extractErrorMessage(err)
      setChatError(msg)
    } finally {
      setChatLoading(false)
    }
  }, [state.messages, state.language, state.clinicalRecord])

  // ── Chat End / Continue / Restart ───────────────────────────────────────────
  const handleEndChat = useCallback(() => {
    setState((s) => ({ ...s, chatStatus: 'ended' }))
  }, [])

  const handleContinueChat = useCallback(() => {
    setState((s) => ({ ...s, chatStatus: 'active' }))
  }, [])

  const handleRestartChat = useCallback(() => {
    lastFetchedLangRef.current = null
    setState((s) => ({
      ...s,
      messages: [],
      chatStatus: 'active',
      clinicalRecord: null,
      redFlagActive: false,
      aiSummaryText: null,
      aiSummarySections: null,
    }))
    setChatError(null)
  }, [])

  // ── Document Scanner (multi-document) ────────────────────────────────────────
  const handleAddDocument = useCallback(async (file: File | Blob, filename = 'document.png') => {
    setScanError(null)
    setScanLoading(true)

    const previewUrl = URL.createObjectURL(file)
    const docId = newId()

    try {
      const response = await scanDocument(file, filename)
      const newDoc: ScannedDocument = {
        id: docId,
        filename,
        previewUrl,
        result: response.data,
      }
      setState((s) => ({
        ...s,
        scannedDocuments: [...s.scannedDocuments, newDoc],
        aiSummaryText: null,
        aiSummarySections: null,
      }))
    } catch (err) {
      URL.revokeObjectURL(previewUrl)
      setScanError(extractErrorMessage(err))
    } finally {
      setScanLoading(false)
    }
  }, [])

  const handleRemoveDocument = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      scannedDocuments: s.scannedDocuments.filter((d) => d.id !== id),
      aiSummaryText: null,
      aiSummarySections: null,
    }))
    // Also delete from database if saved
    deletePatientDocument(id).catch(() => {})
  }, [])

  const handleDeletePatientDocument = async (docId: string) => {
    try {
      await deletePatientDocument(docId)
      setState((s) => ({
        ...s,
        scannedDocuments: s.scannedDocuments.filter((d) => d.id !== docId),
      }))
      if (currentUser) {
        await loadDashboard(currentUser.id)
      }
    } catch (err) {
      alert('Failed to delete document: ' + extractErrorMessage(err))
    }
  }

  const handleDeleteIntakeSession = async (sessionId: string) => {
    try {
      await deleteIntakeSession(sessionId)
      if (currentUser) {
        await loadDashboard(currentUser.id)
      }
    } catch (err) {
      alert('Failed to delete consultation session: ' + extractErrorMessage(err))
    }
  }

  // ── Submit Details to Health Record Database ──────────────────────────────
  const handleSubmitDetails = async () => {
    if (!currentUser) return
    setIsSubmittingDetails(true)
    try {
      const payload = {
        patient_id: currentUser.id,
        language: state.language,
        chat_history: state.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
          quickReplies: m.quickReplies,
        })),
        clinical_record: state.clinicalRecord,
        scanned_documents: state.scannedDocuments.map((d) => ({
          id: d.id,
          filename: d.filename,
          file_type: 'prescription',
          previewUrl: d.previewUrl,
          result: d.result,
        })),
        ai_summary_text: state.aiSummaryText,
        ai_summary_sections: state.aiSummarySections,
        red_flag_active: state.redFlagActive,
      }

      await saveIntakeSession(payload)
      setSubmitNotice('Clinical intake and prescriptions successfully saved to your health record!')
      await loadDashboard(currentUser.id)
      setCurrentView('patient_dashboard')
      setTimeout(() => setSubmitNotice(null), 6000)
    } catch (err) {
      alert('Failed to save details: ' + extractErrorMessage(err))
    } finally {
      setIsSubmittingDetails(false)
    }
  }

  // ── Summary Modal ──────────────────────────────────────────────────────────
  const handleGenerateSummary = useCallback(async () => {
    const currentLang = state.language
    setState((s) => ({ ...s, summaryLoading: true, aiSummaryText: null, aiSummarySections: null }))
    try {
      const history: ChatHistoryEntry[] = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await generateSummary(
        currentLang,
        history,
        state.clinicalRecord,
        state.scannedDocuments,
      )

      setState((s) => ({
        ...s,
        aiSummaryText: res.summary_text,
        aiSummarySections: res.summary_sections,
        summaryLanguage: currentLang,
        summaryLoading: false,
      }))
    } catch (err) {
      console.error('Summary generation error:', err)
      setState((s) => ({ ...s, summaryLoading: false }))
    }
  }, [state.language, state.messages, state.clinicalRecord, state.scannedDocuments])

  const handleSummaryOpen = useCallback(() => {
    setState((s) => ({ ...s, summaryOpen: true }))
    if ((!state.aiSummaryText || state.summaryLanguage !== state.language) && !state.summaryLoading) {
      handleGenerateSummary()
    }
  }, [state.aiSummaryText, state.summaryLanguage, state.language, state.summaryLoading, handleGenerateSummary])

  // Automatically regenerate summary if open when language changes
  useEffect(() => {
    if (state.summaryOpen && (!state.aiSummaryText || state.summaryLanguage !== state.language) && !state.summaryLoading) {
      handleGenerateSummary()
    }
  }, [state.summaryOpen, state.aiSummaryText, state.summaryLanguage, state.language, state.summaryLoading, handleGenerateSummary])

  const handleSummaryClose = useCallback(() => {
    setState((s) => ({ ...s, summaryOpen: false }))
  }, [])

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setState((s) => ({ ...s, activeTab: tab }))
  }, [])

  // ── ROUTE 1: Login Page ────────────────────────────────────────────────────
  if (currentView === 'login' || !currentUser) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        language={state.language}
        onLanguageChange={handleLanguageChange}
      />
    )
  }

  if (currentView === 'doctor_portal' && currentUser.user_type === 'doctor') {
    return (
      <DoctorPortal
        doctor={currentUser}
        onLogout={handleLogout}
        language={state.language}
        onLanguageChange={handleLanguageChange}
      />
    )
  }

  // ── ROUTE 3: Patient Dashboard ─────────────────────────────────────────────
  if (currentView === 'patient_dashboard') {
    return (
      <div className="relative">
        {submitNotice && (
          <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-600 text-white shadow-xl flex items-center gap-3 animate-fade-in text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{submitNotice}</span>
          </div>
        )}
        <PatientDashboard
          patient={currentUser}
          dashboardData={dashboardData}
          isLoading={dashboardLoading}
          language={state.language}
          onLanguageChange={handleLanguageChange}
          onStartIntake={handleStartIntake}
          onOpenProfile={handleOpenProfile}
          onLogout={handleLogout}
          onDeleteDocument={handleDeletePatientDocument}
          onDeleteIntakeSession={handleDeleteIntakeSession}
        />
      </div>
    )
  }

  // ── ROUTE 4: Patient Profile (Personal details & demographics) ──────────────
  if (currentView === 'patient_profile' && currentUser) {
    return (
      <PatientProfile
        patient={currentUser}
        onSave={handleSaveProfile}
        onBackToDashboard={handleBackToDashboard}
      />
    )
  }

  // ── ROUTE 5: Current Intake Consultation Webpage ───────────────────────────
  return (
    <div className="flex flex-col h-screen bg-surface-muted dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors">
      {/* ── Header ── */}
      <Header
        language={state.language}
        onLanguageChange={handleLanguageChange}
        abhaLinked={state.abhaLinked}
        abhaId={state.abhaId}
        onSummaryOpen={handleSummaryOpen}
        user={currentUser}
        onBackToDashboard={handleBackToDashboard}
        onOpenProfile={handleOpenProfile}
        onSubmitDetails={handleSubmitDetails}
        isSubmitting={isSubmittingDetails}
      />

      {/* ── Red Flag Emergency Banner ── */}
      {state.redFlagActive && (
        <RedFlagAlert
          onDismiss={() => setState((s) => ({ ...s, redFlagActive: false }))}
        />
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-hidden relative">
        {/* ===== DESKTOP: Dual-panel side-by-side layout (>=md) ===== */}
        <div className="hidden md:flex h-full max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 gap-4">
          {/* Left: Chat Interface (Intake conversation) */}
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 rounded-2xl border border-surface-border dark:border-slate-800 shadow-card overflow-hidden transition-colors">
            <div className="px-4 py-2.5 border-b border-surface-border dark:border-slate-800 bg-surface-muted dark:bg-slate-850 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Clinical Intake Consultation</span>
              {state.chatStatus === 'ended' && (
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full">
                  Chat Completed
                </span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                messages={state.messages}
                isLoading={chatLoading}
                error={chatError}
                language={state.language}
                chatStatus={state.chatStatus}
                onSendMessage={handleSendMessage}
                onEndChat={handleEndChat}
                onContinueChat={handleContinueChat}
                onRestartChat={handleRestartChat}
              />
            </div>
          </div>

          {/* Right: Document Scanner */}
          <div className="w-[420px] xl:w-[480px] flex flex-col flex-shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-surface-border dark:border-slate-800 shadow-card overflow-hidden transition-colors">
            <div className="px-4 py-2.5 border-b border-surface-border dark:border-slate-800 bg-surface-muted dark:bg-slate-850 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Medical Document Scanner</span>
              {state.scannedDocuments.length > 0 && (
                <span className="text-xs font-semibold text-brand-cyan bg-brand-cyan/10 dark:bg-brand-cyan/20 px-2 py-0.5 rounded-full">
                  {state.scannedDocuments.length} uploaded
                </span>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <ScannerPanel
                documents={state.scannedDocuments}
                isLoading={scanLoading}
                error={scanError}
                onAddDocument={handleAddDocument}
                onRemoveDocument={handleRemoveDocument}
              />
            </div>
          </div>
        </div>

        {/* ===== MOBILE / TABLET: Tabbed single-panel layout (<md) ===== */}
        <div className="flex flex-col h-full md:hidden">
          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {state.activeTab === 'chat' ? (
              <ChatInterface
                messages={state.messages}
                isLoading={chatLoading}
                error={chatError}
                language={state.language}
                chatStatus={state.chatStatus}
                onSendMessage={handleSendMessage}
                onEndChat={handleEndChat}
                onContinueChat={handleContinueChat}
                onRestartChat={handleRestartChat}
              />
            ) : (
              <ScannerPanel
                documents={state.scannedDocuments}
                isLoading={scanLoading}
                error={scanError}
                onAddDocument={handleAddDocument}
                onRemoveDocument={handleRemoveDocument}
              />
            )}
          </div>

          {/* Bottom Tab Bar */}
          <nav className="flex border-t border-surface-border dark:border-slate-800 bg-white dark:bg-slate-900 safe-area-bottom transition-colors" aria-label="Main navigation">
            {(
              [
                { tab: 'chat' as ActiveTab, label: 'Intake Chat', Icon: MessageSquare },
                { tab: 'scanner' as ActiveTab, label: 'Doc Scanner', Icon: ScanLine },
              ] as const
            ).map(({ tab, label, Icon }) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3
                            transition-colors min-h-[56px]
                            ${state.activeTab === tab
                              ? 'text-brand-cyan border-t-2 border-brand-cyan -mt-px bg-brand-cyan-light/30 dark:bg-brand-cyan/20'
                              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                aria-current={state.activeTab === tab ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}

            {/* Summary shortcut on mobile */}
            <button
              onClick={handleSummaryOpen}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3
                         text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors min-h-[56px]"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[11px] font-medium">Summary</span>
            </button>
          </nav>
        </div>
      </main>

      {/* ── Summary Modal ── */}
      <SummaryModal
        isOpen={state.summaryOpen}
        onClose={handleSummaryClose}
        clinicalRecord={state.clinicalRecord}
        documents={state.scannedDocuments}
        messages={state.messages}
        aiSummaryText={state.aiSummaryText}
        aiSummarySections={state.aiSummarySections}
        summaryLoading={state.summaryLoading}
        onGenerateSummary={handleGenerateSummary}
        language={state.language}
      />
    </div>
  )
}
