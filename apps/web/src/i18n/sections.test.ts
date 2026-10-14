import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EVENTS, SIGNALS, type ActiveSignalId } from '@lifepeek/engine'
import en from './en.json'
import { ENGLISH_ONLY, PACK_SECTIONS, PAGE_SECTIONS, coreText, englishFor, sectionText } from '../../scripts/i18n-sections.mjs'
import { PACK_SYSTEMS } from '../../scripts/cache-tiers.mjs'
import { PACK_IDS, SYSTEMS } from '../systems/registry.ts'

/**
 * The English split (scripts/i18n-sections.mjs, review 15 LOW 5): a key of a page section that is
 * not kept in the core text only exists once its section has loaded. So only the files that come
 * with that section (they import `virtual:lifepeek-en/<section>`, or only those files draw them)
 * may use it; anywhere else it would show as its raw key until then. Add a file here only when it
 * loads with its section; otherwise keep the key in the core (PAGE_SECTIONS).
 *
 * A pack's section `sys.<packId>` (I-1) comes with the pack, so only its systems' folders
 * (`systems/<system>/`) may use its keys.
 */
const ALLOWED: Record<string, readonly string[]> = {
  privacy: ['pages/Privacy.tsx'],
  about: ['pages/About.tsx'],
  // main.tsx loads Home's words before it draws Home; Home loads the race after.
  home: ['pages/Home.tsx', 'components/HomeRace.tsx'],
  teach: ['pages/Teach.tsx'],
  science: ['pages/Science.tsx'],
  stats: ['pages/Stats.tsx'],
  feedback: ['components/FeedbackDialog.tsx', 'pages/About.tsx'],
  update: ['components/UpdateToast.tsx'],
  lesson: ['pages/Science.tsx'],
  // The panel, and the files that only name limits for it: it reads them when it draws (HowWeKnow's Say).
  limits: [
    'components/graphs/HowWeKnowPanel.tsx',
    'components/graphs/StripStack.tsx',
    'systems/digestion/def.ts',
    // Breathing's graphs name their limits for the panel, as digestion's def does (U-2).
    'systems/breathing/ui.tsx',
    // And Heart & blood's (U-3).
    'systems/circulation/ui.tsx',
    // So do the effort pack's (U-1).
    'systems/muscles/ui.tsx',
    // Kidneys' graphs and their background line, the same (U-4).
    'systems/kidneys/ui.tsx',
    'systems/kidneys/water.ts',
  ],
  stages: ['components/stage/StageMore.tsx'],
  keys: ['components/stage/KeysHelp.tsx'],
  table: ['components/graphs/StripTable.tsx'],
  signals: ['components/graphs/HowWeKnowPanel.tsx'],
  link: ['components/stage/LinkNotes.tsx', 'lib/linkNotes.ts', 'components/stage/MealActions.tsx'],
  // The rings' notes are passed to the panel and read when it draws (Say), like the limits.
  graph: ['components/graphs/HowWeKnowPanel.tsx', 'components/graphs/StripStack.tsx'],
  // unitInWords is called by the panel only.
  // The breathing, circulation, effort and kidneys packs' texts bring the units section (systems/<pack>/text.ts).
  units: [
    'components/graphs/HowWeKnowPanel.tsx',
    'lib/formatSignal.ts',
    'registry/units.ts',
    'systems/breathing/summary.ts',
    // The circulation pack's text brings it too (systems/circulation/text.ts).
    'systems/circulation/summary.ts',
    // The effort pack's text brings the units section too (systems/muscles/text.ts).
    'systems/muscles/effort.ts',
    'systems/kidneys/summary.ts',
  ],
  profiles: ['components/graphs/HowWeKnowPanel.tsx', 'components/stage/MealActions.tsx'],
  disclaimer: ['pages/Science.tsx'],
  mealSheet: ['components/stage/FoodSearch.tsx', 'components/stage/Sheets.tsx'],
  activity: ['components/ActivitySheet.tsx'],
  picker: ['components/SystemPicker.tsx'],
  // registry/i18nKeys.ts is the tests' list of keys (never in a download).
  lifeProcess: ['components/SystemPicker.tsx', 'registry/i18nKeys.ts'],
  count: ['components/CountYours.tsx'],
}

/** The folders whose files come with a pack's section: its systems' (`sys.effort`: muscles, skin, bones). */
const PACK_FOLDERS: Record<string, readonly string[]> = Object.fromEntries(
  // A system's 3D layer (three/layers/<system>.ts, A-3) draws only once its system is lit, so after its pack.
  PACK_SECTIONS.map((name) => [
    name,
    (PACK_SYSTEMS as Record<string, string[]>)[name.slice('sys.'.length)]!.flatMap((s) => [`systems/${s}/`, `three/layers/${s}.`]),
  ]),
)

