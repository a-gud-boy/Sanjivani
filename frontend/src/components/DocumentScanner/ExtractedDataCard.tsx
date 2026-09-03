import { Pill, FlaskConical, AlertCircle, CheckCircle2, Clock, Hash } from 'lucide-react'
import type { OCRStructuredResult, Medication, LabInvestigation } from '../../types'

interface ExtractedDataCardProps {
  result: OCRStructuredResult
}

// Colour coding for medication frequency labels
const FREQ_COLOURS: Record<string, string> = {
  OD: 'bg-sky-100 text-sky-700',
  BD: 'bg-violet-100 text-violet-700',
  BID: 'bg-violet-100 text-violet-700',
  TDS: 'bg-amber-100 text-amber-700',
  TID: 'bg-amber-100 text-amber-700',
  QID: 'bg-orange-100 text-orange-700',
  HS: 'bg-slate-100 text-slate-600',
  SOS: 'bg-pink-100 text-pink-700',
  STAT: 'bg-red-100 text-red-700',
}

function freqBadgeClass(freq: string | null): string {
  if (!freq) return 'bg-slate-100 text-slate-500'
  const key = Object.keys(FREQ_COLOURS).find((k) =>
    freq.toUpperCase().includes(k)
  )
  return key ? FREQ_COLOURS[key] : 'bg-brand-cyan-light text-brand-cyan-dark'
}

function MedicationRow({ med }: { med: Medication }) {
  return (
    <div className="card p-4 flex flex-col gap-2 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-cyan/10 dark:bg-brand-cyan/20 flex items-center justify-center">
            <Pill className="w-4 h-4 text-brand-cyan" />
          </div>
          <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">{med.drug_name}</p>
        </div>
        {med.dosage && (
          <span className="flex-shrink-0 text-xs font-mono font-bold text-slate-700 dark:text-slate-200
                           bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg whitespace-nowrap">
            {med.dosage}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {med.frequency && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${freqBadgeClass(med.frequency)}`}>
            <Hash className="w-3 h-3" />
            {med.frequency}
          </span>
        )}
        {med.duration && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 px-2 py-1
                           rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3 h-3" />
            {med.duration}
          </span>
        )}
      </div>
    </div>
  )
}

function LabRow({ lab }: { lab: LabInvestigation }) {
  const isAbnormal = lab.is_abnormal === true
  const isNormal = lab.is_abnormal === false

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors
      ${isAbnormal
        ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50'
        : isNormal
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50'
        : 'bg-white dark:bg-slate-800 border-surface-border dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className={`w-4 h-4 flex-shrink-0 ${isAbnormal ? 'text-red-500' : 'text-brand-cyan'}`} />
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{lab.parameter_name}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {lab.observed_value && (
          <span className={`font-bold text-sm ${isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {lab.observed_value}
            {lab.unit && <span className="font-normal text-slate-400 dark:text-slate-500 text-xs ml-1">{lab.unit}</span>}
          </span>
        )}
        {isAbnormal && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
        {isNormal && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
      </div>
    </div>
  )
}

export default function ExtractedDataCard({ result }: ExtractedDataCardProps) {
  const hasMeds = result.medications.length > 0
  const hasLabs = result.lab_investigations.length > 0
  const hasAny = hasMeds || hasLabs

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <FlaskConical className="w-8 h-8 text-slate-300" />
        <p className="text-sm text-slate-400">No structured data extracted.</p>
        {result.raw_text && (
          <details className="mt-3 w-full text-left">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
              View raw text transcript
            </summary>
            <pre className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200
                            rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed">
              {result.raw_text}
            </pre>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Medications */}
      {hasMeds && (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider
                          text-slate-500 mb-3 px-1">
            <Pill className="w-3.5 h-3.5 text-brand-cyan" />
            Prescribed Medications ({result.medications.length})
          </h3>
          <div className="flex flex-col gap-2">
            {result.medications.map((med, i) => (
              <MedicationRow key={i} med={med} />
            ))}
          </div>
        </section>
      )}

      {/* Lab Investigations */}
      {hasLabs && (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider
                          text-slate-500 mb-3 px-1">
            <FlaskConical className="w-3.5 h-3.5 text-brand-cyan" />
            Lab Investigations ({result.lab_investigations.length})
          </h3>
          <div className="flex flex-col gap-2">
            {result.lab_investigations.map((lab, i) => (
              <LabRow key={i} lab={lab} />
            ))}
          </div>
        </section>
      )}

      {/* Raw Text Collapsible */}
      {result.raw_text && (
        <details>
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 px-1">
            View raw transcription
          </summary>
          <pre className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-200
                          rounded-xl p-3 whitespace-pre-wrap font-mono leading-relaxed">
            {result.raw_text}
          </pre>
        </details>
      )}
    </div>
  )
}
