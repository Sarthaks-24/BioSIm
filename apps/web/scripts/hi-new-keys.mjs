// The English strings Hindi does not have yet (R47). While Hindi is paused a new key may go into
// en.json only (i18next shows English for it); this prints those keys, so the list of what to
// translate when Hindi comes back is never kept by hand. Report only: it always exits 0.
//
//   node apps/web/scripts/hi-new-keys.mjs
//
// Some are English-only on purpose and need no Hindi: link.hindiLater, stats.englishOnly and the
// English-only texts of scripts/i18n-sections.mjs (ENGLISH_ONLY) show only in a build without Hindi.
import { readTexts } from './hi-review.mjs'
import { ENGLISH_ONLY } from './i18n-sections.mjs'

/** Keys (in REVIEW.md's spelling) that show only without Hindi. */
const ONLY_WITHOUT_HINDI = new Set(['link.hindiLater', 'stats.englishOnly', ...Object.values(ENGLISH_ONLY)])

const { en, hi } = readTexts()
const missing = [...en.keys()].filter((key) => !hi.has(key))
const [todo, englishOnly] = [missing.filter((k) => !ONLY_WITHOUT_HINDI.has(k)), missing.filter((k) => ONLY_WITHOUT_HINDI.has(k))]
for (const key of todo) console.log(`${key}  "${en.get(key).slice(0, 80)}"`)
console.log(`\n${todo.length} English string(s) without Hindi yet.`)
if (englishOnly.length) console.log(`Not counted, English only on purpose: ${englishOnly.join(', ')}.`)
