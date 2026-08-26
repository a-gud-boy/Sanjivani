import { useState, useCallback } from 'react'
import { MessageSquare, ScanLine, LayoutDashboard } from 'lucide-react'
import type {
  IntakeState,
  ChatMessage,
  LanguageCode,
  ChatHistoryEntry,
  ActiveTab,
} from './types'
import { sendChatMessage, scanDocument, extractErrorMessage } from './services/api'

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
  clinicalRecord: null,
  redFlagActive: false,
  scanResult: null,
  activeTab: 'chat',
  summaryOpen: false,
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<IntakeState>(INITIAL_STATE)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  // ── Language ────────────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback((code: LanguageCode) => {
    setState((s) => ({ ...s, language: code }))
  }, [])

  // ── Chat ────────────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (text: string) => {
    setChatError(null)

    // Append user message immediately
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
      // Build history from current messages (before appending the new one)
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

      // Build assistant message from the next question
      const assistantContent = record.next_question_to_ask_patient ??
        'Thank you for sharing. Could you tell me more?'

      // Dynamic AI-generated quick-reply chips from clinical record
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

  // ── Document Scanner ────────────────────────────────────────────────────────
  const handleScanFile = useCallback(async (file: File | Blob) => {
    setScanError(null)
    setScanLoading(true)

    try {
      const response = await scanDocument(file)
      setState((s) => ({ ...s, scanResult: response.data }))
    } catch (err) {
      setScanError(extractErrorMessage(err))
    } finally {
      setScanLoading(false)
    }
  }, [])

  const handleScanReset = useCallback(() => {
    setState((s) => ({ ...s, scanResult: null }))
    setScanError(null)
  }, [])

  // ── Summary Modal ──────────────────────────────────────────────────────────
  const handleSummaryOpen = useCallback(() => setState((s) => ({ ...s, summaryOpen: true })), [])
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

      {/* ── Red Flag Alert (sits below header, above content) ── */}
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
                onSendMessage={handleSendMessage}
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
                isLoading={scanLoading}
                error={scanError}
                scanResult={state.scanResult}
                onScanFile={handleScanFile}
                onReset={handleScanReset}
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
                onSendMessage={handleSendMessage}
              />
            ) : (
              <ScannerPanel
                isLoading={scanLoading}
                error={scanError}
                scanResult={state.scanResult}
                onScanFile={handleScanFile}
                onReset={handleScanReset}
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
        scanResult={state.scanResult}
        messages={state.messages}
      />
    </div>
  )
}
