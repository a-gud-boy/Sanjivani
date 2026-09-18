import { describe, it, expect } from 'vitest'
import { TRANSLATIONS, MULTILINGUAL_END_INTENT_PHRASES } from '../i18n/translations'
import type { LanguageCode } from '../types'

const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu']

describe('i18n Translations Suite', () => {
  it('should define all 7 supported Indian languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(TRANSLATIONS[lang]).toBeDefined()
      expect(TRANSLATIONS[lang].auth).toBeDefined()
      expect(TRANSLATIONS[lang].header).toBeDefined()
      expect(TRANSLATIONS[lang].dashboard).toBeDefined()
      expect(TRANSLATIONS[lang].chat).toBeDefined()
      expect(TRANSLATIONS[lang].doctor).toBeDefined()
    }
  })

  it('should have localized doctor portal dictionaries for all 7 languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const doc = TRANSLATIONS[lang].doctor
      expect(doc.hprVerified).toBeTruthy()
      expect(doc.stationTitle).toBeTruthy()
      expect(doc.clinicalReviewTitle).toBeTruthy()
      expect(doc.dutyActive).toBeTruthy()
      expect(doc.registeredPatients).toBeTruthy()
      expect(doc.triageRedFlags).toBeTruthy()
      expect(doc.digitizedPrescriptions).toBeTruthy()
      expect(doc.consultationSessions).toBeTruthy()
      expect(doc.searchPlaceholder).toBeTruthy()
    }
  })

  it('should define multilingual end intent phrases across all 7 languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const phrases = MULTILINGUAL_END_INTENT_PHRASES[lang]
      expect(Array.isArray(phrases)).toBe(true)
      expect(phrases.length).toBeGreaterThan(0)
    }
  })

  it('should provide localized end intent prompt and confirmation buttons', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const chat = TRANSLATIONS[lang].chat
      expect(chat.endIntentPrompt).toBeTruthy()
      expect(chat.endIntentYes).toBeTruthy()
      expect(chat.endIntentNo).toBeTruthy()
    }
  })

  it('should have localized dashboard addDetails without hardcoded strings', () => {
    expect(TRANSLATIONS.en.dashboard.addDetails).toBe('Add Details')
    expect(TRANSLATIONS.hi.dashboard.addDetails).toBe('लक्षण जोड़ें')
    expect(TRANSLATIONS.ta.dashboard.addDetails).toBe('அறிகுறிகளைச் சேர்க்க')
    expect(TRANSLATIONS.bn.dashboard.addDetails).toBe('লক্ষণ যোগ করুন')
  })
})
