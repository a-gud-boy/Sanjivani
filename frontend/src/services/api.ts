import axios from 'axios'
import type {
  ChatApiRequest,
  ChatApiResponse,
  ChatHistoryEntry,
  ChatInitApiResponse,
  ClinicalHistoryRecord,
  LanguageCode,
  OCRStructuredResult,
  ScanApiResponse,
  ScannedDocument,
  SummarizeApiResponse,
} from '../types'

// ----------------------------------------------------------------
// Axios client
// ----------------------------------------------------------------

const apiEnvBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').trim()
const baseURL = apiEnvBase
  ? (apiEnvBase.endsWith('/api/v1') ? apiEnvBase : `${apiEnvBase.replace(/\/+$/, '')}/api/v1`)
  : '/api/v1'

const apiClient = axios.create({
  baseURL,
  timeout: 60_000, // 60 s — VLM calls can take a moment
  headers: {
    'Content-Type': 'application/json',
  },
})

// ----------------------------------------------------------------
// Chat Init — GET /api/v1/chat/init
// ----------------------------------------------------------------

export async function getInitialGreeting(
  language: LanguageCode,
  patientName?: string,
): Promise<ChatInitApiResponse> {
  const params: Record<string, string> = { language }
  if (patientName) params.patient_name = patientName
  const { data } = await apiClient.get<ChatInitApiResponse>('/chat/init', { params })
  return data
}

// ----------------------------------------------------------------
// Chat — POST /api/v1/chat
// ----------------------------------------------------------------

export async function sendChatMessage(
  userText: string,
  language: LanguageCode,
  chatHistory: ChatHistoryEntry[],
  currentJsonState: object | null = null,
): Promise<ChatApiResponse> {
  const payload: ChatApiRequest = {
    user_text: userText,
    language,
    current_json_state: currentJsonState,
    chat_history: chatHistory,
  }

  const { data } = await apiClient.post<ChatApiResponse>('/chat', payload)
  return data
}

// ----------------------------------------------------------------
// Document Scanner — POST /api/v1/scan-document
// ----------------------------------------------------------------

