import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import hi from './hi.json'
import { readPref, writePref } from '../lib/prefs.ts'

export const LANGUAGES = ['en', 'hi'] as const
export type Language = (typeof LANGUAGES)[number]

function initialLanguage(): Language {
  const saved = readPref('lang')
  if (saved === 'en' || saved === 'hi') return saved
  return navigator.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: true,
})

document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  writePref('lang', lng)
})

/** Pick the user's language from a food file's { en, hi? } text. */
export function localized(text: { en: string; hi?: string | undefined } | undefined, lang: string): string {
  if (!text) return ''
  return lang === 'hi' && text.hi ? text.hi : text.en
}

export default i18n
