import { useState, useRef, useCallback, useEffect } from 'react'
import type { LanguageCode } from '../types'

// BCP-47 Language Tag Mapping for Web Speech API in Indian Context
export const SPEECH_LANG_MAP: Record<LanguageCode, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
}

// Minimal Web Speech API typing for TypeScript
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  readonly isFinal: boolean
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

export interface UseSpeechRecognitionOptions {
  language?: LanguageCode
  onTranscriptChange?: (transcript: string, isFinal: boolean) => void
}

export interface UseSpeechRecognitionReturn {
  /** True while speech recognition is actively listening */
  isListening: boolean
  /** Whether the current browser supports Web Speech API */
  isSupported: boolean
  /** Accumulated finalized transcript */
  transcript: string
  /** Current active unfinalized interim speech */
  interimTranscript: string
  /** Error message if any occurred */
  error: string | null
  /** Begin speech recognition in the target language */
  startListening: (lang?: LanguageCode) => void
  /** End speech recognition */
  stopListening: () => void
  /** Reset transcripts and clear errors */
  resetTranscript: () => void
}

export function useSpeechRecognition({
  language = 'en',
  onTranscriptChange,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const onTranscriptChangeRef = useRef(onTranscriptChange)
  onTranscriptChangeRef.current = onTranscriptChange

  const isSupported =
    typeof window !== 'undefined' &&
    !!(
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    )

  // Initialize recognition instance
  const getRecognition = useCallback(() => {
    if (!isSupported) return null

    if (!recognitionRef.current) {
      const SpeechConstructor =
        (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition

      if (SpeechConstructor) {
        const recognition = new SpeechConstructor()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        recognition.onstart = () => {
          setIsListening(true)
          setError(null)
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = ''
          let currentFinal = ''

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i]
            if (result.isFinal) {
              currentFinal += result[0].transcript
            } else {
              currentInterim += result[0].transcript
            }
          }

          if (currentFinal) {
            setTranscript((prev) => {
              const updated = prev ? `${prev} ${currentFinal.trim()}` : currentFinal.trim()
              onTranscriptChangeRef.current?.(updated, true)
              return updated
            })
          }

          setInterimTranscript(currentInterim)
          if (currentInterim) {
            onTranscriptChangeRef.current?.(currentInterim, false)
          }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setIsListening(false)
          let errMsg = 'Speech recognition error'
          if (event.error === 'not-allowed') {
            errMsg = 'Microphone permission denied. Please enable microphone access.'
          } else if (event.error === 'no-speech') {
            errMsg = 'No speech detected. Please try speaking again.'
          } else if (event.error === 'network') {
            errMsg = 'Speech service network error.'
          } else if (event.error) {
            errMsg = `Speech recognition error: ${event.error}`
          }
          setError(errMsg)
        }

        recognition.onend = () => {
          setIsListening(false)
          setInterimTranscript('')
        }

        recognitionRef.current = recognition
      }
    }

    return recognitionRef.current
  }, [isSupported])

  const startListening = useCallback(
    (lang?: LanguageCode) => {
      const targetLang = lang || language
      const recognition = getRecognition()

      if (!recognition) {
        setError('Voice recognition is not supported in this browser.')
        return
      }

      try {
        setError(null)
        recognition.lang = SPEECH_LANG_MAP[targetLang] || 'en-IN'
        recognition.start()
      } catch (err) {
        // If already started, ignore InvalidStateError
        if (err instanceof DOMException && err.name === 'InvalidStateError') {
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to start voice recognition.')
      }
    },
    [getRecognition, language]
  )

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore if already stopped
      }
    }
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  }
}
