import { useEffect, useState, type KeyboardEvent } from 'react'
import {
  X, Pill, FlaskConical, MessageSquare, Printer, User,
  AlertTriangle, Sparkles, Loader2, FileText, ChevronDown,
} from 'lucide-react'
import type { OCRStructuredResult, ChatMessage, ClinicalHistoryRecord, ScannedDocument, SummarySections } from '../../types'

import BrandLogo from '../BrandLogo'

interface SummaryModalProps {
  isOpen: boolean
  onClose: () => void
  clinicalRecord: ClinicalHistoryRecord | null
  documents: ScannedDocument[]
  messages: ChatMessage[]
  aiSummaryText: string | null
  aiSummarySections: SummarySections | null
  summaryLoading: boolean
  onGenerateSummary: () => void
}

type TabId = 'ai' | 'details'

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

function SummaryLine({ label, value }: { label: string; value?: string | null }) {
  if (!value || value.trim().toLowerCase() === 'not collected') return null
  return (
    <div className="py-2.5 border-b border-surface-border last:border-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-sans">{value}</div>
    </div>
  )
}

function DocSection({ doc, defaultExpanded = false }: { doc: ScannedDocument; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const hasMeds = doc.result.medications.length > 0
  const hasLabs = doc.result.lab_investigations.length > 0

  return (
    <div className="rounded-xl border border-surface-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-muted hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-cyan" />
          <span className="text-sm font-semibold text-slate-800">{doc.filename}</span>
          {(hasMeds || hasLabs) && (
            <span className="text-xs text-slate-400">
              · {hasMeds ? `${doc.result.medications.length} meds` : ''}{hasMeds && hasLabs ? ', ' : ''}{hasLabs ? `${doc.result.lab_investigations.length} labs` : ''}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-4">
          {/* Preview */}
          {doc.previewUrl && (
            <img
              src={doc.previewUrl}
              alt={doc.filename}
              className="w-full max-h-40 rounded-xl border border-surface-border object-contain bg-slate-50 cursor-pointer"
              onClick={() => window.open(doc.previewUrl!, '_blank')}
            />
          )}

          {/* Medications */}
          {hasMeds && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Pill className="w-3 h-3 text-brand-cyan" /> Medications
              </p>
              <div className="flex flex-col gap-2">
                {doc.result.medications.map((med, i) => (
                  <div key={i} className="card px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <p className="col-span-2 font-semibold text-slate-800 text-sm">{med.drug_name}</p>
                    {med.dosage && <p className="text-xs text-slate-500">Dosage: <span className="text-slate-700 font-medium">{med.dosage}</span></p>}
                    {med.frequency && <p className="text-xs text-slate-500">Freq: <span className="text-slate-700 font-medium">{med.frequency}</span></p>}
                    {med.duration && <p className="text-xs text-slate-500 col-span-2">Duration: <span className="text-slate-700 font-medium">{med.duration}</span></p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Labs */}
          {hasLabs && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <FlaskConical className="w-3 h-3 text-brand-cyan" /> Lab Results
              </p>
              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-muted border-b border-surface-border">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Parameter</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Value</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Unit</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {doc.result.lab_investigations.map((lab, i) => (
                      <tr key={i} className={lab.is_abnormal ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 font-medium text-slate-800 text-xs">{lab.parameter_name}</td>
                        <td className={`px-3 py-2 text-right font-bold text-xs ${lab.is_abnormal ? 'text-red-600' : 'text-slate-800'}`}>
                          {lab.observed_value ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400 text-xs">{lab.unit ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {lab.is_abnormal === true && (
                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Abnormal</span>
                          )}
                          {lab.is_abnormal === false && (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Normal</span>
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
            </div>
          )}

          {!hasMeds && !hasLabs && (
            <p className="text-xs text-slate-400 italic">No structured entities extracted from this document.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function SummaryModal({
  isOpen,
  onClose,
  clinicalRecord,
  documents,
  messages,
  aiSummaryText,
  aiSummarySections,
  summaryLoading,
  onGenerateSummary,
}: SummaryModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('ai')

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: Event) => {
      if ((e as unknown as { key: string }).key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const handleBackdropKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') onClose()
  }

  const hasClinicalData = !!clinicalRecord?.chief_complaint?.symptom
  const hasDocuments = documents.length > 0
  const hasConversation = messages.filter((m) => m.role === 'user').length > 0


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
            <BrandLogo size="md" />
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
              className="w-9 h-9 rounded-xl hover:bg-slate-200 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-surface-border bg-white px-5 gap-4">
          {([
            { id: 'ai' as TabId, label: 'AI Summary', icon: Sparkles },
            { id: 'details' as TabId, label: 'Details', icon: FileText },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors
                ${activeTab === id
                  ? 'border-brand-cyan text-brand-cyan'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Modal Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 scrollbar-thin">

          {/* ═══════ AI SUMMARY TAB ═══════ */}
          {activeTab === 'ai' && (
            <>
              {/* Initial ungenerated state */}
              {!aiSummaryText && !summaryLoading && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-brand-cyan/10 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-brand-cyan" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-base">Generate AI Summary</p>
                    <p className="text-sm text-slate-400 max-w-xs mt-1">
                      Sanjivani AI will synthesize your chat history and all uploaded documents into a
                      structured clinical summary for the physician.
                    </p>
                  </div>
                  <button
                    onClick={onGenerateSummary}
                    className="btn-primary gap-2 min-h-[48px] px-6 rounded-xl"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </button>
                </div>
              )}

              {/* Loading state */}
              {summaryLoading && (
                <div className="flex flex-col items-center gap-4 py-12 animate-fade-in">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full border-4 border-brand-cyan-light" />
                    <div className="absolute inset-0 rounded-full border-4 border-brand-cyan border-t-transparent animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto w-5 h-5 text-brand-cyan" />
                  </div>
                  <p className="text-slate-600 font-semibold text-sm">
                    Sanjivani AI is synthesizing your clinical summary…
                  </p>
                  <p className="text-xs text-slate-400">Reviewing chat &amp; scanned documents</p>
                </div>
              )}

              {/* Summary content */}
              {aiSummaryText && !summaryLoading && (
                <div className="flex flex-col gap-4 animate-fade-in">
                  {aiSummarySections &&
                  (aiSummarySections.patient_info ||
                    aiSummarySections.chief_complaint ||
                    aiSummarySections.history ||
                    aiSummarySections.clinical_narrative ||
                    aiSummarySections.documents ||
                    aiSummarySections.ayush_assessment ||
                    aiSummarySections.red_flags ||
                    aiSummarySections.recommendations) ? (
                    <div className="card p-4 divide-y divide-surface-border">
                      <SummaryLine label="Patient Info" value={aiSummarySections.patient_info} />
                      <SummaryLine label="Chief Complaint" value={aiSummarySections.chief_complaint} />
                      <SummaryLine label="History of Presenting Illness" value={aiSummarySections.history} />
                      <SummaryLine label="Clinical Narrative" value={aiSummarySections.clinical_narrative} />
                      <SummaryLine label="Documents & Investigations" value={aiSummarySections.documents} />
                      <SummaryLine label="Ayush Assessment" value={aiSummarySections.ayush_assessment} />
                      <SummaryLine label="Red Flags" value={aiSummarySections.red_flags} />
                      <SummaryLine label="Recommendations" value={aiSummarySections.recommendations} />
                    </div>
                  ) : (
                    <div className="card p-4">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-sans">
                        {aiSummaryText || 'No clinical data collected yet. Start a consultation or upload documents.'}
                      </p>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">
                      Summary generated for doctor review
                    </span>
                    <button
                      onClick={onGenerateSummary}
                      className="btn-ghost text-xs gap-1.5 min-h-[36px] px-3 border border-surface-border rounded-xl hover:bg-slate-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
                      Regenerate
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════ DETAILS TAB ═══════ */}
          {activeTab === 'details' && (
            <>
              {/* Patient Demographics */}
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

              {/* Chief Complaint */}
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

              {/* Uploaded Documents */}
              {hasDocuments && (
                <Section title={`Uploaded Documents (${documents.length})`} icon={FileText}>
                  <div className="flex flex-col gap-2">
                    {documents.map((doc, i) => (
                      <DocSection key={doc.id} doc={doc} defaultExpanded={i === 0 && documents.length === 1} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Conversation Log */}
              {hasConversation && (
                <Section title={`Conversation Log (${messages.filter(m => m.role === 'user').length} patient turns)`} icon={MessageSquare}>
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
              {!hasClinicalData && !hasDocuments && !hasConversation && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <MessageSquare className="w-10 h-10 text-slate-200" />
                  <p className="text-slate-400 text-sm">No session data collected yet.</p>
                  <p className="text-xs text-slate-300">Start chatting or scan a document to see details here.</p>
                </div>
              )}
            </>
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
