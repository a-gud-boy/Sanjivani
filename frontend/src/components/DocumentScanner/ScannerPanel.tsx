import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import {
  Upload, Camera, Loader2, ZoomIn,
  ScanLine, X, CameraOff, CheckCircle2, FileText, Trash2,
} from 'lucide-react'
import type { ScannedDocument } from '../../types'
import { useCameraCapture } from '../../hooks/useCameraCapture'
import ExtractedDataCard from './ExtractedDataCard'

interface ScannerPanelProps {
  documents: ScannedDocument[]
  isLoading: boolean
  error: string | null
  onAddDocument: (file: File | Blob, filename?: string) => void
  onRemoveDocument: (id: string) => void
}

export default function ScannerPanel({
  documents,
  isLoading,
  error,
  onAddDocument,
  onRemoveDocument,
}: ScannerPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null)
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
    if (!file.type.startsWith('image/')) return
    onAddDocument(file, file.name)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
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
    const target = blob || capturedBlob
    if (target) {
      const ts = new Date().toISOString().slice(11, 19).replace(/:/g, '-')
      onAddDocument(target, `camera_${ts}.png`)
      resetCamera()
    }
  }

  const showDropzone = !isCameraActive && cameraState !== 'captured'
  const showCameraView = isCameraActive

  return (
    <div className="flex flex-col h-full">

      {/* ── Panel Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-brand-cyan" />
          <h2 className="font-semibold text-slate-800 dark:text-white text-base">Document Scanner</h2>
        </div>
        {documents.length > 0 && (
          <span className="text-xs font-semibold text-brand-cyan bg-brand-cyan/10 dark:bg-brand-cyan/20 px-2 py-0.5 rounded-full">
            {documents.length} doc{documents.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin space-y-4">

        {/* ── Uploaded Documents List ── */}
        {documents.length > 0 && (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => {
              const isExpanded = expandedDocId === doc.id
              const medCount = doc.result.medications.length
              const labCount = doc.result.lab_investigations.length
              return (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-surface-border dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card overflow-hidden transition-colors"
                >
                  {/* Document row header */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {/* Thumbnail */}
                    {doc.previewUrl ? (
                      <img
                        src={doc.previewUrl}
                        alt={doc.filename}
                        className="w-10 h-10 rounded-lg object-cover border border-surface-border dark:border-slate-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{doc.filename}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {medCount > 0 && `${medCount} medication${medCount !== 1 ? 's' : ''}`}
                        {medCount > 0 && labCount > 0 && ' · '}
                        {labCount > 0 && `${labCount} lab result${labCount !== 1 ? 's' : ''}`}
                        {medCount === 0 && labCount === 0 && 'Scanned'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Expand / Collapse */}
                      <button
                        onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                        className="text-xs text-brand-cyan hover:text-brand-cyan-dark px-2 py-1
                                   rounded-lg hover:bg-brand-cyan/10 dark:hover:bg-brand-cyan/20 transition-colors"
                      >
                        {isExpanded ? 'Hide' : 'View'}
                      </button>
                      {/* Full image */}
                      {doc.previewUrl && (
                        <button
                          onClick={() => window.open(doc.previewUrl!, '_blank')}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label="View full image"
                        >
                          <ZoomIn className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        </button>
                      )}
                      {/* Remove */}
                      <button
                        onClick={() => {
                          if (doc.previewUrl) URL.revokeObjectURL(doc.previewUrl)
                          if (expandedDocId === doc.id) setExpandedDocId(null)
                          onRemoveDocument(doc.id)
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        aria-label={`Remove ${doc.filename}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded data */}
                  {isExpanded && (
                    <div className="border-t border-surface-border dark:border-slate-800 px-3 py-3 bg-surface-muted dark:bg-slate-850">
                      <ExtractedDataCard result={doc.result} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Dropzone (always visible for adding more) ── */}
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
                          min-h-[160px] px-6 text-center transition-all duration-200
                          ${isDragOver
                            ? 'border-brand-cyan bg-brand-cyan-light dark:bg-brand-cyan/20 scale-[1.01]'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 hover:border-brand-cyan hover:bg-slate-100 dark:hover:bg-slate-850'
                          }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                              ${isDragOver ? 'bg-brand-cyan text-white' : 'bg-white dark:bg-slate-800 text-brand-cyan shadow-card'}`}>
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  {documents.length > 0
                    ? (isDragOver ? 'Drop to add' : 'Add another document')
                    : (isDragOver ? 'Drop image here' : 'Drop prescription or report image')}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
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
            <div className="flex items-center gap-3">
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
          <div className="flex flex-col items-center justify-center gap-4 py-10 animate-fade-in">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-brand-cyan-light" />
              <div className="absolute inset-0 rounded-full border-4 border-brand-cyan border-t-transparent animate-spin" />
              <ScanLine className="absolute inset-0 m-auto w-5 h-5 text-brand-cyan" />
            </div>
            <div className="text-center">
              <p className="text-slate-700 font-semibold text-sm">Analyzing Document…</p>
              <p className="text-slate-400 text-xs mt-1">Vision AI is reading the document</p>
            </div>
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
              <div className="absolute inset-4 border-2 border-white/50 rounded-xl pointer-events-none" />
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="text-xs text-white/80 bg-black/40 px-3 py-1 rounded-full">
                  Align document within frame
                </span>
              </div>
            </div>
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
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {documents.length === 0 && !isLoading && !showCameraView && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Add prescriptions or lab reports above
          </div>
        )}
      </div>
    </div>
  )
}
