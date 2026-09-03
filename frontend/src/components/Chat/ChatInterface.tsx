import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Mic, MicOff, Send, Loader2, StopCircle, PhoneOff } from 'lucide-react'
import type { ChatMessage, ChatStatus, LanguageCode } from '../../types'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import ChatBubble from './ChatBubble'
import QuickReplyChips from './QuickReplyChips'
import ChatEndOverlay from './ChatEndOverlay'

// Client-side heuristic: phrases that suggest the user is done
const END_INTENT_PHRASES = [
  'done', "that's all", "thats all", 'finished', 'end chat', 'end the chat',
  'bye', 'goodbye', 'thank you', 'thanks', 'no more', "i'm done", "im done",
  'done sharing', 'enough', 'nothing else', 'that is all', 'stop', 'exit',
]

function hasEndIntent(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return END_INTENT_PHRASES.some((phrase) => lower.includes(phrase))
}

interface ChatInterfaceProps {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  language: LanguageCode
  chatStatus: ChatStatus
  onSendMessage: (text: string) => void
  onEndChat: () => void
  onContinueChat: () => void
  onRestartChat: () => void
}

export default function ChatInterface({
  messages,
  isLoading,
  error,
  language,
  chatStatus,
  onSendMessage,
  onEndChat,
  onContinueChat,
  onRestartChat,
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('')
  const [endIntentBanner, setEndIntentBanner] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    isRecording,
    recorderState,
    durationSeconds,
    startRecording,
    stopRecording,
    audioBlob: _audioBlob,
    error: recordingError,
  } = useAudioRecorder()

  // Auto-scroll to bottom
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

  // Dismiss end-intent banner when chat is reactivated
  useEffect(() => {
    if (chatStatus === 'active') setEndIntentBanner(false)
  }, [chatStatus])

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const text = inputText.trim()
    if (!text || isLoading) return

    // Client-side end-intent detection
    if (hasEndIntent(text)) {
      setEndIntentBanner(true)
    }

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

  const fmtDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Chips from last assistant message (filtered defensively so they are always patient answers)
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const rawChips = lastAssistant?.quickReplies ?? []
  const visibleChips = rawChips.filter(
    (chip) => !chip.trim().endsWith('?') && !/^(when|how|why|what|where)\b/i.test(chip.trim())
  )

  // Show End Chat button after at least one user message
  const hasUserMessage = messages.some((m) => m.role === 'user')

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Chat Ended Overlay ── */}
      {chatStatus === 'ended' && (
        <ChatEndOverlay onContinue={onContinueChat} onRestart={onRestartChat} />
      )}

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
                Describe your symptoms to begin your clinical consultation.
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

      {/* ── End Intent Banner ── */}
      {endIntentBanner && chatStatus === 'active' && (
        <div className="mx-3 mb-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200
                        flex items-center justify-between gap-3 animate-fade-in">
          <p className="text-xs text-slate-600">Did you mean to end the chat?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setEndIntentBanner(false)}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg
                         hover:bg-slate-100 transition-colors"
            >
              No
            </button>
            <button
              onClick={() => { setEndIntentBanner(false); onEndChat() }}
              className="text-xs font-semibold text-brand-cyan hover:text-brand-cyan-dark
                         px-2 py-1 rounded-lg hover:bg-brand-cyan-light transition-colors"
            >
              Yes, End Chat
            </button>
          </div>
        </div>
      )}

      {/* ── Quick Reply Chips ── */}
      {!isLoading && chatStatus === 'active' && (
        <QuickReplyChips
          chips={visibleChips}
          onSelect={(text) => {
            setInputText('')
            onSendMessage(text)
          }}
          disabled={isLoading}
        />
      )}

      {/* ── Input Toolbar ── */}
      <div className="px-3 pb-3 pt-2 border-t border-surface-border bg-white">

        {/* End Chat button — only visible after first user message */}
        {hasUserMessage && chatStatus === 'active' && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onEndChat}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400
                         hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl
                         border border-transparent hover:border-red-200 transition-all duration-150"
              aria-label="End chat session"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              End Chat
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">

          {/* Microphone Button */}
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={isLoading || chatStatus === 'ended'}
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
                chatStatus === 'ended'
                  ? 'Chat has ended. Click Continue to resume.'
                  : language === 'hi' ? 'अपने लक्षण बताएं…'
                  : language === 'bn' ? 'আপনার লক্ষণ বলুন…'
                  : 'Describe your symptoms or ask a question…'
              }
              rows={1}
              disabled={isLoading || chatStatus === 'ended'}
              className="input resize-none pr-2 py-3 min-h-[48px] max-h-[120px]
                         leading-relaxed overflow-hidden disabled:opacity-50"
              aria-label="Type your message"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading || chatStatus === 'ended'}
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

