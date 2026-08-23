import { useEffect, type KeyboardEvent } from 'react'
import { X, Pill, FlaskConical, MessageSquare, Printer, User, AlertTriangle } from 'lucide-react'
import type { OCRStructuredResult, ChatMessage, ClinicalHistoryRecord } from '../../types'

interface SummaryModalProps {
  isOpen: boolean
  onClose: () => void
  clinicalRecord: ClinicalHistoryRecord | null
  scanResult: OCRStructuredResult | null
  messages: ChatMessage[]
}

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        <Icon className="w-3.5 h-3.5 text-brand-cyan" />
        {title}
      </h3>
      {children}
    </section>
  )
}

export default function SummaryModal({
  isOpen,
  onClose,
  clinicalRecord,
  scanResult,
  messages,
}: SummaryModalProps) {

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: Event) => {
      if ((e as unknown as { key: string }).key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleBackdropKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') onClose()
  }

  const hasClinicalData = !!clinicalRecord?.chief_complaint?.symptom
  const hasScanData = !!scanResult && (scanResult.medications.length > 0 || scanResult.lab_investigations.length > 0)
  const hasConversation = messages.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close summary"
        onKeyDown={handleBackdropKeyDown}
      />

      {/* Modal Panel */}
      <div className="relative w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[85vh]
                      bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col
                      overflow-hidden animate-slide-up z-10">

        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border bg-surface-muted">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-cyan flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="summary-title" className="font-bold text-slate-900 text-base leading-tight">
                Clinical Session Summary
              </h2>
              <p className="text-xs text-slate-400 leading-tight">Ready for physician review</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn-ghost text-xs px-3 min-h-[36px] gap-1.5 hidden sm:flex"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-slate-200 flex items-center justify-center
                         transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 scrollbar-thin">

          {/* ── Patient Demographics ── */}
          {clinicalRecord?.patient_demographics && (
            <Section title="Patient Information" icon={User}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Age', value: clinicalRecord.patient_demographics.age_years },
                  { label: 'Gender', value: clinicalRecord.patient_demographics.gender },
                  { label: 'Language', value: clinicalRecord.patient_demographics.language_preference?.toUpperCase() },
                ].filter((r) => r.value).map(({ label, value }) => (
                  <div key={label} className="bg-surface-muted rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className="font-semibold text-slate-800 text-sm">{String(value)}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Chief Complaint ── */}
          {hasClinicalData && (
            <Section title="Chief Complaint" icon={AlertTriangle}>
              <div className="card p-4">
                <p className="font-semibold text-slate-800 text-sm">
                  {clinicalRecord!.chief_complaint?.symptom}
                </p>
                {clinicalRecord!.chief_complaint?.duration && (
                  <p className="text-xs text-slate-400 mt-1">
                    Duration: {clinicalRecord!.chief_complaint.duration}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* ── Prescribed Medications ── */}
          {hasScanData && scanResult!.medications.length > 0 && (
            <Section title="Prescribed Medications" icon={Pill}>
              <div className="flex flex-col gap-2">
                {scanResult!.medications.map((med, i) => (
                  <div key={i} className="card px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1">
                    <p className="col-span-2 font-semibold text-slate-800 text-sm">{med.drug_name}</p>
                    {med.dosage && <p className="text-xs text-slate-500">Dosage: <span className="text-slate-700 font-medium">{med.dosage}</span></p>}
                    {med.frequency && <p className="text-xs text-slate-500">Frequency: <span className="text-slate-700 font-medium">{med.frequency}</span></p>}
                    {med.duration && <p className="text-xs text-slate-500 col-span-2">Duration: <span className="text-slate-700 font-medium">{med.duration}</span></p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Lab Results ── */}
          {hasScanData && scanResult!.lab_investigations.length > 0 && (
            <Section title="Lab Investigations" icon={FlaskConical}>
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-muted border-b border-surface-border">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Parameter</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Value</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Unit</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {scanResult!.lab_investigations.map((lab, i) => (
                      <tr key={i} className={lab.is_abnormal ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{lab.parameter_name}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${lab.is_abnormal ? 'text-red-600' : 'text-slate-800'}`}>
                          {lab.observed_value ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{lab.unit ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {lab.is_abnormal === true && (
                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Abnormal</span>
                          )}
                          {lab.is_abnormal === false && (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Normal</span>
                          )}
                          {lab.is_abnormal === null && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── Conversation Log ── */}
          {hasConversation && (
            <Section title={`Conversation Log (${messages.length} turns)`} icon={MessageSquare}>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto scrollbar-thin
                              bg-surface-muted rounded-xl p-3 border border-surface-border">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5
                      ${msg.role === 'user' ? 'bg-brand-cyan text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {msg.role === 'user' ? 'P' : 'AI'}
                    </span>
                    <p className="text-xs text-slate-600 leading-relaxed flex-1">{msg.content}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Empty State */}
          {!hasClinicalData && !hasScanData && !hasConversation && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <MessageSquare className="w-10 h-10 text-slate-200" />
              <p className="text-slate-400 text-sm">No session data collected yet.</p>
              <p className="text-xs text-slate-300">Start chatting or scan a document to see a summary here.</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-surface-border bg-surface-muted flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Generated by Sanjivani AI — Ministry of Ayush · SIH 2026
          </p>
          <button onClick={onClose} className="btn-primary text-xs min-h-[40px] px-5">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
