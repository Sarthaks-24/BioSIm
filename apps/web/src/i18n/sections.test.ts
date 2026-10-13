import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from './en.json'
import { ENGLISH_ONLY, PAGE_SECTIONS, coreText, englishFor } from '../../scripts/i18n-sections.mjs'

/**
 * The English split (scripts/i18n-sections.mjs, review 15 LOW 5): a key of a page section that is
 * not kept in the core text only exists once its section has loaded. So only the files that come
 * with that section (they import `virtual:lifepeek-en/<section>`, or only those files draw them)
 * may use it; anywhere else it would show as its raw key until then. Add a file here only when it
 * loads with its section; otherwise keep the key in the core (PAGE_SECTIONS).
 */
const ALLOWED: Record<string, readonly string[]> = {
  privacy: ['pages/Privacy.tsx'],
  about: ['pages/About.tsx'],
  teach: ['pages/Teach.tsx'],
  science: ['pages/Science.tsx'],
  stats: ['pages/Stats.tsx'],
  feedback: ['components/FeedbackDialog.tsx', 'pages/About.tsx'],
  update: ['components/UpdateToast.tsx'],
  lesson: ['pages/Science.tsx'],
  // The panel, and the files that only name limits for it: it reads them when it draws (HowWeKnow's Say).
  limits: ['components/graphs/HowWeKnowPanel.tsx', 'components/graphs/StripStack.tsx', 'registry/human/systems.ts'],
  stages: ['components/stage/StageMore.tsx'],
  keys: ['components/stage/KeysHelp.tsx'],
  table: ['components/graphs/StripTable.tsx'],
  signals: ['components/graphs/HowWeKnowPanel.tsx'],
  link: ['components/stage/LinkNotes.tsx', 'lib/linkNotes.ts', 'components/stage/MealActions.tsx'],
  // The rings' notes are passed to the panel and read when it draws (Say), like the limits.
  graph: ['components/graphs/HowWeKnowPanel.tsx', 'components/graphs/StripStack.tsx'],
  // unitInWords is called by the panel only.
  units: ['components/graphs/HowWeKnowPanel.tsx', 'lib/formatSignal.ts'],
  profiles: ['components/graphs/HowWeKnowPanel.tsx', 'components/stage/MealActions.tsx'],
  disclaimer: ['pages/Science.tsx'],
}

function flatKeys(obj: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj))
    for (const [k, v] of Object.entries(obj)) flatKeys(v, prefix ? `${prefix}.${k}` : k, out)
  else out.add(prefix)
  return out
}

const root = fileURLToPath(new URL('..', import.meta.url))
function sources(dir = root, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.ts$/.test(name)) out.push(path)
  }
  return out
}

describe('the English split', () => {
  const all = [...flatKeys(en)]
  const core = flatKeys(coreText(en))

  /** The keys of en.json a pattern names that are not in the core text. */
  const split = (pattern: RegExp) => all.filter((k) => pattern.test(k) && !core.has(k))
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  it('every section has its list of files', () => {
    expect(Object.keys(ALLOWED).sort()).toEqual(Object.keys(PAGE_SECTIONS).sort())
  })

  it('a key that is not in the core text is used only by the files that load its section', () => {
    const wrong: string[] = []
    for (const path of sources()) {
      const file = relative(root, path).replaceAll('\\', '/')
      const src = readFileSync(path, 'utf8')
      const used: [string, RegExp][] = []
      // 'stages.mouth.what', and keys passed through helpers: any quoted dotted string.
      for (const m of src.matchAll(/'([a-z]\w*\.[\w.]+)'/gi)) used.push([m[1]!, new RegExp(`^${escape(m[1]!)}(\\.|$)`)])
      // `stages.${stage}.what`: the leaf after the variable part counts.
      for (const m of src.matchAll(/`([a-z]\w*\.[\w.]*)\$\{[^}]+\}([\w.]*)`/gi))
        used.push([`${m[1]}…${m[2]}`, new RegExp(`^${escape(m[1]!)}[^.]+${escape(m[2]!)}(\\.|$)`)])
      for (const [key, pattern] of used) {
        const section = key.split('.')[0]!
        if (!(section in PAGE_SECTIONS) || ALLOWED[section]!.includes(file)) continue
        const missing = split(pattern)
        if (missing.length) wrong.push(`${file}: ${key} (${missing[0]}${missing.length > 1 ? ', …' : ''})`)
      }
    }
    expect(wrong).toEqual([])
  })
})

// R47: while Hindi is paused no English text promises it. A build without Hindi ships the
// English-only version of each text that names Hindi; one with Hindi ships the text as it is.
describe('English without Hindi', () => {
  const at = (o: unknown, key: string) => key.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], o)

  it('a build without Hindi swaps in the English-only texts, which name no Hindi', () => {
    const shipped = englishFor(en, false)
    for (const [key, englishOnly] of Object.entries(ENGLISH_ONLY)) {
      expect(at(en, key), key).toMatch(/Hindi/)
      expect(at(shipped, key), key).toBe(at(en, englishOnly))
      expect(at(shipped, key), key).not.toMatch(/Hindi/)
      expect(at(shipped, englishOnly), englishOnly).toBeUndefined()
    }
  })

  it('a Hindi build ships the texts as they are, without the English-only ones', () => {
    const shipped = englishFor(en, true)
    for (const [key, englishOnly] of Object.entries(ENGLISH_ONLY)) {
      expect(at(shipped, key), key).toBe(at(en, key))
      expect(at(shipped, englishOnly), englishOnly).toBeUndefined()
    }
  })
})
