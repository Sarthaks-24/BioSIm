import i18n, { type BackendModule } from 'i18next'
import { initReactI18next } from 'react-i18next'
// en.json without the texts of the pages that bring their own (scripts/i18n-sections.mjs).
import en from 'virtual:lifepeek-en/core'
import { readPref, writePref } from '../lib/prefs.ts'
import { HINDI, langPrefToSave, pickLanguage, type Language } from './language.ts'
import { PSEUDO_LANG, pseudoBundle, pseudoText } from './pseudo.ts'
// Adding a page's or a pack's English (i18n/text.ts: loadSection), apart from this file so the registry
// loads a pack's words without the core text, and its unit tests without the build's English modules.
export { addEnglish } from './text.ts'

export { HINDI, type Language }
/** The languages this build has: English only while Hindi is paused (R47, i18n/language.ts). */
export const LANGUAGES: readonly Language[] = HINDI ? ['en', 'hi'] : ['en']

/**
 * The +40 % pseudo-locale (i18n/pseudo.ts), for the layout tests only: a build without
 * `VITE_PSEUDO=1` (every real one) has no trace of it.
 */
const PSEUDO = import.meta.env.VITE_PSEUDO === '1'

function initialLanguage(): Language {
  const saved = readPref('lang')
  if (PSEUDO && (saved === PSEUDO_LANG || new URLSearchParams(location.search).get('lang') === 'pseudo')) return PSEUDO_LANG as Language
  // A Hindi choice saved before Hindi was paused is ignored, and kept (langPrefToSave).
  return pickLanguage(saved, navigator.language)
}

/**
 * English is bundled with the app: it is the fallback for every key. Hindi (only in a Hindi build) is its own file,
 * fetched when it is first needed (at start for a Hindi reader, or on switching), so English
 * readers don't download it: about 13 KB gzipped off every page (roadmap A8 budgets). The service
 * worker caches it with the rest of the app, so switching works offline too.
 */
const locales: BackendModule = {
  type: 'backend',
  init: () => undefined,
  read: (lng, _ns, done) => {
    // HINDI, written out: the flag is fixed at build time, so without it the bundler drops the
    // import and never makes hi.json's chunk. (Through the imported HINDI constant it still made
    // the chunk, unused, and the service worker cached it.)
    if (import.meta.env.VITE_HINDI === '1' && lng === 'hi')
      import('./hi.json').then(
        (m) => done(null, m.default),
        (e: Error) => done(e, false),
      )
    else if (PSEUDO && lng === PSEUDO_LANG) done(null, pseudoBundle(en))
    else done(null, lng === 'en' ? en : {})
  },
}

const first = initialLanguage()

const initialized = i18n
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

/**
 * Resolves once the first language is ready; main.tsx draws the app after it (never in a half-loaded
 * language). A Hindi build also waits for Hindi's font (i18n/devanagari.css). The flag is written out,
 * as in `locales`: a build without Hindi has neither the font's CSS nor its files (R47).
 */
export const i18nReady =
  import.meta.env.VITE_HINDI === '1' ? Promise.all([initialized, import('./devanagari.css')]).then(([t]) => t) : initialized

document.documentElement.lang = first
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  const pref = langPrefToSave(lng, readPref('lang'))
  if (pref) writePref('lang', pref)
})

/** Pick the user's language from a food file's { en, hi? } text. */
export function localized(text: { en: string; hi?: string | undefined } | undefined, lang: string): string {
  if (!text) return ''
  if (PSEUDO && lang === PSEUDO_LANG) return pseudoText(text.en)
  return lang === 'hi' && text.hi ? text.hi : text.en
}

export default i18n
