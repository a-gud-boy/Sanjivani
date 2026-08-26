import { useEffect, useRef, useState } from 'react'
import { Cpu, ChevronDown, CheckCircle2, RefreshCw, HardDrive, Sparkles, Loader2 } from 'lucide-react'
import { fetchAvailableModels, switchActiveModel, extractErrorMessage } from '../services/api'
import type { ModelInfo } from '../types'

export default function ModelSelector() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [activeTextModel, setActiveTextModel] = useState<string>('')
  const [activeVisionModel, setActiveVisionModel] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSwitching, setIsSwitching] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadModels = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAvailableModels()
      setModels(data.models)
      setActiveTextModel(data.active_text_model)
      setActiveVisionModel(data.active_vision_model)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectModel = async (model: ModelInfo) => {
    if (model.id === activeTextModel && model.id === activeVisionModel) {
      setIsOpen(false)
      return
    }

    setIsSwitching(model.id)
    setError(null)
    try {
      const res = await switchActiveModel(model.id, 'both')
      setActiveTextModel(res.active_text_model)
      setActiveVisionModel(res.active_vision_model)
      setModels((prev) =>
        prev.map((m) => ({
          ...m,
          is_active: m.id === model.id,
        }))
      )
      setNotification(`Switched active model to ${model.name}`)
      setTimeout(() => setNotification(null), 3500)
      setIsOpen(false)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setIsSwitching(null)
    }
  }

  // Get display name for active model
  const activeModelObj = models.find((m) => m.id === activeTextModel || m.is_active)
  const activeDisplayName = activeModelObj ? activeModelObj.name.split('(')[0].trim() : 'MedGemma 1.5 4B'

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border
                   bg-white hover:bg-surface-muted text-slate-700 text-xs font-medium
                   transition-colors duration-150 min-h-[40px] shadow-sm"
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Change AI model"
        title={`Active model: ${activeTextModel}`}
      >
        <div className="w-5 h-5 rounded-lg bg-brand-cyan/10 flex items-center justify-center text-brand-cyan flex-shrink-0">
          <Cpu className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col text-left">
          <span className="font-semibold text-slate-800 leading-tight max-w-[130px] truncate">
            {activeDisplayName}
          </span>
          <span className="text-[10px] text-slate-400 font-normal leading-tight">
            {models.length} {models.length === 1 ? 'model' : 'models'} downloaded
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ml-0.5 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl
                     border border-surface-border overflow-hidden z-50 animate-fade-in divide-y divide-slate-100"
          role="listbox"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
                AI Inference Models
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {models.length} downloaded model{models.length === 1 ? '' : 's'} in local cache
              </p>
            </div>

            <button
              onClick={loadModels}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60
                         transition-colors disabled:opacity-50"
              title="Rescan downloaded models"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Notification / Error Banner */}
          {error && (
            <div className="px-4 py-2 bg-red-50 text-red-600 text-xs border-b border-red-100">
              {error}
            </div>
          )}

          {/* Model Options List */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
            {models.length === 0 ? (
              <div className="text-center py-6 px-4">
                <HardDrive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No cached models detected</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Download models using <code className="bg-slate-100 px-1 py-0.5 rounded">hf download</code> or vLLM.
                </p>
              </div>
            ) : (
              models.map((model) => {
                const isActive = model.id === activeTextModel || model.is_active
                const isCurrentSwitching = isSwitching === model.id

                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelectModel(model)}
                    disabled={isCurrentSwitching}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-start justify-between gap-3
                      ${
                        isActive
                          ? 'border-brand-cyan/40 bg-brand-cyan/5 text-slate-900 shadow-sm'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate">{model.name}</span>
                        {isActive && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-cyan text-white shadow-xs">
                            Active
                          </span>
                        )}
                        {model.is_vllm_loaded && !isActive && (
                          <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            vLLM
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                        {model.id}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                        {model.size_on_disk && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-slate-600">
                            <HardDrive className="w-2.5 h-2.5" />
                            {model.size_on_disk}
                          </span>
                        )}
                        <span className="capitalize">{model.source.replace('_', ' ')}</span>
                      </div>
                    </div>

                    <div className="pt-0.5 flex-shrink-0">
                      {isCurrentSwitching ? (
                        <Loader2 className="w-4 h-4 text-brand-cyan animate-spin" />
                      ) : isActive ? (
                        <CheckCircle2 className="w-4 h-4 text-brand-cyan" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer note */}
          <div className="px-4 py-2.5 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Switches both Chat &amp; Vision OCR targets</span>
            <span className="font-mono text-[10px] text-slate-400">Port 8001 / vLLM</span>
          </div>
        </div>
      )}

      {/* Floating confirmation toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-brand-cyan flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  )
}
