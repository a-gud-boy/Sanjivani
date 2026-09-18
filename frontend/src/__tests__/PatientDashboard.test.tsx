import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PatientDashboard from '../components/Dashboard/PatientDashboard'
import type { User } from '../types'

const mockPatient: User = {
  id: 'p-123',
  abha_id: '14-5555-4444-3333',
  name: 'Suresh Kumar',
  user_type: 'patient',
  phone: undefined,
  age_years: undefined,
  gender: undefined,
  patient_details: {},
}

describe('PatientDashboard Component', () => {
  it('renders Add Details button in English without hardcoded Hindi', () => {
    const onStartIntake = vi.fn()
    render(
      <PatientDashboard
        patient={mockPatient}
        dashboardData={null}
        isLoading={false}
        language="en"
        onLanguageChange={vi.fn()}
        onStartIntake={onStartIntake}
        onOpenProfile={vi.fn()}
        onLogout={vi.fn()}
        onDeleteDocument={vi.fn()}
        onDeleteIntakeSession={vi.fn()}
      />
    )

    // Check that Add Details button exists
    const addDetailsButtons = screen.getAllByRole('button', { name: /add details/i })
    expect(addDetailsButtons.length).toBeGreaterThan(0)
    expect(addDetailsButtons[0].textContent).not.toContain('नया विवरण जोड़ें')

    // Click Add Details
    fireEvent.click(addDetailsButtons[0])
    expect(onStartIntake).toHaveBeenCalled()
  })

  it('renders "Not documented" when blood group is not recorded (FE-02 safety)', () => {
    render(
      <PatientDashboard
        patient={mockPatient}
        dashboardData={null}
        isLoading={false}
        language="en"
        onLanguageChange={vi.fn()}
        onStartIntake={vi.fn()}
        onOpenProfile={vi.fn()}
        onLogout={vi.fn()}
        onDeleteDocument={vi.fn()}
        onDeleteIntakeSession={vi.fn()}
      />
    )

    expect(screen.getByText(/not documented/i)).toBeDefined()
  })
})
