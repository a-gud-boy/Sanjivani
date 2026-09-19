import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PatientProfile from '../components/Profile/PatientProfile'
import type { User } from '../types'

vi.mock('../services/api', () => ({
  updatePatientProfile: vi.fn().mockResolvedValue({ status: 'success', patient: {} }),
  extractErrorMessage: vi.fn((err) => String(err)),
}))

const mockPatient: User = {
  id: 'p-123',
  abha_id: '14-1234-5678-9012',
  name: 'Ramesh Patel',
  user_type: 'patient',
  patient_details: {
    allergies: ['Penicillin / Amoxicillin'],
    chronic_conditions: ['Hypertension (High Blood Pressure)'],
  },
}

describe('PatientProfile Component - Allergy & Condition Support', () => {
  it('renders initial allergies and chronic conditions as badges', () => {
    render(
      <PatientProfile
        patient={mockPatient}
        onSave={vi.fn()}
        onBackToDashboard={vi.fn()}
      />
    )

    // Elements exist in badge and select options, getAllByText returns both
    expect(screen.getAllByText('Penicillin / Amoxicillin').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Hypertension (High Blood Pressure)').length).toBeGreaterThanOrEqual(1)
  })

  it('allows adding a common allergy from the dropdown', () => {
    render(
      <PatientProfile
        patient={mockPatient}
        onSave={vi.fn()}
        onBackToDashboard={vi.fn()}
      />
    )

    const select = screen.getByDisplayValue('Select common allergy...')
    fireEvent.change(select, { target: { value: 'Peanuts' } })

    const addButtons = screen.getAllByRole('button', { name: /add/i })
    // The first Add button corresponds to Allergies
    fireEvent.click(addButtons[0])

    // Should appear in badges and select option
    expect(screen.getAllByText('Peanuts').length).toBeGreaterThanOrEqual(2)
  })

  it('shows textbox when "Others (specify)" is selected and allows adding custom allergy', () => {
    render(
      <PatientProfile
        patient={mockPatient}
        onSave={vi.fn()}
        onBackToDashboard={vi.fn()}
      />
    )

    const select = screen.getByDisplayValue('Select common allergy...')
    fireEvent.change(select, { target: { value: 'Others (specify)' } })

    const textbox = screen.getByPlaceholderText('Specify allergy name...')
    expect(textbox).toBeInTheDocument()

    fireEvent.change(textbox, { target: { value: 'Mango SAP / Pollen' } })

    const addButtons = screen.getAllByRole('button', { name: /add/i })
    fireEvent.click(addButtons[0])

    expect(screen.getByText('Mango SAP / Pollen')).toBeInTheDocument()
  })

  it('allows removing an allergy badge', () => {
    render(
      <PatientProfile
        patient={mockPatient}
        onSave={vi.fn()}
        onBackToDashboard={vi.fn()}
      />
    )

    const initialMatches = screen.getAllByText('Penicillin / Amoxicillin').length

    const removeBtn = screen.getByTitle('Remove Penicillin / Amoxicillin')
    fireEvent.click(removeBtn)

    // Badge removed, only select option remains
    const afterMatches = screen.getAllByText('Penicillin / Amoxicillin').length
    expect(afterMatches).toBe(initialMatches - 1)
  })

  it('shows textbox when "Others (specify)" is selected for chronic conditions', () => {
    render(
      <PatientProfile
        patient={mockPatient}
        onSave={vi.fn()}
        onBackToDashboard={vi.fn()}
      />
    )

    const select = screen.getByDisplayValue('Select common chronic condition...')
    fireEvent.change(select, { target: { value: 'Others (specify)' } })

    const textbox = screen.getByPlaceholderText('Specify condition name...')
    expect(textbox).toBeInTheDocument()

    fireEvent.change(textbox, { target: { value: 'Celiac Disease' } })

    const addButtons = screen.getAllByRole('button', { name: /add/i })
    // Second Add button is for Chronic Conditions
    fireEvent.click(addButtons[1])

    expect(screen.getByText('Celiac Disease')).toBeInTheDocument()
  })
})
