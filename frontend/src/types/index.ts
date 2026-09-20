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

export type ChatStatus = 'active' | 'ended'

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

export interface ChatInitApiResponse {
  status: 'success' | 'error'
  greeting: string
  suggested_quick_replies: string[]
}

// ---- Medications & Lab Results ----------------------------------

export interface Medication {
  drug_name: string
  dosage: string | null
  frequency: string | null
  duration: string | null
  prescription_date?: string | null
}

export interface LabInvestigation {
  parameter_name: string
  observed_value: string | null
  unit: string | null
  is_abnormal: boolean | null
}

export interface OCRStructuredResult {
  document_date?: string | null
  medications: Medication[]
  lab_investigations: LabInvestigation[]
  raw_text: string | null
}

export interface ScanApiResponse {
  status: 'success' | 'error'
  data: OCRStructuredResult
}

// ---- Scanned Documents ------------------------------------------

export interface ScannedDocument {
  /** Client-generated unique ID */
  id: string
  /** Original filename or camera snapshot label */
  filename: string
  /** Object URL for preview thumbnail (revoke when removed) */
  previewUrl: string | null
  /** Extracted clinical entities from OCR */
  result: OCRStructuredResult
}

// ---- Clinical Summary -------------------------------------------

export interface SummarySections {
  patient_info?: string | null
  chief_complaint?: string | null
  history?: string | null
  clinical_narrative?: string | null
  documents?: string | null
  ayush_assessment?: string | null
  red_flags?: string | null
  recommendations?: string | null
}

export interface SummarizeApiResponse {
  status: 'success' | 'error'
  summary_text: string
  summary_sections: SummarySections
}

// ---- Model Management -------------------------------------------

export interface ModelInfo {
  id: string
  name: string
  size_on_disk?: string | null
  source: string
  is_active: boolean
  is_vllm_loaded: boolean
  supports_vision?: boolean
  multimodal_capabilities?: string[]
}

export interface ModelsApiResponse {
  status: 'success' | 'error'
  active_text_model: string
  active_vision_model: string
  models: ModelInfo[]
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
  /** Chat session status — 'active' or 'ended' */
  chatStatus: ChatStatus
  /** Latest clinical record returned by the backend */
  clinicalRecord: ClinicalHistoryRecord | null
  /** Whether a red-flag emergency has been raised */
  redFlagActive: boolean
  /** All uploaded scanned documents (multi-document support) */
  scannedDocuments: ScannedDocument[]
  /** Which panel is active on mobile/tablet */
  activeTab: ActiveTab
  /** Whether the summary modal is open */
  summaryOpen: boolean
  /** AI-generated narrative summary text (null until generated) */
  aiSummaryText: string | null
  /** AI summary section breakdown */
  aiSummarySections: SummarySections | null
  /** Whether the summary is being generated */
  summaryLoading: boolean
  /** Language used when current AI summary was generated */
  summaryLanguage?: LanguageCode | null
}

// ---- User & Auth ------------------------------------------------

export type UserType = 'patient' | 'doctor'

export interface FamilyHistoryEntry {
  relative: string
  condition: string
  notes?: string
}

/**
 * UI-layer allergy entry. Stored to DB as plain string[] — this type is
 * used only inside the profile form for the structured dropdown + text input.
 * `category` is either a preset allergy label or the sentinel `"__other__"`.
 * `customValue` is used when category === "__other__".
 */
export interface AllergyEntry {
  /** Preset category label OR "__other__" for freeform text */
  category: string
  /** Free-text value when category is "__other__" */
  customValue?: string
}

/** Ordered list of common allergy categories shown in the dropdown */
export const ALLERGY_CATEGORIES = [
  // Drug allergies
  'Penicillin / Amoxicillin',
  'Sulfonamides (Sulfa drugs)',
  'NSAIDs (Aspirin / Ibuprofen)',
  'Cephalosporins',
  'Quinolones (Ciprofloxacin)',
  'Tetracyclines',
  'Metronidazole',
  'Codeine / Opioids',
  // Food allergies
  'Peanuts',
  'Tree Nuts (Cashew, Almond, Walnut)',
  'Milk / Dairy (Lactose)',
  'Eggs',
  'Wheat / Gluten',
  'Soy',
  'Fish / Shellfish',
  'Sesame',
  // Environmental / respiratory
  'Pollen (Seasonal Hay Fever)',
  'Dust Mites',
  'Animal Dander (Cat / Dog)',
  'Mould / Fungal Spores',
  'Latex',
  'Insect Stings (Bee / Wasp)',
  'Nickel (Contact Dermatitis)',
  // Dye / chemical
  'Iodine / Contrast Dye',
  'Anaesthesia (Local / General)',
  // Sentinel
  'Others (specify)',
] as const

