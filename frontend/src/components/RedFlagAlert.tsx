import { AlertTriangle, Phone, X } from 'lucide-react'

interface RedFlagAlertProps {
  message?: string
  onDismiss?: () => void
}

export default function RedFlagAlert({ message, onDismiss }: RedFlagAlertProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="relative w-full bg-brand-crimson text-white px-4 py-4 animate-slide-up"
    >
      {/* Animated background pulse */}
      <div className="absolute inset-0 bg-red-700 opacity-0 animate-pulse-slow rounded-none pointer-events-none" />

      <div className="relative max-w-screen-2xl mx-auto flex items-start gap-3 sm:gap-4">

        {/* Icon */}
        <div className="flex-shrink-0 emergency-pulse w-10 h-10 rounded-full bg-white/20
                        flex items-center justify-center mt-0.5">
          <AlertTriangle className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide mb-1">
            ⚠ Emergency Alert — Urgent Medical Attention Required
          </p>
          <p className="text-sm text-red-100 leading-relaxed">
            {message ??
              'Your reported symptoms may indicate a serious medical emergency. Please proceed immediately to the nearest emergency department or call emergency services.'}
          </p>

          {/* Emergency Call CTA */}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="tel:108"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white
                         text-brand-crimson text-sm font-bold shadow-sm hover:bg-red-50
                         transition-colors min-h-[44px]"
            >
              <Phone className="w-4 h-4" strokeWidth={2.5} />
              Call 108 — Ambulance
            </a>
            <a
              href="tel:102"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20
                         text-white text-sm font-semibold hover:bg-white/30
                         transition-colors min-h-[44px]"
            >
              <Phone className="w-4 h-4" strokeWidth={2} />
              Call 102 — Health Helpline
            </a>
          </div>
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30
                       flex items-center justify-center transition-colors"
            onClick={onDismiss}
            aria-label="Dismiss emergency alert"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    </div>
  )
}
