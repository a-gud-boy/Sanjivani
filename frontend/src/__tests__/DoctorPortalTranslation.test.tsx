import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DoctorPortal from '../components/Doctor/DoctorPortal'
import type { Doctor, PatientDashboardData } from '../types'
import * as api from '../services/api'

const mockDoctor: Doctor = {
  id: 'doc-1',
  hp_id: 'HP-RJ-68717',
  user_type: 'doctor',
  name: 'Dr. Avirup Banerjee',
  specialization: 'Ayurvedic Medicine',
  hospital: 'AIIMS New Delhi',
  doctor_details: {
    specialization: 'Ayurvedic Medicine',
    hospital: 'AIIMS New Delhi',
  },
}

const mockDossierWithHindiSession: PatientDashboardData = {
  patient: {
    id: 'p-1',
    abha_id: '14-1111-2222-3333',
    user_type: 'patient',
    name: 'Ramesh Sharma',
    gender: 'Male',
    age_years: 45,
    patient_details: {
      blood_group: 'B+',
    },
  },
  intake_sessions: [
    {
      id: 'sess-hi-1',
      session_date: '2026-09-20T10:00:00Z',
      status: 'submitted',
      language: 'hi',
      chief_complaint: {
        symptom: 'तेज सिरदर्द और बुखार',
        duration: '3 दिन',
      },
      ai_summary_text: 'मरीज को पिछले 3 दिनों से तेज सिरदर्द और बुखार है।',
      chat_history: [
        { role: 'user', content: 'मुझे तीन दिनों से तेज सिरदर्द है।' },
        { role: 'assistant', content: 'क्या आपको बुखार या उल्टी भी हो रही है?' },
        { role: 'user', content: 'हाँ, हल्का बुखार भी है।' },
      ],
      red_flag_active: false,
      created_at: '2026-09-20T10:00:00Z',
    },
  ],
  documents: [],
  active_medications: [],
  past_medications: [],
}

describe('DoctorPortal Translation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(api, 'getDoctorPatients').mockResolvedValue({
      status: 'success',
      total_patients: 1,
      stats: {
        total_patients: 1,
        red_flag_patients: 0,
        total_prescriptions: 0,
        total_consultations: 1,
      },
      patients: [
        {
          id: 'p-1',
          name: 'Ramesh Sharma',
          abha_id: '14-1111-2222-3333',
          gender: 'Male',
          age_years: 45,
          total_documents_count: 0,
          total_sessions_count: 1,
          has_red_flags: false,
          created_at: '2026-09-20T10:00:00Z',
          latest_session: {
            id: 'sess-hi-1',
            session_date: '2026-09-20T10:00:00Z',
            status: 'submitted',
            language: 'hi',
            chief_complaint: { symptom: 'तेज सिरदर्द और बुखार' },
            ai_summary_text: 'मरीज को सिरदर्द है',
            red_flag_active: false,
          },
        },
      ],
    })
    vi.spyOn(api, 'getDoctorPatientDossier').mockResolvedValue(mockDossierWithHindiSession)
  })

  it('renders patient queue with Hindi session language indicator', async () => {
    render(
      <DoctorPortal
        doctor={mockDoctor}
        onLogout={vi.fn()}
        language="en"
        onLanguageChange={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Ramesh Sharma')).toBeDefined()
    })

    // Patient queue metadata shows Hindi badge
    expect(screen.getAllByText(/हिन्दी/i).length).toBeGreaterThan(0)
  })

  it('shows translate button when patient used a different language in dossier', async () => {
    render(
      <DoctorPortal
        doctor={mockDoctor}
        onLogout={vi.fn()}
        language="en"
        onLanguageChange={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Ramesh Sharma')).toBeDefined()
    })

    // Click Review Dossier
    const reviewBtn = screen.getByRole('button', { name: /review dossier/i })
    fireEvent.click(reviewBtn)

    await waitFor(() => {
      // Original Hindi complaint and summary should be visible
      expect(screen.getAllByText('तेज सिरदर्द और बुखार').length).toBeGreaterThan(0)
      expect(screen.getByText('मरीज को पिछले 3 दिनों से तेज सिरदर्द और बुखार है।')).toBeDefined()
    })

    // Translate button to English should be present
    const translateBtn = screen.getByRole('button', { name: /translate to/i })
    expect(translateBtn).toBeDefined()
  })

  it('translates session and toggles between Original and Translated views', async () => {
    const translateSpy = vi.spyOn(api, 'translateDoctorSession').mockResolvedValue({
      status: 'success',
      session_id: 'sess-hi-1',
      target_language: 'en',
      source_language: 'hi',
      translated_chief_complaint: 'Severe headache and fever',
      translated_ai_summary_text: 'Patient has a severe headache and fever for the past 3 days.',
      translated_chat_history: [
        { role: 'user', content: 'I have had a severe headache for three days.' },
        { role: 'assistant', content: 'Are you also experiencing fever or vomiting?' },
        { role: 'user', content: 'Yes, I also have a mild fever.' },
      ],
    })

    render(
      <DoctorPortal
        doctor={mockDoctor}
        onLogout={vi.fn()}
        language="en"
        onLanguageChange={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Ramesh Sharma')).toBeDefined()
    })

    // Open dossier
    fireEvent.click(screen.getByRole('button', { name: /review dossier/i }))

    await waitFor(() => {
      expect(screen.getAllByText('तेज सिरदर्द और बुखार').length).toBeGreaterThan(0)
    })

    // Click Translate to English
    const translateBtn = screen.getByRole('button', { name: /translate to/i })
    fireEvent.click(translateBtn)

    expect(translateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'sess-hi-1',
        target_language: 'en',
        source_language: 'hi',
      })
    )

    // After translation, English text should be displayed
    await waitFor(() => {
      expect(screen.getByText('Severe headache and fever')).toBeDefined()
      expect(
        screen.getByText('Patient has a severe headache and fever for the past 3 days.')
      ).toBeDefined()
    })

    // Toggle button should allow viewing Original
    const originalBtn = screen.getByRole('button', { name: /original/i })
    fireEvent.click(originalBtn)

    // Should show original Hindi text again
    expect(screen.getAllByText('तेज सिरदर्द और बुखार').length).toBeGreaterThan(0)
    expect(screen.getByText('मरीज को पिछले 3 दिनों से तेज सिरदर्द और बुखार है।')).toBeDefined()

    // Toggle back to Translated
    const translatedBtn = screen.getByRole('button', { name: /translated/i })
    fireEvent.click(translatedBtn)

    expect(screen.getByText('Severe headache and fever')).toBeDefined()
  })
})