/** Ordered list of common chronic medical conditions shown in the dropdown */
export const COMMON_CHRONIC_CONDITIONS = [
  'Type 2 Diabetes Mellitus',
  'Type 1 Diabetes Mellitus',
  'Hypertension (High Blood Pressure)',
  'Bronchial Asthma',
  'Chronic Obstructive Pulmonary Disease (COPD)',
  'Hypothyroidism / Thyroid Disorder',
  'Coronary Artery Disease / Heart Disease',
  'Chronic Kidney Disease (CKD)',
  'Osteoarthritis / Rheumatoid Arthritis',
  'Dyslipidemia (High Cholesterol)',
  'Gastroesophageal Reflux Disease (GERD / Acidity)',
  'Migraine / Chronic Headache',
  'Epilepsy / Seizure Disorder',
  'Chronic Liver Disease / Fatty Liver',
  'Allergic Rhinitis / Chronic Sinusitis',
  'Psoriasis / Eczema',
  'Depression / Anxiety Disorder',
  'Others (specify)',
] as const

export interface PatientDetails {
  blood_group?: string
  dob?: string
  address_line?: string
  city?: string
  state?: string
  pincode?: string
  occupation?: string
  marital_status?: string
  preferred_language?: string
  allergies?: string[]
  chronic_conditions?: string[]
  ayush_prakriti?: string
  emergency_contact?: {
    name?: string
    relation?: string
    phone?: string
  }
  family_history?: FamilyHistoryEntry[]
  address?: string
  [key: string]: unknown
}

export interface DoctorDetails {
  specialization?: string
  hospital?: string
  department?: string
  license_no?: string
  qualifications?: string
  duty_status?: string
  opd_hours?: string
  [key: string]: unknown
}

export interface Patient {
  id: string
  abha_id: string
  user_type: 'patient'
  name: string
  gender?: string | null
  age_years?: number | null
  phone?: string | null
  email?: string | null
  patient_details?: PatientDetails | null
  doctor_details?: null
  hp_id?: null
}

export interface Doctor {
  id: string
  hp_id: string
  user_type: 'doctor'
  name: string
  gender?: string | null
  age_years?: number | null
  phone?: string | null
  email?: string | null
  specialization?: string
  license_no?: string
  hospital?: string
  department?: string
  qualifications?: string
  duty_status?: string
  opd_hours?: string
  doctor_details?: DoctorDetails | null
  patient_details?: null
  abha_id?: never  // Strict compile-time guard: Doctors NEVER have an ABHA ID!
}

export type User = Patient | Doctor



export interface SavedIntakeSession {
  id: string
  session_date: string
  status: string
  language: string
  chief_complaint?: {
    symptom?: string | null
    duration?: string | null
  } | null
  clinical_record?: ClinicalHistoryRecord | null
  chat_history?: Array<{
    id?: string
    role: string
    content: string
    timestamp?: string
  }> | null
  ai_summary_text?: string | null
  ai_summary_sections?: SummarySections | null
  red_flag_active: boolean
  created_at: string
}

export interface SavedDocument {
  id: string
  session_id?: string | null
  filename: string
  file_type: string
  preview_url?: string | null
  structured_result?: OCRStructuredResult | null
  created_at: string
}

export interface ActiveMedication {
  drug_name: string
  dosage?: string | null
  frequency?: string | null
  duration?: string | null
  source_document: string
  prescription_date?: string | null
  end_date?: string | null
  is_active?: boolean
  days_remaining?: number | null
}

export interface PatientDashboardData {
  patient: User
  intake_sessions: SavedIntakeSession[]
  documents: SavedDocument[]
  active_medications: ActiveMedication[]
  past_medications?: ActiveMedication[]
}

export type AppView = 'login' | 'patient_dashboard' | 'intake' | 'doctor_portal' | 'patient_profile'

// ---- Doctor Portal Types -----------------------------------------

export interface DoctorPatientSummary {
  id: string
  name: string
  abha_id: string
  gender?: string | null
  age_years?: number | null
  phone?: string | null
  email?: string | null
  patient_details?: User['patient_details']
  latest_session?: {
    id: string
    session_date: string
    status: string
    language?: string
    chief_complaint?: {
      symptom?: string | null
      duration?: string | null
    } | null
    ai_summary_text?: string | null
    red_flag_active: boolean
  } | null
  total_documents_count: number
  total_sessions_count: number
  has_red_flags: boolean
  created_at: string
}

export interface DoctorPortalStats {
  total_patients: number
  red_flag_patients: number
  total_prescriptions: number
  total_consultations: number
}

export interface DoctorPatientsResponse {
  status: string
  total_patients: number
  stats: DoctorPortalStats
  patients: DoctorPatientSummary[]
}

// ---- Doctor Clinical Translation Types ---------------------------

export interface TranslateSessionRequest {
  session_id?: string
  target_language: LanguageCode | string
  source_language?: string
  chief_complaint?: string
  ai_summary_text?: string
  chat_history?: Array<{
    role: string
    content: string
  }>
}

export interface TranslateSessionResponse {
  status: string
  session_id?: string
  target_language: string
  source_language?: string
  translated_chief_complaint?: string | null
  translated_ai_summary_text?: string | null
  translated_chat_history: Array<{
    role: string
    content: string
  }>
}

export interface TranslateTextRequest {
  text?: string
  texts?: string[]
  target_language: string
  source_language?: string
}

export interface TranslateTextResponse {
  status: string
  target_language: string
  translated_text?: string | null
  translated_texts?: string[] | null
}
