import { useState, useCallback, useEffect } from 'react'
import { MessageSquare, ScanLine, LayoutDashboard } from 'lucide-react'
import type {
  IntakeState,
  ChatMessage,
  LanguageCode,
  ChatHistoryEntry,
  ActiveTab,
  ScannedDocument,
} from './types'
import {
  getInitialGreeting,
  sendChatMessage,
  scanDocument,
  generateSummary,
  extractErrorMessage,
} from './services/api'

import Header from './components/Header'
import RedFlagAlert from './components/RedFlagAlert'
import ChatInterface from './components/Chat/ChatInterface'
import ScannerPanel from './components/DocumentScanner/ScannerPanel'
import SummaryModal from './components/ClinicalSummary/SummaryModal'

// ── Lightweight UUID util ────────────────────────────────────────────────────
function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ── Initial state ────────────────────────────────────────────────────────────
const INITIAL_STATE: IntakeState = {
  language: 'en',
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
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<IntakeState>(INITIAL_STATE)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  // ── Auto-initialize dynamic AI opening greeting ───────────────────────────
  useEffect(() => {
    const isOnlyInitialAssistant =
      state.messages.length === 1 && state.messages[0].role === 'assistant'
    if (state.messages.length === 0 || isOnlyInitialAssistant) {
      let isSubscribed = true
      setChatLoading(true)
      getInitialGreeting(state.language)
        .then((res) => {
          if (!isSubscribed) return
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
          console.warn('Initial greeting fetch failed, using fallback:', err)
          const fallbackMsg: ChatMessage = {
            id: newId(),
            role: 'assistant',
            content:
              state.language === 'hi'
                ? 'नमस्ते! मैं संजीवनी, आपकी क्लिनिकल इनटेक सहायक हूँ। कृपया बताएं कि आज आपको क्या स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?'
                : 'Hello! I am Sanjivani, your AI clinical intake assistant. What health symptoms or discomfort can I help document for you today?',
            timestamp: new Date(),
            quickReplies:
              state.language === 'hi'
                ? ['सिरदर्द / बदन दर्द', 'बुखार, सर्दी या खांसी', 'पेट या पाचन की समस्या', 'सामान्य स्वास्थ्य जांच']
                : ['Headache / Body Ache', 'Fever, Cold or Cough', 'Stomach or Digestion issue', 'General Health Checkup'],
          }
          setState((s) => ({
            ...s,
            messages: [fallbackMsg],
          }))
        })
        .finally(() => {
          if (isSubscribed) setChatLoading(false)
        })

      return () => {
        isSubscribed = false
      }
    }
  }, [state.language, state.messages.length === 0])

  // ── Language ────────────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback((code: LanguageCode) => {
    setState((s) => ({ ...s, language: code }))
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

    setState((s) => ({
      ...s,
      messages: [...s.messages, userMsg],
    }))

    setChatLoading(true)

    try {
      const history: ChatHistoryEntry[] = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await sendChatMessage(
        text,
        state.language,
        history,
        state.clinicalRecord,
      )

      const record = response.data
      const isRedFlag = record.red_flag_alert === true

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
    // Reset chat and clinical record only; keep scannedDocuments and language
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

    // Generate a temporary preview URL
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
        // Invalidate any prior AI summary since data changed
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
      // Invalidate AI summary since documents changed
      aiSummaryText: null,
      aiSummarySections: null,
    }))
  }, [])

  // ── Summary Modal ──────────────────────────────────────────────────────────
  const handleGenerateSummary = useCallback(async () => {
    setState((s) => ({ ...s, summaryLoading: true, aiSummaryText: null, aiSummarySections: null }))
    try {
      const history: ChatHistoryEntry[] = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const result = await generateSummary(
        state.language,
        history,
        state.clinicalRecord,
        state.scannedDocuments,
      )
      setState((s) => ({
        ...s,
        aiSummaryText: result.summary_text,
        aiSummarySections: result.summary_sections,
        summaryLoading: false,
      }))
    } catch (err) {
      console.error('Summary generation failed:', err)
      const errorMsg = extractErrorMessage(err)
      setState((s) => ({
        ...s,
        aiSummaryText: errorMsg || 'Summary generation failed. Please try again.',
        aiSummarySections: null,
        summaryLoading: false,
      }))
    }
  }, [state.messages, state.language, state.clinicalRecord, state.scannedDocuments])

  const handleSummaryOpen = useCallback(() => {
    setState((s) => ({ ...s, summaryOpen: true }))
    if (!state.aiSummaryText && !state.summaryLoading) {
      handleGenerateSummary()
    }
  }, [state.aiSummaryText, state.summaryLoading, handleGenerateSummary])

  const handleSummaryClose = useCallback(() => setState((s) => ({ ...s, summaryOpen: false })), [])

  // ── Red Flag Dismiss ───────────────────────────────────────────────────────
  const handleRedFlagDismiss = useCallback(() => {
    setState((s) => ({ ...s, redFlagActive: false }))
  }, [])

  // ── Tab Navigation (mobile) ────────────────────────────────────────────────
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setState((s) => ({ ...s, activeTab: tab }))
  }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const redFlagMessage = state.clinicalRecord?.next_question_to_ask_patient

  return (
    <div className="flex flex-col h-screen bg-surface-base overflow-hidden">

      {/* ── Header ── */}
      <Header
        language={state.language}
        onLanguageChange={handleLanguageChange}
        abhaLinked={state.abhaLinked}
        abhaId={state.abhaId}
        onSummaryOpen={handleSummaryOpen}
      />

      {/* ── Red Flag Alert ── */}
      {state.redFlagActive && (
        <RedFlagAlert
          message={typeof redFlagMessage === 'string' && redFlagMessage.toLowerCase().includes('emergency')
            ? redFlagMessage
            : undefined}
          onDismiss={handleRedFlagDismiss}
        />
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-hidden">

        {/* ===== DESKTOP: Side-by-side dual-panel layout (md+) ===== */}
        <div className="hidden md:flex h-full">

          {/* Left Panel — Chat */}
          <div className="w-[52%] xl:w-[55%] h-full flex flex-col border-r border-surface-border">
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-surface-border">
              <MessageSquare className="w-4 h-4 text-brand-cyan" />
              <span className="text-sm font-semibold text-slate-700">Clinical Intake Chat</span>
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

          {/* Right Panel — Document Scanner */}
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-surface-border">
              <ScanLine className="w-4 h-4 text-brand-cyan" />
              <span className="text-sm font-semibold text-slate-700">Medical Document Scanner</span>
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
          <nav className="flex border-t border-surface-border bg-white safe-area-bottom" aria-label="Main navigation">
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
                              ? 'text-brand-cyan border-t-2 border-brand-cyan -mt-px bg-brand-cyan-light/30'
                              : 'text-slate-400 hover:text-slate-600'
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
                         text-slate-400 hover:text-slate-600 transition-colors min-h-[56px]"
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
      />
    </div>
  )
}
