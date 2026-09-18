import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LanguageSelector from '../components/LanguageSelector'

describe('LanguageSelector Component', () => {
  it('renders with active language label', () => {
    const handleLanguageChange = vi.fn()
    render(
      <LanguageSelector language="en" onLanguageChange={handleLanguageChange} />
    )

    const trigger = screen.getByRole('button', { name: /change language/i })
    expect(trigger).toBeDefined()
    expect(trigger.textContent).toContain('English')
  })

  it('opens language options when clicked and selects new language', () => {
    const handleLanguageChange = vi.fn()
    render(
      <LanguageSelector language="en" onLanguageChange={handleLanguageChange} />
    )

    const trigger = screen.getByRole('button', { name: /change language/i })
    fireEvent.click(trigger)

    // Select Hindi option
    const hindiOption = screen.getByText('हिन्दी')
    expect(hindiOption).toBeDefined()
    fireEvent.click(hindiOption)

    expect(handleLanguageChange).toHaveBeenCalledWith('hi')
  })
})
