import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Mic, MicOff, Send, Loader2, StopCircle } from 'lucide-react'
import type { ChatMessage, LanguageCode } from '../../types'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import ChatBubble from './ChatBubble'
import QuickReplyChips from './QuickReplyChips'

interface ChatInterfaceProps {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  language: LanguageCode
  onSendMessage: (text: string) => void
}

/** Default clinical quick-reply chips to seed the initial conversation */
const SEED_CHIPS = [
  '1–3 Days', '1 Week', 'More than 2 weeks',
  'Sharp Pain', 'Dull Ache', 'Burning', 'Pressure',
  'No Prior Allergies', 'Yes, I have allergies',
  'Mild (1–3)', 'Moderate (4–6)', 'Severe (7–10)',
]

export default function ChatInterface({
  messages,
  isLoading,
  error,
  language,
  onSendMessage,
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    isRecording,
    recorderState,
    durationSeconds,
    startRecording,
    stopRecording,
    audioBlob: _audioBlob, // reserved for future backend transcription
    error: recordingError,
  } = useAudioRecorder()

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [inputText])

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const text = inputText.trim()
    if (!text || isLoading) return
    onSendMessage(text)
    setInputText('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleMicToggle = async () => {
    if (isRecording) {
      stopRecording()
    } else {
      await startRecording()
    }
  }

  // Format recording duration as MM:SS
  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Chips: show seed chips when empty, or last assistant's quick replies
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const visibleChips = messages.length === 0
    ? SEED_CHIPS
    : (lastAssistant?.quickReplies ?? [])

  return (
    <div className="flex flex-col h-full">

      {/* ── Message Feed ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin"
        aria-label="Chat conversation"
        aria-live="polite"
      >
        {/* Welcome prompt when empty */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-10">
            <div className="w-14 h-14 rounded-2xl bg-brand-cyan/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-brand-cyan" fill="none"
                stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-700 font-semibold text-base">
                Welcome to Sanjivani Clinical Intake
              </p>
              <p className="text-slate-400 text-sm mt-1 max-w-xs">
                Describe your symptoms or tap a quick reply below to begin your consultation.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex items-end gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
              AI
            </div>
            <div className="px-4 py-3 bg-white border border-surface-border rounded-2xl rounded-bl-sm shadow-card">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Error */}
        {error && (
          <div className="mx-auto max-w-sm px-4 py-3 rounded-xl bg-red-50 border border-red-200
                          text-red-700 text-sm text-center animate-fade-in">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Reply Chips ── */}
      {!isLoading && (
        <QuickReplyChips
          chips={visibleChips}
          onSelect={(text) => {
            setInputText(text)
            onSendMessage(text)
          }}
          disabled={isLoading}
        />
      )}

      {/* ── Input Toolbar ── */}
      <div className="px-3 pb-3 pt-2 border-t border-surface-border bg-white">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">

          {/* Microphone Button */}
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={isLoading}
            aria-label={isRecording ? 'Stop recording' : 'Hold to speak'}
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center
                        transition-all duration-200 disabled:opacity-40
                        ${isRecording
                          ? 'bg-brand-crimson text-white mic-ring shadow-lg'
                          : 'bg-surface-muted text-slate-600 hover:bg-slate-200'
                        }`}
          >
            {isRecording
              ? <StopCircle className="w-5 h-5" />
              : recorderState === 'error'
              ? <MicOff className="w-5 h-5 text-red-400" />
              : <Mic className="w-5 h-5" />
            }
            {isRecording && (
              <span className="text-[9px] font-mono mt-0.5 leading-none">
                {fmtDuration(durationSeconds)}
              </span>
            )}
          </button>

          {/* Recording error nudge */}
          {recordingError && (
            <p className="absolute bottom-20 left-4 right-4 text-center text-xs text-red-500 bg-white
                           border border-red-200 rounded-xl px-3 py-2 shadow-card z-10">
              {recordingError}
            </p>
          )}

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === 'hi' ? 'अपने लक्षण बताएं…'
                : language === 'bn' ? 'আপনার লক্ষণ বলুন…'
                : 'Describe your symptoms or ask a question…'
              }
              rows={1}
              disabled={isLoading}
              className="input resize-none pr-2 py-3 min-h-[48px] max-h-[120px]
                         leading-relaxed overflow-hidden disabled:opacity-50"
              aria-label="Type your message"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="flex-shrink-0 w-12 h-12 rounded-xl bg-brand-cyan text-white flex items-center
                       justify-center shadow-sm hover:bg-brand-cyan-dark active:scale-95
                       transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Send className="w-5 h-5" />
            }
          </button>
        </form>
      </div>
    </div>
  )
}
