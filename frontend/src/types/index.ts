// ============================================================
// Sanjivani — Core TypeScript Types & Interfaces
// ============================================================

// ---- Language ---------------------------------------------------

export type LanguageCode = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu'

export interface Language {
  code: LanguageCode
  label: string
  nativeLabel: string
}

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
]

// ---- Chat -------------------------------------------------------

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  /** Optional quick-reply chips attached to this assistant message */
  quickReplies?: string[]
  /** Whether this message triggered a red-flag alert */
  hasRedFlag?: boolean
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

// ---- API Request/Response shapes --------------------------------

export interface ChatApiRequest {
  user_text: string
  language: LanguageCode
  current_json_state: object | null
  chat_history: ChatHistoryEntry[]
}

export interface ClinicalHistoryRecord {
  patient_demographics?: {
    age_years?: number | null
    gender?: string | null
    language_preference?: string
  }
  chief_complaint?: {
    symptom?: string | null
    duration?: string | null
  }
  red_flag_alert?: boolean
  next_question_to_ask_patient?: string
  suggested_quick_replies?: string[]
  [key: string]: unknown
}

export interface ChatApiResponse {
  status: 'success' | 'error'
  data: ClinicalHistoryRecord
}

// ---- Medications & Lab Results ----------------------------------

export interface Medication {
  drug_name: string
  dosage: string | null
  frequency: string | null
  duration: string | null
}

export interface LabInvestigation {
  parameter_name: string
  observed_value: string | null
  unit: string | null
  is_abnormal: boolean | null
}

export interface OCRStructuredResult {
  medications: Medication[]
  lab_investigations: LabInvestigation[]
  raw_text: string | null
}

export interface ScanApiResponse {
  status: 'success' | 'error'
  data: OCRStructuredResult
}

// ---- Intake State (root orchestration) --------------------------

export type ActiveTab = 'chat' | 'scanner'

export interface IntakeState {
  /** Current language preference for the session */
  language: LanguageCode
  /** Whether patient has a linked ABHA ID */
  abhaLinked: boolean
  /** ABHA ID display string if linked */
  abhaId: string | null
  /** Full chat history */
  messages: ChatMessage[]
  /** Latest clinical record returned by the backend */
  clinicalRecord: ClinicalHistoryRecord | null
  /** Whether a red-flag emergency has been raised */
  redFlagActive: boolean
  /** OCR scan results from document scanner */
  scanResult: OCRStructuredResult | null
  /** Which panel is active on mobile/tablet */
  activeTab: ActiveTab
  /** Whether the summary modal is open */
  summaryOpen: boolean
}
