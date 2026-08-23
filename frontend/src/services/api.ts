import axios from 'axios'
import type {
  ChatApiRequest,
  ChatApiResponse,
  LanguageCode,
  ChatHistoryEntry,
  ScanApiResponse,
} from '../types'

// ----------------------------------------------------------------
// Axios client
// ----------------------------------------------------------------

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 60_000, // 60 s — VLM calls can take a moment
  headers: {
    'Content-Type': 'application/json',
  },
})

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

  const { data } = await axios.post<ScanApiResponse>('/api/v1/scan-document', form, {
    timeout: 90_000, // Vision model can be slower
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
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
    if (error.response?.status === 0 || error.code === 'ERR_NETWORK') {
      return 'Cannot reach the Sanjivani server. Please check your connection.'
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}
