import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import {
  Upload, Camera, RotateCcw, Loader2, ZoomIn,
  ScanLine, X, CameraOff, CheckCircle2,
} from 'lucide-react'
import type { OCRStructuredResult } from '../../types'
import { useCameraCapture } from '../../hooks/useCameraCapture'
import ExtractedDataCard from './ExtractedDataCard'

interface ScannerPanelProps {
  isLoading: boolean
  error: string | null
  scanResult: OCRStructuredResult | null
  onScanFile: (file: File | Blob) => void
  onReset: () => void
}

export default function ScannerPanel({
  isLoading,
  error,
  scanResult,
  onScanFile,
  onReset,
}: ScannerPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    cameraState,
    isActive: isCameraActive,
    capturedDataUrl,
    capturedBlob,
    error: cameraError,
    videoRef,
    canvasRef,
    startCamera,
    capturePhoto,
    stopCamera,
    reset: resetCamera,
  } = useCameraCapture()

  // ── File handling ─────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return // Silently ignore non-image drops; UI shows accepted types
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    onScanFile(file)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = '' // Reset so same file can be selected again
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  // ── Camera capture ────────────────────────────────────────────

  const handleCameraCapture = () => {
    const blob = capturePhoto()
    if (blob) {
      onScanFile(blob)
    } else if (capturedBlob) {
      // capturePhoto sets state async; use the stored blob if available
      onScanFile(capturedBlob)
    }
  }

  // ── Reset all state ───────────────────────────────────────────

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    resetCamera()
    onReset()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── State derivation ──────────────────────────────────────────

  const showDropzone = !isLoading && !scanResult && !isCameraActive && cameraState !== 'captured'
  const showCameraView = isCameraActive
  const showResult = !!scanResult && !isLoading
  const capturePreview = capturedDataUrl || preview

  return (
    <div className="flex flex-col h-full">

      {/* ── Panel Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-brand-cyan" />
          <h2 className="font-semibold text-slate-800 text-base">Document Scanner</h2>
        </div>
        {(scanResult || preview || cameraState !== 'idle') && (
          <button
            onClick={handleReset}
            className="btn-ghost text-xs gap-1.5 min-h-[36px] px-3"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">

        {/* ── Dropzone ── */}
        {showDropzone && (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload prescription or lab report image"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-4
                          rounded-2xl border-2 border-dashed cursor-pointer
                          min-h-[220px] px-6 text-center transition-all duration-200
                          ${isDragOver
                            ? 'border-brand-cyan bg-brand-cyan-light scale-[1.01]'
                            : 'border-slate-300 bg-slate-50 hover:border-brand-cyan hover:bg-slate-100'
                          }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
                              ${isDragOver ? 'bg-brand-cyan text-white' : 'bg-white text-brand-cyan shadow-card'}`}>
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 text-sm">
                  {isDragOver ? 'Drop image here' : 'Drop prescription or report image'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  or click to browse — JPEG, PNG, WebP, TIFF accepted
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
                aria-hidden="true"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">or use camera</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Camera Trigger */}
            <button
              onClick={startCamera}
              className="w-full btn-secondary gap-2 min-h-[52px] rounded-xl"
            >
              <Camera className="w-5 h-5 text-brand-cyan" />
              Open Camera Viewfinder
            </button>

            {cameraError && (
              <p className="mt-2 text-xs text-red-500 text-center">{cameraError}</p>
            )}
          </>
        )}

        {/* ── Loading State ── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 animate-fade-in">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-brand-cyan-light" />
              <div className="absolute inset-0 rounded-full border-4 border-brand-cyan border-t-transparent animate-spin" />
              <ScanLine className="absolute inset-0 m-auto w-6 h-6 text-brand-cyan" />
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-semibold text-sm">Analyzing Document…</p>
              <p className="text-slate-400 text-xs mt-1">Vision AI is reading the prescription</p>
            </div>
            {capturePreview && (
              <img
                src={capturePreview}
                alt="Document being analyzed"
                className="max-h-40 rounded-xl border border-surface-border shadow-card object-contain opacity-60"
              />
            )}
          </div>
        )}

        {/* ── Camera Viewfinder ── */}
        {showCameraView && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="relative rounded-2xl overflow-hidden border border-surface-border shadow-card bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                aria-label="Camera viewfinder"
              />
              {/* Document alignment guide */}
              <div className="absolute inset-4 border-2 border-white/50 rounded-xl pointer-events-none" />
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="text-xs text-white/80 bg-black/40 px-3 py-1 rounded-full">
                  Align document within frame
                </span>
              </div>
            </div>
            {/* Hidden canvas for frame extraction */}
            <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

            <div className="flex gap-2">
              <button onClick={stopCamera} className="btn-secondary flex-1">
                <CameraOff className="w-4 h-4" />
                Cancel
              </button>
              <button onClick={handleCameraCapture} className="btn-primary flex-[2]">
                <Camera className="w-5 h-5" />
                Capture & Scan
              </button>
            </div>
          </div>
        )}

        {/* ── API Error ── */}
        {error && !isLoading && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
            <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Scan Failed</p>
              <p className="text-xs text-red-500 mt-1">{error}</p>
              <button onClick={handleReset} className="mt-3 text-xs font-medium text-red-600 hover:underline">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Scan Result ── */}
        {showResult && (
          <div className="flex flex-col gap-4 animate-slide-up">
            {/* Preview thumbnail */}
            {capturePreview && (
              <div className="relative group">
                <img
                  src={capturePreview}
                  alt="Scanned document"
                  className="w-full max-h-48 rounded-xl border border-surface-border shadow-card object-contain bg-slate-50"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1
                                bg-brand-mint-light border border-emerald-200 rounded-full shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs text-emerald-700 font-semibold">Scanned</span>
                </div>
                <button
                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity
                             p-1.5 rounded-lg bg-white/90 border border-slate-200 shadow-sm"
                  aria-label="View full document"
                  onClick={() => window.open(capturePreview!, '_blank')}
                >
                  <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            )}

            {/* Extracted entities */}
            <ExtractedDataCard result={scanResult!} />
          </div>
        )}
      </div>
    </div>
  )
}
