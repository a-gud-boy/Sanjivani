import { useState, useRef, useCallback } from 'react'

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'error'

export interface UseAudioRecorderReturn {
  /** Current state of the recorder */
  recorderState: RecorderState
  /** True while recording is active */
  isRecording: boolean
  /** Resulting audio Blob after stopRecording(), null until available */
  audioBlob: Blob | null
  /** Duration in seconds while recording */
  durationSeconds: number
  /** Human-readable error message, null if none */
  error: string | null
  /** Start capturing microphone audio */
  startRecording: () => Promise<void>
  /** Stop capture and finalise the Blob */
  stopRecording: () => void
  /** Clear the last recorded blob and reset to idle */
  reset: () => void
}

/**
 * useAudioRecorder
 *
 * Captures microphone audio using the MediaRecorder API.
 * The resulting Blob is suitable for sending directly to the backend
 * for server-side transcription or storage.
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    chunksRef.current = []
    setDurationSeconds(0)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not supported in this browser.')
      setRecorderState('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick the best supported MIME type
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setAudioBlob(blob)
        setRecorderState('stopped')
        stopStream()
      }

      recorder.onerror = () => {
        setError('Recording error occurred.')
        setRecorderState('error')
        stopStream()
      }

      recorder.start(250) // Collect data every 250 ms
      setRecorderState('recording')

      // Duration counter
      timerRef.current = setInterval(() => {
        setDurationSeconds((s) => s + 1)
      }, 1000)
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Please allow microphone access and try again.'
        : err instanceof Error
        ? err.message
        : 'Failed to start recording.'
      setError(msg)
      setRecorderState('error')
      stopStream()
    }
  }, [stopStream])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    stopStream()
    setAudioBlob(null)
    setRecorderState('idle')
    setError(null)
    setDurationSeconds(0)
    chunksRef.current = []
  }, [stopStream])

  return {
    recorderState,
    isRecording: recorderState === 'recording',
    audioBlob,
    durationSeconds,
    error,
    startRecording,
    stopRecording,
    reset,
  }
}