/** The section a key's text is in: `sys.<packId>` for a pack's key, else its first segment. */
const sectionOf = (key: string) => {
  const [first, second] = key.split('.')
  return first === 'sys' ? `sys.${second}` : first!
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
        const section = sectionOf(key)
        if (PACK_FOLDERS[section]?.some((folder) => file.startsWith(folder))) continue
        if (section in PACK_FOLDERS) {
          // Every pack key is outside the core.
          if (all.some((k) => pattern.test(k))) wrong.push(`${file}: ${key} (${section} loads with its pack)`)
          continue
        }
        if (!(section in PAGE_SECTIONS) || ALLOWED[section]!.includes(file)) continue
        const missing = split(pattern)
        if (missing.length) wrong.push(`${file}: ${key} (${missing[0]}${missing.length > 1 ? ', …' : ''})`)
      }
    }
    expect(wrong).toEqual([])
  })
})

describe('pack sections (I-1, architecture §5.3)', () => {
  // en.json with two packs' words, as U-2 and U-4 will add them.
  const withPacks = {
    ...en,
    sys: {
      breathing: { now: { in: 'Breathing in' }, sig: { rate: { name: 'Breaths a minute' } } },
      kidneys: { now: { idle: 'Filtering' } },
    },
  }

  it('one section per PackId but core, which keeps its unprefixed keys (R26)', () => {
    expect(PACK_SECTIONS).toEqual(PACK_IDS.filter((p) => p !== 'core').map((p) => `sys.${p}`))
    expect(Object.keys(PACK_SYSTEMS).sort()).toEqual([...PACK_IDS].sort())
    expect(sectionText(withPacks, 'sys.core')).toBeUndefined()
    expect(sectionText(withPacks, 'sys.lungs')).toBeUndefined()
    expect((en as Record<string, unknown>).sys ?? {}).not.toHaveProperty('core')
  })

  it("each pack's keys are in its own section only, never in the core text", () => {
    const core = [...flatKeys(coreText(withPacks))]
    expect(core.filter((k) => k.startsWith('sys.'))).toEqual([])
    expect([...flatKeys(sectionText(withPacks, 'sys.breathing'))]).toEqual(['sys.breathing.now.in', 'sys.breathing.sig.rate.name'])
    expect([...flatKeys(sectionText(withPacks, 'sys.kidneys'))]).toEqual(['sys.kidneys.now.idle'])
    // A pack with no words yet loads an empty section.
    expect(sectionText(withPacks, 'sys.effort')).toEqual({ sys: { effort: {} } })
  })

  it("en.json's sys blocks are known packs, and every key is in the core text or exactly one section", () => {
    const sys = ((en as Record<string, unknown>).sys ?? {}) as Record<string, unknown>
    for (const pack of Object.keys(sys)) expect(PACK_SECTIONS, `sys.${pack}`).toContain(`sys.${pack}`)
    const core = flatKeys(coreText(en))
    const owners = new Map<string, string[]>()
    for (const name of [...Object.keys(PAGE_SECTIONS), ...PACK_SECTIONS])
      for (const k of flatKeys(sectionText(en, name))) if (!core.has(k)) owners.set(k, [...(owners.get(k) ?? []), name])
    const missing = [...flatKeys(en)].filter((k) => !core.has(k) && !owners.has(k))
    expect(missing).toEqual([])
    expect([...owners].filter(([, names]) => names.length > 1)).toEqual([])
  })

  it('no key needed at first paint lives in a lazy section: the lit systems, their graphs and moments', () => {
    const core = flatKeys(coreText(en))
    const all = flatKeys(en)
    const needed: string[] = ['signals.event.never']
    for (const s of SYSTEMS) {
      needed.push(`${s.i18nKey}.name`)
      if (s.pack !== 'core') continue
      for (const slot of s.slots) {
        needed.push(`stage.strips.${slot.id}`, ...Object.entries(slot.marks ?? {}).flat())
        // R76: a graphed signal's names and sentences (the long description loads with "How we know").
        for (const id of slot.signals as readonly ActiveSignalId[])
          for (const leaf of ['name', 'short', 'summary', 'summaryNone'])
            if (all.has(`${SIGNALS[id].i18nKey}.${leaf}`)) needed.push(`${SIGNALS[id].i18nKey}.${leaf}`)
      }
    }
    // The dock's moments name every event the engine makes.
    for (const row of Object.values(EVENTS)) if (row.shipsIn === 'v2.0' || row.shipsIn === 'v3.0') needed.push(`${row.i18nKey}.name`)
    expect(needed.filter((k) => !all.has(k))).toEqual([])
    expect(needed.filter((k) => !core.has(k))).toEqual([])
  })

  it('a signal no graph shows has its texts in the lazy signals section only (R76)', () => {
    const core = flatKeys(coreText(en))
    expect(core.has('signals.gut.absorbed.carbsG.name')).toBe(false)
    expect(core.has('signals.energy.activityRate.name')).toBe(false)
    expect(flatKeys(sectionText(en, 'signals')).has('signals.energy.activityRate.name')).toBe(true)
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
