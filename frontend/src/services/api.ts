import axios from 'axios'
import type {
  ChatApiRequest,
  ChatApiResponse,
  ChatHistoryEntry,
  ChatInitApiResponse,
  ClinicalHistoryRecord,
  LanguageCode,
  ScanApiResponse,
  ScannedDocument,
  SummarizeApiResponse,
} from '../types'

// ----------------------------------------------------------------
// Axios client
// ----------------------------------------------------------------

let apiEnvBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').trim()

// Auto-correct any references to "sanjivani-api.onrender.com" to the live Render deployment
if (apiEnvBase.includes('sanjivani-api.onrender.com')) {
  apiEnvBase = apiEnvBase.replace('sanjivani-api.onrender.com', 'sanjivani-9ne0.onrender.com')
}

// In production hosted environments (e.g. GitHub Pages or custom domains), fallback to live backend
if (!apiEnvBase && typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  apiEnvBase = 'https://sanjivani-9ne0.onrender.com'
}

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

// SEC-03 Remediation: Attach Authorization Bearer token to all outgoing requests
apiClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('sanjivani_auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (err) {
    console.warn('Unable to read auth token from localStorage:', err)
  }
  return config
})

// Handle 401 Unauthorized globally (session expired, invalid token, or patient profile reset)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAuthToken()
      try {
        localStorage.removeItem('sanjivani_auth_user')
      } catch (err) {
        console.warn('Unable to remove stored auth user on 401:', err)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sanjivani:auth-expired'))
      }
    }
    return Promise.reject(error)
  },
)

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('sanjivani_auth_token')
  } catch {
    return null
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem('sanjivani_auth_token', token)
  } catch (err) {
    console.warn('Unable to persist auth token in localStorage:', err)
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem('sanjivani_auth_token')
  } catch (err) {
    console.warn('Unable to clear auth token from localStorage:', err)
  }
}

// ----------------------------------------------------------------
// Chat Init — GET /api/v1/chat/init
// ----------------------------------------------------------------

