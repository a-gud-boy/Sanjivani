import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Mic, MicOff, Send, Loader2, StopCircle, PhoneOff, X } from 'lucide-react'
import type { ChatMessage, ChatStatus, LanguageCode } from '../../types'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useSpeechRecognition, SPEECH_LANG_MAP } from '../../hooks/useSpeechRecognition'
import { transcribeAudio } from '../../services/api'
import ChatBubble from './ChatBubble'
import QuickReplyChips from './QuickReplyChips'
import ChatEndOverlay from './ChatEndOverlay'
import { useTranslation, MULTILINGUAL_END_INTENT_PHRASES } from '../../i18n/translations'

// AI-04: Multilingual end-intent recognition across 7 Indian languages
const ALL_END_INTENT_PHRASES = Object.values(MULTILINGUAL_END_INTENT_PHRASES).flat()

export function hasEndIntent(text: string, language?: LanguageCode): boolean {
  const lower = text.toLowerCase().trim()
  if (!lower) return false

  if (language && MULTILINGUAL_END_INTENT_PHRASES[language]) {
    const langPhrases = MULTILINGUAL_END_INTENT_PHRASES[language]
    if (langPhrases.some((phrase) => lower.includes(phrase.toLowerCase()))) {
      return true
    }
  }
  return ALL_END_INTENT_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()))
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
  const t = useTranslation(language)
  const [inputText, setInputText] = useState('')
  const [endIntentBanner, setEndIntentBanner] = useState(false)
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false)
  const [transcriptionNotice, setTranscriptionNotice] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Primary: Native Web Speech API recognition
  const {
    isListening: isSpeechListening,
    isSupported: isSpeechSupported,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language,
    onTranscriptChange: (text, isFinal) => {
      if (isFinal && text.trim()) {
        setInputText((prev) => (prev ? `${prev.trim()} ${text.trim()}` : text.trim()))
      }
    },
  })

  // Fallback: Audio recording via MediaRecorder when SpeechRecognition is not supported
  const {
    isRecording,
    recorderState,
    audioBlob,
    durationSeconds,
    startRecording,
    stopRecording,
    reset: resetAudioRecorder,
    error: recordingError,
  } = useAudioRecorder()

  // Process audio recording fallback when SpeechRecognition is not supported
  useEffect(() => {
    if (audioBlob && !isSpeechSupported) {
      setIsTranscribingAudio(true)
      setTranscriptionNotice('Transcribing audio recording...')
      transcribeAudio(audioBlob, language)
        .then((res) => {
          if (res?.transcript?.trim()) {
            setInputText((prev) => (prev ? `${prev.trim()} ${res.transcript.trim()}` : res.transcript.trim()))
            setTranscriptionNotice(null)
          } else {
            setTranscriptionNotice('Could not transcribe audio. Please try typing or speak louder.')
          }
        })
        .catch((err) => {
          console.error('Audio transcription error:', err)
          setTranscriptionNotice('Voice transcription service unavailable. Please type your message.')
        })
        .finally(() => {
          setIsTranscribingAudio(false)
          resetAudioRecorder()
        })
    }
  }, [audioBlob, isSpeechSupported, language, resetAudioRecorder])

  // Clear notice after 6 seconds
  useEffect(() => {
    if (transcriptionNotice) {
      const timer = setTimeout(() => setTranscriptionNotice(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [transcriptionNotice])

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
    if (hasEndIntent(text, language)) {
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
    if (isSpeechSupported) {
      if (isSpeechListening) {
        if (interimTranscript.trim()) {
          setInputText((prev) => (prev ? `${prev.trim()} ${interimTranscript.trim()}` : interimTranscript.trim()))
        }
        stopListening()
      } else {
        resetTranscript()
        startListening(language)
      }
    } else {
      if (isRecording) {
        stopRecording()
      } else {
        await startRecording()
      }
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
    <div className="flex flex-col h-full relative bg-surface-base dark:bg-slate-950 transition-colors">

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
            <div className="w-14 h-14 rounded-2xl bg-brand-cyan/10 dark:bg-brand-cyan/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-brand-cyan" fill="none"
                stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-700 dark:text-slate-200 font-semibold text-base">
                Welcome to Sanjivani Clinical Intake
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 max-w-xs">
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
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-200">
              AI
            </div>
            <div className="px-4 py-3 bg-white dark:bg-slate-850 dark:bg-slate-900 border border-surface-border dark:border-slate-800 rounded-2xl rounded-bl-sm shadow-card">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Error */}
        {error && (
          <div className="mx-auto max-w-sm px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60
                          text-red-700 dark:text-red-300 text-sm text-center animate-fade-in">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── End Intent Banner ── */}
      {endIntentBanner && chatStatus === 'active' && (
        <div className="mx-3 mb-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                        flex items-center justify-between gap-3 animate-fade-in">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t.chat.endIntentPrompt || 'Did you mean to end the chat?'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setEndIntentBanner(false)}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1 rounded-lg
                         hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              {t.chat.endIntentNo || 'No'}
            </button>
            <button
              onClick={() => { setEndIntentBanner(false); onEndChat() }}
              className="text-xs font-semibold text-brand-cyan hover:text-brand-cyan-dark
                         px-2 py-1 rounded-lg hover:bg-brand-cyan-light dark:hover:bg-brand-cyan-light/20 transition-colors inline-flex items-center gap-1.5"
            >
              <PhoneOff className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              {t.chat.endIntentYes || 'Yes, End Chat'}
            </button>
          </div>
        </div>
      )}

      {/* ── Quick Reply Chips ── */}
      {!isLoading && chatStatus === 'active' && (
        <QuickReplyChips
          chips={visibleChips}
          onSelect={(text) => {
            if (hasEndIntent(text, language)) {
              setEndIntentBanner(true)
            }
            setInputText('')
            onSendMessage(text)
          }}
          disabled={isLoading}
        />
      )}

      {/* ── Input Toolbar ── */}
      <div className="px-3 pb-3 pt-2 border-t border-surface-border dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">

        {/* End Chat button — only visible after first user message */}
        {hasUserMessage && chatStatus === 'active' && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onEndChat}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500
                         hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-1.5 rounded-xl
                         border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition-all duration-150"
              aria-label="End chat session"
            >
              <PhoneOff className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              {t.chat.finishChat}
            </button>
          </div>
        )}

        {/* Active Speech Recognition Banner */}
        {isSpeechListening && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-brand-cyan/10 dark:bg-brand-cyan/20 border border-brand-cyan/30 rounded-xl text-xs text-brand-cyan-dark dark:text-brand-cyan">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Listening ({SPEECH_LANG_MAP[language] || language})
            </span>
            <span className="truncate italic flex-1 text-slate-700 dark:text-slate-200">
              {interimTranscript || 'Speak your symptoms now...'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (interimTranscript.trim()) {
                  setInputText((prev) => (prev ? `${prev.trim()} ${interimTranscript.trim()}` : interimTranscript.trim()))
                }
                stopListening()
              }}
              className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-cyan text-white hover:bg-brand-cyan-dark"
            >
              Done
            </button>
          </div>
        )}

        {/* Server Transcription Progress */}
        {isTranscribingAudio && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>Transcribing recorded voice through Sanjivani AI...</span>
          </div>
        )}

        {/* Transcription Notice / Feedback */}
        {transcriptionNotice && !isTranscribingAudio && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300">
            <span>{transcriptionNotice}</span>
            <button type="button" onClick={() => setTranscriptionNotice(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">

          {/* Microphone Button */}
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={isLoading || chatStatus === 'ended' || isTranscribingAudio}
            aria-label={
              isSpeechListening
                ? 'Stop voice listening'
                : isRecording
                ? 'Stop recording'
                : `${t.chat.speak} (${SPEECH_LANG_MAP[language] || language})`
            }
            title={
              isSpeechListening
                ? 'Listening... Click to stop'
                : `Voice Input (${SPEECH_LANG_MAP[language] || language})`
            }
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center
                        transition-all duration-200 disabled:opacity-40
                        ${isSpeechListening || isRecording
                          ? 'bg-brand-crimson text-white mic-ring shadow-lg animate-pulse'
                          : 'bg-surface-muted dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
          >
            {isTranscribingAudio ? (
              <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" aria-hidden="true" />
            ) : isSpeechListening || isRecording ? (
              <StopCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            ) : speechError || recorderState === 'error' ? (
              <MicOff className="w-5 h-5 text-red-400 flex-shrink-0" aria-hidden="true" />
            ) : (
              <Mic className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            )}
            {isRecording && (
              <span className="text-[9px] font-mono mt-0.5 leading-none">
                {fmtDuration(durationSeconds)}
              </span>
            )}
            {isSpeechListening && (
              <span className="text-[9px] font-mono mt-0.5 leading-none uppercase">
                {language}
              </span>
            )}
          </button>

          {/* Recording / Speech error nudge */}
          {(recordingError || speechError) && (
            <p className="absolute bottom-20 left-4 right-4 text-center text-xs text-red-500 bg-white
                           border border-red-200 rounded-xl px-3 py-2 shadow-card z-10">
              {speechError || recordingError}
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
                  ? t.chat.chatCompleted
                  : t.chat.inputPlaceholder
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
            aria-label={t.chat.send}
          >
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" aria-hidden="true" />
              : <Send className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            }
          </button>
        </form>
      </div>
    </div>
  )
}

