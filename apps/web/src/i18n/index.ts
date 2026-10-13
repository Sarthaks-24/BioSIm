import i18n, { type BackendModule } from 'i18next'
import { initReactI18next } from 'react-i18next'
// en.json without the texts of the pages that bring their own (scripts/i18n-sections.mjs).
import en from 'virtual:lifepeek-en/core'
import { readPref, writePref } from '../lib/prefs.ts'

export const LANGUAGES = ['en', 'hi'] as const
export type Language = (typeof LANGUAGES)[number]

function initialLanguage(): Language {
  const saved = readPref('lang')
  if (saved === 'en' || saved === 'hi') return saved
  return navigator.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en'
}

/**
 * English is bundled with the app: it is the fallback for every key. Hindi is its own file,
 * fetched when it is first needed (at start for a Hindi reader, or on switching), so English
 * readers don't download it: about 13 KB gzipped off every page (roadmap A8 budgets). The service
 * worker caches it with the rest of the app, so switching works offline too.
 */
const locales: BackendModule = {
  type: 'backend',
  init: () => undefined,
  read: (lng, _ns, done) => {
    if (lng === 'hi')
      import('./hi.json').then(
        (m) => done(null, m.default),
        (e: Error) => done(e, false),
      )
    else done(null, lng === 'en' ? en : {})
  },
}

const first = initialLanguage()

/** Resolves once the first language is ready; main.tsx draws the app after it (never in a half-loaded language). */
export const i18nReady = i18n
  .use(locales)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    partialBundledLanguages: true,
    lng: first,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnObjects: true,
  })

document.documentElement.lang = first
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  writePref('lang', lng)
})

/**
 * Adds a page's own English text (its `virtual:lifepeek-en/<section>`), when the page's code
 * loads, before it draws. Hindi needs no such step: hi.json is fetched whole.
 */
export function addEnglish(...texts: Record<string, unknown>[]) {
  for (const text of texts) i18n.addResourceBundle('en', 'translation', text, true, true)
}

/** Pick the user's language from a food file's { en, hi? } text. */
export function localized(text: { en: string; hi?: string | undefined } | undefined, lang: string): string {
  if (!text) return ''
  return lang === 'hi' && text.hi ? text.hi : text.en
}

export default i18n