export async function getInitialGreeting(
  language: LanguageCode,
  patientName?: string,
): Promise<ChatInitApiResponse> {
  const params: Record<string, string> = { language }
  if (patientName) params.patient_name = patientName
  const { data } = await apiClient.get<ChatInitApiResponse>('/chat/init', {
    params,
    timeout: 8_000,
  })
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
// Audio Transcription — POST /api/v1/chat/transcribe-audio
// ----------------------------------------------------------------

export async function transcribeAudio(
  audioFile: Blob | File,
  language: LanguageCode = 'en',
  filename = 'recording.webm',
): Promise<{ status: string; transcript: string }> {
  const form = new FormData()
  form.append(
    'audio',
    audioFile instanceof File ? audioFile : new File([audioFile], filename, { type: audioFile.type || 'audio/webm' }),
  )
  form.append('language', language)

  const { data } = await apiClient.post<{ status: string; transcript: string }>(
    '/chat/transcribe-audio',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30_000,
    },
  )
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
    timeout: 120_000, // Generous timeout for document OCR across cold starts or slow networks
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
// Auth & Identity Endpoints (Patient ABHA & Doctor HP ID)
// ----------------------------------------------------------------

export interface RequestOtpResult {
  status: string
  message: string
  masked_phone?: string | null
  otp?: string | null
  simulated_otp?: string | null
  abha_id?: string
  hp_id?: string | null
  user_name: string
  user_type: string
}

export interface VerifyOtpResult {
  status: string
  token: string
  user: import('../types').User
}

export interface PatientRegisterPayload {
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
}

export interface DoctorRegisterPayload {
  name: string
  hp_id: string  // Healthcare Professional ID (NO abha_id!)
  phone?: string
  email?: string
  gender?: string
  age_years?: number
  specialization?: string
  license_no?: string
  hospital?: string
  department?: string
  qualifications?: string
}

export interface RegisterPayload {
  user_type: 'patient' | 'doctor'
  name: string
  abha_id?: string
  hp_id?: string
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
  abha_id?: string
  hp_id?: string | null
  token?: string
  user?: import('../types').User
}

// ── Dedicated Patient API Methods ──
export async function requestPatientOtp(abhaId: string): Promise<RequestOtpResult> {
  const { data } = await apiClient.post<RequestOtpResult>('/auth/patient/request-otp', { abha_id: abhaId })
  return data
}

export async function verifyPatientOtp(abhaId: string, otp: string): Promise<VerifyOtpResult> {
  const { data } = await apiClient.post<VerifyOtpResult>('/auth/patient/verify-otp', { abha_id: abhaId, otp })
  if (data.token) {
    setAuthToken(data.token)
  }
  return data
}

export async function registerPatient(payload: PatientRegisterPayload): Promise<RegisterResult> {
  const { data } = await apiClient.post<RegisterResult>('/auth/patient/register', payload)
  if (data.token) {
    setAuthToken(data.token)
  }
  return data
}

// ── Dedicated Doctor API Methods (Zero ABHA) ──
export async function requestDoctorOtp(hpId: string): Promise<RequestOtpResult> {
  const { data } = await apiClient.post<RequestOtpResult>('/auth/doctor/request-otp', { hp_id: hpId })
  return data
}

export async function verifyDoctorOtp(hpId: string, otp: string): Promise<VerifyOtpResult> {
  const { data } = await apiClient.post<VerifyOtpResult>('/auth/doctor/verify-otp', { hp_id: hpId, otp })
  if (data.token) {
    setAuthToken(data.token)
  }
  return data
}

export async function registerDoctor(payload: DoctorRegisterPayload): Promise<RegisterResult> {
  const { data } = await apiClient.post<RegisterResult>('/auth/doctor/register', payload)
  if (data.token) {
    setAuthToken(data.token)
  }
  return data
}

// ── Unified Helpers ──
export async function requestOtp(
  id: string,
  userType: 'patient' | 'doctor',
): Promise<RequestOtpResult> {
  return userType === 'doctor' ? requestDoctorOtp(id) : requestPatientOtp(id)
}

export async function verifyOtp(
  id: string,
  otp: string,
  userType: 'patient' | 'doctor',
): Promise<VerifyOtpResult> {
  return userType === 'doctor' ? verifyDoctorOtp(id, otp) : verifyPatientOtp(id, otp)
}

export async function registerUser(payload: RegisterPayload): Promise<RegisterResult> {
  if (payload.user_type === 'doctor') {
    return registerDoctor({
      name: payload.name,
      hp_id: payload.hp_id || payload.abha_id || '',
      phone: payload.phone,
      email: payload.email,
      gender: payload.gender,
      age_years: payload.age_years,
      specialization: payload.specialization,
      license_no: payload.license_no,
      hospital: payload.hospital,
      department: payload.department,
      qualifications: payload.qualifications,
    })
  }
  return registerPatient({
    name: payload.name,
    abha_id: payload.abha_id || '',
    phone: payload.phone,
    email: payload.email,
    gender: payload.gender,
    age_years: payload.age_years,
    dob: payload.dob,
    blood_group: payload.blood_group,
    address_line: payload.address_line,
    city: payload.city,
    state: payload.state,
    pincode: payload.pincode,
    emergency_contact_name: payload.emergency_contact_name,
    emergency_contact_phone: payload.emergency_contact_phone,
    emergency_contact_relation: payload.emergency_contact_relation,
  })
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

export async function translateDoctorSession(
  payload: import('../types').TranslateSessionRequest,
): Promise<import('../types').TranslateSessionResponse> {
  const { data } = await apiClient.post<import('../types').TranslateSessionResponse>(
    '/doctor/translate-session',
    payload,
  )
  return data
}

export async function translateDoctorText(
  payload: import('../types').TranslateTextRequest,
): Promise<import('../types').TranslateTextResponse> {
  const { data } = await apiClient.post<import('../types').TranslateTextResponse>(
    '/doctor/translate',
    payload,
  )
  return data
}

/**
 * Silently pre-warms the backend on initial application load to wake up
 * Render free-tier containers in the background without UI interruption.
 */
export async function prewarmBackend(): Promise<void> {
  try {
    await apiClient.get('/health', { timeout: 60_000 })
  } catch {
    // Non-blocking silent background wake-up; intentionally suppress errors
  }
}

