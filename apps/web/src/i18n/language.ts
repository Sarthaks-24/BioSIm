/**
 * Hindi is paused (ruling R47): only a build with `VITE_HINDI=1` has it (Playwright's web server
 * sets it, so the Hindi tests keep running). Without it the app is English only: no language
 * button, a saved or browser Hindi is ignored, a `?lang=hi` link opens in English with a note, and
 * hi.json is not in the build at all. Hindi comes back as its own release.
 *
 * Kept apart from index.ts (which needs a browser) so the rules can be unit-tested.
 */
export const HINDI = import.meta.env.VITE_HINDI === '1'

export type Language = 'en' | 'hi'

/** The first language: a saved choice, else the browser's; Hindi only in a Hindi build. */
export function pickLanguage(saved: string | null, browser: string | undefined, hindi = HINDI): Language {
  if (!hindi) return 'en'
  if (saved === 'en' || saved === 'hi') return saved
  return browser?.toLowerCase().startsWith('hi') ? 'hi' : 'en'
}

/**
 * The language a link asks for, if this build has it (null: leave the language as it is). While
 * Hindi is paused a `?lang=hi` link gets null: it opens in English, with a note (sim.hindiLater).
 */
export function linkLanguage(lang: string | null | undefined, hindi = HINDI): Language | null {
  return lang === 'en' || (lang === 'hi' && hindi) ? lang : null
}
