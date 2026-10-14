// English text for whole pages, downloaded with those pages (size budget, WP-15).
//
// en.json stays the one file of English text (tests, the reviewer list and Hindi parity read it
// whole). At build time this Vite plugin cuts it in two: the app's entry imports
// `virtual:lifepeek-en/core` (every key except the sections below), and each of those pages imports
// its own section, `virtual:lifepeek-en/<section>`, and adds it with `addEnglish` (i18n/index.ts).
// The page texts (privacy, about, teaching, science, stats and the report form) are a large part
// of en.json; before, every visitor of the stage downloaded them. Hindi is one file fetched on demand, so it is not split.
//
// Each system pack's words are one section too (I-1, architecture §5.3, content-i18n §5.1): the
// keys under `sys.<packId>` in en.json are `virtual:lifepeek-en/sys.<packId>`, which the pack's
// `text` loader imports (systems/load.ts) and `loadSection` adds when the system is first lit
// (i18n/index.ts). The cut is by key prefix only: this plugin cannot read the TS registry. `core`
// (digestion, first paint) has no `sys.core`: its keys keep today's unprefixed names (R26).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PACK_SYSTEMS } from './cache-tiers.mjs'

const EN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'en.json')
const PREFIX = 'virtual:lifepeek-en/'

/** The packs' sections, `sys.<packId>`: every PackId but `core` (R26). */
export const PACK_SECTIONS = Object.keys(PACK_SYSTEMS)
  .filter((p) => p !== 'core')
  .map((p) => `sys.${p}`)

/**
 * The signals the stage graphs on its first paint (digestion's slots, systems/digestion/def.ts),
 * and the events (the dock's moments): their names stay in the core text. Every other signal's
 * texts load with "How we know", which is the only part that names them (R76; sections.test
 * checks this list against the registry's slots).
 */
const GRAPHED_SIGNALS = ['gut.stomach.contentG', 'blood.glucose', 'energy.inRate', 'energy.usedRate', 'event']

/**
 * Sections only their own pages read, and the keys of them that every page needs (the footer's).
 * `lesson` is only the Science page's "Meal" column now (v1's step-by-step tab went in WP-20).
 * A kept key `*.leaf` keeps that leaf of every entry (`stages.<stage>.short`); a dotted key keeps
 * that entry (`gut.stomach.contentG`); `!leaf` then drops that leaf, at any depth, from what is
 * kept (`signals.<…>.desc`).
 *
 * The stage's own parts that load on first use bring their text too (FIX-C, size budget): the
 * "How we know" panel its known limits, "More" the full stage texts (the stage keeps
 * only the organs' names), the tables and keys sheet theirs (the stage keeps the buttons' names
 * and the announcer's kept value), and the panel the signals' long descriptions. The notes about
 * an opened link (older or newer version, what changed on load) come only when a link has one
 * (components/stage/LinkNotes.tsx, FP-6).
 */
export const PAGE_SECTIONS = {
  privacy: [],
  about: [],
  // I-1: Home's words load with Home (a lazy route "/" starts loading at once, main.tsx); the core
  // keeps the example links' name, which Teach shows too.
  home: ['example'],
  teach: [],
  science: [],
  stats: ['footer'],
  feedback: [],
  update: [],
  lesson: [],
  limits: [],
  stages: ['*.name', '*.short'],
  keys: ['button'],
  table: ['showFor', 'keptValue'],
  // R76: the graphed signals' names (not their long descriptions, nor the glucose band's name).
  signals: [...GRAPHED_SIGNALS, '!desc', '!band'],
  link: [],
  // FP-9 (T10): the panel's own words and the rings' notes, the units in words and whose body it
  // is load with "How we know" (whose body: with the "⋯" panel too); the long disclaimer with Science.
  graph: [
    'label',
    'howFor',
    'loadFailed',
    'retry',
    'stretched',
    'range',
    'highest',
    'halfEnergyLeft',
    'soFar',
    'halfEnergyLeftOf',
    'halfLeftOf',
    'highestOf',
  ],
  units: ['min', 'h', 'hm', 'hShort', 'kcal', 'g', 'mgdl', 'kcalPerH', 'gPerMin'],
  profiles: [],
  disclaimer: ['short', 'firstRun', 'graph', 'more'],
  // E-3b-ui: the meal sheet's "Food | Activity" switch comes with the sheets (Sheets.tsx); the
  // activity sheet's own words with it (components/ActivitySheet.tsx, lazy tier). The stage keeps
  // a bout's chip words and the "Try:" hint.
  mealSheet: [],
  activity: ['kinds', 'bout', 'edit', 'try'],
  // U-2: the picker's own words and its groups' names (NCERT's life processes) load with the picker
  // (components/SystemPicker.tsx, lazy); the stage keeps each system's name for the title.
  picker: [],
  lifeProcess: [],
}

