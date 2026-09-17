import { useState } from 'react'
import { CheckCircle2, MessageSquare, RefreshCw, AlertTriangle, X, RotateCcw } from 'lucide-react'

interface ChatEndOverlayProps {
  onContinue: () => void
  onRestart: () => void
}

export default function ChatEndOverlay({ onContinue, onRestart }: ChatEndOverlayProps) {
  const [showWarning, setShowWarning] = useState(false)

  const handleRestartClick = () => {
    setShowWarning(true)
  }

  const handleConfirmRestart = () => {
    setShowWarning(false)
    onRestart()
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center
                    bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm animate-fade-in px-6 text-center transition-colors">

      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center mb-5 shadow-card border border-transparent dark:border-emerald-800/40">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" aria-hidden="true" />
      </div>

      <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Chat Ended</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-8">
        You have completed your intake session. You can continue from where you left off,
        or start a completely new session.
      </p>

      {/* Warning panel */}
      {showWarning ? (
        <div className="w-full max-w-sm bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 mb-5 animate-fade-in">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-left">
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Restart Session?</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                All information you shared during this chat will be permanently lost.
                Your uploaded documents will be kept.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWarning(false)}
              className="flex-1 btn-secondary text-sm min-h-[40px] rounded-xl inline-flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              Cancel
            </button>
            <button
              onClick={handleConfirmRestart}
              className="flex-1 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-600
                         text-white font-semibold text-sm transition-colors inline-flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              Yes, Restart
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col w-full max-w-sm gap-3">
          <button
            onClick={onContinue}
            className="w-full btn-primary min-h-[52px] rounded-xl gap-2 text-base inline-flex items-center justify-center"
          >
            <MessageSquare className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            Continue Chat
          </button>

          <button
            onClick={handleRestartClick}
            className="w-full btn-secondary min-h-[52px] rounded-xl gap-2 text-base
                       text-slate-600 hover:text-amber-700 hover:border-amber-300 inline-flex items-center justify-center"
          >
            <RefreshCw className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            Restart Session
          </button>
        </div>
      )}
    </div>
  )
}
