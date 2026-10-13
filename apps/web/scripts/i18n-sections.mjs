// English text for whole pages, downloaded with those pages (size budget, WP-15).
//
// en.json stays the one file of English text (tests, the reviewer list and Hindi parity read it
// whole). At build time this Vite plugin cuts it in two: the app's entry imports
// `virtual:lifepeek-en/core` (every key except the sections below), and each of those pages imports
// its own section, `virtual:lifepeek-en/<section>`, and adds it with `addEnglish` (i18n/index.ts).
// The page texts (privacy, about, teaching, science, stats, the report form and v1's simulator) are
// a third of en.json; before, every visitor of the stage downloaded them. Hindi is one file fetched on demand, so it is not split.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'en.json')
const PREFIX = 'virtual:lifepeek-en/'

/**
 * Sections only their own pages read, and the keys of them that every page needs (the footer's).
 * The v1 simulator's own texts (verdict, charts, events, lesson) go with it until WP-20 deletes it.
 * A kept key `*.leaf` keeps that leaf of every entry (`stages.<stage>.short`); `**!leaf` keeps
 * everything but that leaf, at any depth (`signals.<…>.desc`).
 *
 * The stage's own parts that load on first use bring their text too (FIX-C, size budget): the
 * "How we know" panel its known limits, "More" (and v1) the full stage texts (the stage keeps
 * only the organs' names), the tables and keys sheet theirs (the stage keeps the buttons' names
 * and the announcer's kept value), and the panel the signals' long descriptions.
 */
export const PAGE_SECTIONS = {
  privacy: [],
  about: [],
  teach: [],
  science: [],
  stats: ['footer'],
  feedback: [],
  update: [],
  verdict: [],
  charts: [],
  events: [],
  lesson: [],
  limits: [],
  stages: ['*.name', '*.short'],
  keys: ['button'],
  table: ['showFor', 'keptValue'],
  signals: ['**!desc'],
  // v1's simulator keeps its own texts; the stage keeps the ones it shares (until WP-20).
  sim: [
    'title',
    'addFood',
    'servings',
    'remove',
    'play',
    'pause',
    'timeline',
    'share',
    'shareCopied',
    'shareManual',
    'reportError',
    'noWebgl',
    'oldLink',
    'newerLink',
    'afterEating',
    'capReached',
    'unknownFoods',
    'overCap',
  ],
}

/** The kept keys of one section (`*.leaf`: that leaf of every entry). */
function pick(section, keep) {
  const out = {}
  for (const k of keep) {
    if (k.startsWith('**!')) {
      const leaf = k.slice(3)
      const without = (o) =>
        Object.fromEntries(
          Object.entries(o)
            .filter(([key, v]) => key !== leaf || typeof v === 'object')
            .map(([key, v]) => [key, v && typeof v === 'object' ? without(v) : v]),
        )
      Object.assign(out, without(section))
      continue
    }
    if (!k.startsWith('*.')) {
      out[k] = section[k]
      continue
    }
    const leaf = k.slice(2)
    for (const [entry, value] of Object.entries(section)) {
      if (value && typeof value === 'object' && leaf in value) (out[entry] ??= {})[leaf] = value[leaf]
    }
  }
  return out
}

/** The core text: en.json without the page sections (but with the keys they share). */
export function coreText(en) {
  const core = { ...en }
  for (const [name, keep] of Object.entries(PAGE_SECTIONS)) {
    if (keep.length) core[name] = pick(en[name], keep)
    else delete core[name]
  }
  return core
}

export default function i18nSections() {
  return {
    name: 'lifepeek-i18n-sections',
    // A plain id (no "/"): a section's chunk is named "lifepeek-en-<section>", not "<section>", so
    // the report form's text is never mistaken for a request to /feedback.
    resolveId(id) {
      if (id.startsWith(PREFIX)) return `\0lifepeek-en-${id.slice(PREFIX.length)}`
    },
    load(id) {
      if (!id.startsWith('\0lifepeek-en-')) return
      this.addWatchFile(EN)
      const en = JSON.parse(fs.readFileSync(EN, 'utf8'))
      const name = id.slice('\0lifepeek-en-'.length)
      if (name !== 'core' && !(name in PAGE_SECTIONS)) this.error(`Unknown English section: ${name}`)
      return `export default ${JSON.stringify(name === 'core' ? coreText(en) : { [name]: en[name] })}`
    },
  }
}