/** The kept keys of one section (`*.leaf`: that leaf of every entry). */
function pick(section, keep) {
  const out = {}
  const drop = new Set()
  for (const k of keep) {
    if (k.startsWith('!')) drop.add(k.slice(1))
    else if (k.startsWith('*.')) {
      const leaf = k.slice(2)
      for (const [entry, value] of Object.entries(section)) {
        if (value && typeof value === 'object' && leaf in value) (out[entry] ??= {})[leaf] = value[leaf]
      }
    } else {
      const path = k.split('.')
      const value = path.reduce((o, p) => o?.[p], section)
      if (value === undefined) throw new Error(`en.json has no kept key ${k}`)
      let at = out
      for (const p of path.slice(0, -1)) at = at[p] ??= {}
      at[path.at(-1)] = value
    }
  }
  const without = (o) =>
    Object.fromEntries(
      Object.entries(o)
        .filter(([key]) => !drop.has(key))
        .map(([key, v]) => [key, v && typeof v === 'object' && !Array.isArray(v) ? without(v) : v]),
    )
  return drop.size ? without(out) : out
}

/**
 * One section's text as its module exports it: `core` (coreText), a page section (`{ [name]: … }`)
 * or a pack's (`{ sys: { <packId>: … } }`). Undefined for a name that is none of these.
 */
export function sectionText(en, name) {
  if (name === 'core') return coreText(en)
  if (name in PAGE_SECTIONS) return { [name]: en[name] }
  if (PACK_SECTIONS.includes(name)) {
    const pack = name.slice('sys.'.length)
    return { sys: { [pack]: en.sys?.[pack] ?? {} } }
  }
  return undefined
}

/** The core text: en.json without the page sections (but with the keys they share) and the packs' `sys`. */
export function coreText(en) {
  const core = { ...en }
  delete core.sys
  for (const [name, keep] of Object.entries(PAGE_SECTIONS)) {
    if (keep.length) core[name] = pick(en[name], keep)
    else delete core[name]
  }
  return core
}

/**
 * English texts that name Hindi, each with the English-only version (en.json) that replaces it in
 * a build without Hindi (R47: paused, VITE_HINDI), so no English text promises Hindi there. Like
 * stats.englishOnly, but swapped here at build time: the app carries one text, not both.
 */
export const ENGLISH_ONLY = {
  'home.how.classBody': 'home.how.classBodyEnglishOnly',
  'privacy.sections.0.items.0': 'privacy.languageEnglishOnly',
}

/** en.json as a build ships it: with Hindi the texts as they are, without it the English-only ones. Either way without the `ENGLISH_ONLY` keys themselves. */
export function englishFor(en, hindi) {
  const out = structuredClone(en)
  const parent = (path) => path.slice(0, -1).reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), out)
  for (const [key, englishOnly] of Object.entries(ENGLISH_ONLY)) {
    const [to, from] = [key.split('.'), englishOnly.split('.')]
    const [target, source] = [parent(to), parent(from)]
    if (!source || typeof source[from.at(-1)] !== 'string') throw new Error(`en.json has no ${englishOnly}`)
    if (!target || typeof target[to.at(-1)] !== 'string') throw new Error(`en.json has no ${key}`)
    if (!hindi) target[to.at(-1)] = source[from.at(-1)]
    delete source[from.at(-1)]
  }
  return out
}

export default function i18nSections() {
  /** Hindi is in the build (VITE_HINDI=1, as import.meta.env reads it). */
  let hindi = false
  return {
    name: 'lifepeek-i18n-sections',
    configResolved(config) {
      hindi = config.env.VITE_HINDI === '1'
    },
    // A plain id (no "/"): a section's chunk is named "lifepeek-en-<section>", not "<section>", so
    // the report form's text is never mistaken for a request to /feedback.
    resolveId(id) {
      if (id.startsWith(PREFIX)) return `\0lifepeek-en-${id.slice(PREFIX.length)}`
    },
    load(id) {
      if (!id.startsWith('\0lifepeek-en-')) return
      this.addWatchFile(EN)
      const en = englishFor(JSON.parse(fs.readFileSync(EN, 'utf8')), hindi)
      const name = id.slice('\0lifepeek-en-'.length)
      const text = sectionText(en, name)
      if (!text) this.error(`Unknown English section: ${name}`)
      return `export default ${JSON.stringify(text)}`
    },
  }
}
