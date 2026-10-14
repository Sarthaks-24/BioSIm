import i18n from 'i18next'
import { PSEUDO_LANG, pseudoBundle } from './pseudo.ts'

/** The +40 % pseudo-locale of the layout tests (i18n/index.ts): never in a real build. */
const PSEUDO = import.meta.env.VITE_PSEUDO === '1'

/**
 * Adds a page's own English text (its `virtual:lifepeek-en/<section>`), when the page's code
 * loads, before it draws. Hindi needs no such step: hi.json is fetched whole.
 */
export function addEnglish(...texts: Record<string, unknown>[]) {
  for (const text of texts) {
    i18n.addResourceBundle('en', 'translation', text, true, true)
    if (PSEUDO) i18n.addResourceBundle(PSEUDO_LANG, 'translation', pseudoBundle(text), true, true)
  }
}

const sections = new Map<string, Promise<void>>()

/**
 * Adds a system pack's English text (`sys.<packId>`, scripts/i18n-sections.mjs) the first time its
 * system is lit (systems/load.ts `loadPack`), once: later calls get the same promise. A failed
 * load is forgotten, so "Try again" loads it again (R71). The Hindi half (I-1h, parked by R47)
 * adds the pack's Hindi here too, before the language changes.
 */
export function loadSection(name: string, load: () => Promise<{ default: Record<string, unknown> }>): Promise<void> {
  let loading = sections.get(name)
  if (!loading) {
    loading = load().then((m) => addEnglish(m.default))
    loading.catch(() => sections.delete(name))
    sections.set(name, loading)
  }
  return loading
}