export async function scanDocument(
  file: File | Blob,
  /** Optional filename, useful when Blob comes from camera capture */
  filename = 'document.png',
): Promise<ScanApiResponse> {
  const form = new FormData()
  form.append('file', file instanceof File ? file : new File([file], filename, { type: file.type || 'image/png' }))

  const { data } = await apiClient.post<ScanApiResponse>('/scan-document', form, {
    timeout: 90_000, // Vision model can be slower
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

// ----------------------------------------------------------------
// Models — GET & POST /api/v1/models
// ----------------------------------------------------------------

export async function fetchAvailableModels() {
  const { data } = await apiClient.get<{
    status: string
    active_text_model: string
    active_vision_model: string
    models: import('../types').ModelInfo[]
  }>('/models')
  return data
}

export async function switchActiveModel(modelName: string, target: 'text' | 'vision' | 'both' = 'both') {
  const { data } = await apiClient.post<{
    status: string
    message: string
    active_text_model: string
    active_vision_model: string
  }>('/models/select', {
    model_name: modelName,
    target,
  })
  return data
}

// ----------------------------------------------------------------
// Clinical Summary — POST /api/v1/summarize
// ----------------------------------------------------------------

export async function generateSummary(
  language: LanguageCode,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  clinicalRecord: ClinicalHistoryRecord | null,
  scannedDocuments: ScannedDocument[],
): Promise<SummarizeApiResponse> {
  const scanResults = scannedDocuments.map((doc) => ({
    document_label: doc.filename,
    medications: doc.result?.medications ?? [],
    lab_investigations: doc.result?.lab_investigations ?? [],
    raw_text: doc.result?.raw_text ?? null,
  }))

  const { data } = await apiClient.post<SummarizeApiResponse>(
    '/summarize',
    {
      language,
      chat_history: chatHistory,
      clinical_record: clinicalRecord,
      scan_results: scanResults,
    },
    {
      timeout: 90_000,
    },
  )
  return data
}

// ----------------------------------------------------------------
// Unified error extractor
// ----------------------------------------------------------------

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg ?? String(d)).join('; ')
    if (
      error.response?.status === 0 ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      error.response?.status === 502 ||
      error.response?.status === 503 ||
      error.response?.status === 504 ||
      (error.response?.status === 500 && !error.response?.data?.detail)
    ) {
      return 'Cannot reach the Sanjivani server. Please check your connection.'
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}

// ----------------------------------------------------------------
// Auth & ABHA OTP Endpoints
// ----------------------------------------------------------------

export interface RequestOtpResult {
  status: string
  message: string
  masked_phone?: string | null
  simulated_otp: string
  abha_id: string
  user_name: string
  user_type: string
}

export interface VerifyOtpResult {
  status: string
  token: string
  user: import('../types').User
}

export async function requestOtp(
  abhaId: string,
  userType: 'patient' | 'doctor',
): Promise<RequestOtpResult> {
  const { data } = await apiClient.post<RequestOtpResult>('/auth/request-otp', {
    abha_id: abhaId,
    user_type: userType,
  })
  return data
}

export async function verifyOtp(
  abhaId: string,
  otp: string,
  userType: 'patient' | 'doctor',
): Promise<VerifyOtpResult> {
  const { data } = await apiClient.post<VerifyOtpResult>('/auth/verify-otp', {
    abha_id: abhaId,
    otp,
    user_type: userType,
  })
  return data
}

export interface RegisterPayload {
  user_type: 'patient' | 'doctor'
  name: string
  abha_id: string
  phone?: string
  email?: string
  gender?: string
  age_years?: number
  dob?: string
  blood_group?: string
  address_line?: string
  city?: string
  state?: string
  pincode?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relation?: string
  specialization?: string
  license_no?: string
  hospital?: string
  department?: string
  qualifications?: string
}

export interface RegisterResult {
  status: string
  message: string
  user_type: string
  abha_id: string
  token?: string
  user?: import('../types').User
}

export async function registerUser(payload: RegisterPayload): Promise<RegisterResult> {
  const { data } = await apiClient.post<RegisterResult>('/auth/register', payload)
  return data
}

export async function getMe(userId?: string): Promise<import('../types').User> {
  const params = userId ? { user_id: userId } : {}
  const { data } = await apiClient.get<import('../types').User>('/auth/me', { params })
  return data
}

// ----------------------------------------------------------------
// Patient Dashboard & Intake Session Persistence
// ----------------------------------------------------------------

export async function getPatientDashboard(
  patientId: string,
): Promise<import('../types').PatientDashboardData> {
  const { data } = await apiClient.get<import('../types').PatientDashboardData>(
    '/patient/dashboard',
    {
      params: { patient_id: patientId },
    },
  )
  return data
}

export async function saveIntakeSession(payload: {
  patient_id: string
  session_id?: string | null
  language?: string
  chat_history?: Array<{
    id?: string
    role: string
    content: string
    timestamp?: string | Date
    quickReplies?: string[]
  }>
  clinical_record?: import('../types').ClinicalHistoryRecord | null
  scanned_documents?: import('../types').ScannedDocument[]
  ai_summary_text?: string | null
  ai_summary_sections?: import('../types').SummarySections | null
  red_flag_active?: boolean
}): Promise<{ status: string; session_id: string; message: string; saved_documents_count: number }> {
  const { data } = await apiClient.post('/patient/intake-session', payload)
  return data
}

export async function deletePatientDocument(
  docId: string,
): Promise<{ status: string; message: string; deleted_id: string }> {
  const { data } = await apiClient.delete(`/patient/document/${docId}`)
  return data
}

export async function deleteIntakeSession(
  sessionId: string,
): Promise<{ status: string; message: string; deleted_id: string }> {
  const { data } = await apiClient.delete(`/patient/intake-session/${sessionId}`)
  return data
}

export async function updatePatientProfile(payload: {
  patient_id: string
  name?: string
  gender?: string
  age_years?: number
  phone?: string
  email?: string
  patient_details?: Record<string, unknown>
}): Promise<{ status: string; message: string; patient: import('../types').User }> {
  const { data } = await apiClient.put('/patient/profile', payload)
  return data
}

export async function getDoctorPatients(
  query?: string,
  redFlagOnly?: boolean,
): Promise<import('../types').DoctorPatientsResponse> {
  const params: Record<string, string | boolean> = {}
  if (query && query.trim()) {
    params.query = query.trim()
  }
  if (redFlagOnly) {
    params.red_flag_only = true
  }
  const { data } = await apiClient.get('/doctor/patients', { params })
  return data
}

export async function getDoctorPatientDossier(
  patientId: string,
): Promise<import('../types').PatientDashboardData> {
  const { data } = await apiClient.get(`/doctor/patient/${patientId}`)
  return data
}
