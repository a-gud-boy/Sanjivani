import { useState, useRef, useCallback, useEffect } from 'react'

export type CameraState = 'idle' | 'active' | 'captured' | 'error'

export interface UseCameraCaptureReturn {
  /** Current camera lifecycle state */
  cameraState: CameraState
  /** True when the live viewfinder stream is running */
  isActive: boolean
  /** Captured image Blob (PNG), null until a snapshot is taken */
  capturedBlob: Blob | null
  /** Preview data URL for the captured image */
  capturedDataUrl: string | null
  /** Human-readable error message */
  error: string | null
  /** Ref to attach to a <video> element for the live preview */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Ref to attach to a hidden <canvas> element for frame capture */
  canvasRef: React.RefObject<HTMLCanvasElement>
  /** Start the camera and begin streaming to videoRef */
  startCamera: () => Promise<void>
  /** Capture the current video frame as a PNG Blob */
  capturePhoto: () => Blob | null
  /** Stop the camera stream and release the device */
  stopCamera: () => void
  /** Discard the captured image and go back to idle */
  reset: () => void
}

/**
 * useCameraCapture
 *
 * Manages the full lifecycle of the device camera for kiosk document scanning:
 *   1. startCamera()  — requests getUserMedia and pipes the stream into <video>
 *   2. capturePhoto() — draws current video frame onto <canvas>, exports PNG Blob
 *   3. stopCamera()   — stops all MediaStreamTracks and releases the camera
 *
 * The returned `capturedBlob` is a ready-to-POST `image/png` Blob.
 */
export function useCameraCapture(): UseCameraCaptureReturn {
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    setCapturedBlob(null)
    setCapturedDataUrl(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not supported in this browser.')
      setCameraState('error')
      return
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer rear camera on mobile/kiosk
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {
            // autoplay policy may block — user gesture already happened
          })
        }
      }

      setCameraState('active')
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access.'
          : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'No camera device found on this device.'
          : err instanceof Error
          ? err.message
          : 'Failed to start camera.'
      setError(msg)
      setCameraState('error')
    }
  }, [])

  const capturePhoto = useCallback((): Blob | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError('Video stream is not ready yet.')
      return null
    }

    // Match canvas dimensions to the actual video feed
    const w = video.videoWidth || video.clientWidth
    const h = video.videoHeight || video.clientHeight
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, w, h)

    // Export as PNG and also build a data URL for the preview
    const dataUrl = canvas.toDataURL('image/png')
    setCapturedDataUrl(dataUrl)

    let blob: Blob | null = null
    canvas.toBlob((b) => {
      if (b) {
        setCapturedBlob(b)
        blob = b
      }
    }, 'image/png', 1.0)

    setCameraState('captured')
    stopCamera()
    return blob
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    // Only reset to idle if we're not in a captured state
    setCameraState((prev) => (prev === 'active' ? 'idle' : prev))
  }, [])

  const reset = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCapturedBlob(null)
    setCapturedDataUrl(null)
    setError(null)
    setCameraState('idle')
  }, [])

  return {
    cameraState,
    isActive: cameraState === 'active',
    capturedBlob,
    capturedDataUrl,
    error,
    videoRef,
    canvasRef,
    startCamera,
    capturePhoto,
    stopCamera,
    reset,
  }
}
