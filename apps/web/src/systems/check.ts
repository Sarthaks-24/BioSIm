import { isChartable, type SignalMeta, type Unit } from '@lifepeek/engine'
import { PACK_OF, tabKey, type CatalogRow, type PackId, type SystemDef, type SystemId } from './registry.ts'
import { FRAMINGS, type View } from '../anatomy/human/base.ts'
import { CALLOUTS, type Callout } from '../anatomy/callouts.ts'
import type { ToneSet } from '../anatomy/tones/base.ts'
import { FLAT_LOOK, outlineOf, rgb } from '../flat/look.ts'
import { CVD_MIN, LINE_MIN, NORMAL_MIN, contrast, cvdDeltaE, deltaE } from '../lib/colorCheck.ts'
import { THEME } from '../lib/colors.ts'

/**
 * The systems registry's integrity rules (architecture §5.2), as plain sentences that name the
 * missing piece ("breathing: slot 2 signal lungs.tidalVolume has no row registered by its pack").
 * Used by registry.test.ts only (never by the app, so it is not in any download).
 */
export interface CheckContext {
  /** Signals the organism's engine provides (`PROVIDES`). */
  provides: readonly string[]
  /** The organism's organ IDs. */
  organs: readonly string[]
  /** The packs with a PackDef (systems/packs.ts). */
  packs: readonly PackId[]
  /** The packs scripts/cache-tiers.mjs knows. */
  manifestPacks: readonly string[]
  /** The IDs a pack registered (registerSignals), once its rows have loaded. */
  rowsOf: (pack: PackId) => ReadonlySet<string>
  row: (id: string) => CatalogRow | undefined
  /** The i18n template of a unit (registry/units.ts). */
  unitKey: (unit: Unit) => string | undefined
  /** The text at a key, in English and in Hindi. */
  en: (key: string) => unknown
  hi: (key: string) => unknown
}

const isSignalRow = (r: CatalogRow): r is SignalMeta => 'kind' in r

export function systemProblems(s: SystemDef, ctx: CheckContext): string[] {
  const out: string[] = []
  const say = (what: string) => out.push(`${s.id}: ${what}`)
  // Texts a public row needs in both languages (Hindi Tier 1); a hidden row, English first.
  const needText = (key: string, what: string) => {
    if (typeof ctx.en(key) !== 'string') say(`${what} has no English text ${key}`)
    if (s.public && typeof ctx.hi(key) !== 'string') say(`${what} has no Hindi text ${key} (public needs Hindi Tier 1)`)
  }

  if (s.pack !== PACK_OF[s.id]) say(`pack ${s.pack} is not its frozen pack ${PACK_OF[s.id]} (architecture §0)`)
  if (!ctx.packs.includes(s.pack)) say(`pack ${s.pack} has no PackDef (systems/packs.ts)`)
  if (!ctx.manifestPacks.includes(s.pack)) say(`pack ${s.pack} is not in scripts/cache-tiers.mjs`)
  needText(`${s.i18nKey}.name`, 'its name')
  if (s.i18nKey !== `systems.${s.id}`) say(`i18nKey ${s.i18nKey} is not systems.${s.id}`)
  for (const o of s.organs) if (!ctx.organs.includes(o)) say(`organ ${o} is not one of the organism's organs`)
  for (const k of s.knownLimits) if (!/^limits\.\w+$/.test(k)) say(`known limit ${k} is not a limits.* text`)

  if (s.slots.length > 3) say(`${s.slots.length} graph slots: at most 3 (keys 1–3)`)
  if (new Set(s.slots.map((g) => g.id)).size !== s.slots.length) say('two slots share an id')
  // A row with no graphs is a drawing-only row (R11): it needs its own drawing, not the body's.
  if (s.public && s.slots.length === 0 && s.draw === 'body')
    say('public with no graphs, but has no drawing of its own (a drawing-only row needs a layer, R11)')

  s.slots.forEach((slot, i) => {
    const at = `slot ${i + 1} (${slot.id})`
    if (slot.letter && s.id !== 'digestion') say(`${at} has a letter alias: only digestion has them, in v3.0`)
    needText(tabKey(slot), `${at}'s tab`)
    const unitKey = ctx.unitKey(slot.unit)
    if (!unitKey) say(`${at} unit ${slot.unit} has no text (registry/units.ts)`)
    else needText(unitKey, `${at} unit ${slot.unit}`)
    for (const k of slot.limits ?? []) {
      if (!/^limits\.\w+$/.test(k)) say(`${at} limit ${k} is not a limits.* text`)
      else needText(k, `${at} limit`)
    }
    for (const k of Object.values(slot.marks ?? {})) needText(k, `${at} ring label`)
    for (const sig of slot.signals) {
      const which = `${at} signal ${sig}`
      if (!ctx.provides.includes(sig)) say(`${which} is not provided by the engine (PROVIDES)`)
      const own = ctx.rowsOf(s.pack).has(sig) || ctx.rowsOf('core').has(sig)
      const row = ctx.row(sig)
      if (!own || !row) {
        say(`${which} has no row registered by its pack`)
        continue
      }
      if (!isSignalRow(row) || !isChartable(row)) say(`${which} is a constant or drawing-only signal, not a graph`)
      else if (row.unit !== slot.unit) say(`${which} is in ${row.unit}, not the slot's ${slot.unit}`)
    }
  })
  return out
}

/**
 * The labels each system's picture can show (anatomy/callouts.ts), for the flat registry check: each
 * must sit inside its framing. Here, not in the row, so the first download does not carry the list;
 * a new system adds its labels here with its drawing, or keeps its own table with its drawing
 * (anatomy/human/<system>.ts `LABELS`, which registry.test hands to flatProblems: lymph's).
 */
export const FLAT_CALLOUTS: { readonly [S in SystemId]?: readonly string[] } = {
  digestion: ['esophagus', 'stomach', 'smallIntestine', 'largeIntestine', 'liver', 'pancreas'],
}

/** A tone's outline in the flat body (flat/look.ts), as hex, for the contrast checks. */
const flatInk = (hex: string, look: keyof typeof FLAT_LOOK) =>
  `#${outlineOf(rgb(hex), FLAT_LOOK[look])
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')}`

/**
 * The flat registry's rules (A-0; anatomy plan §1, §2.0, §5): a system's row has a flat drawing (the
 * body's own for Digestion, a lazy layer for every other), a framing with a VIEW, tones whose
 * outlines stand out from the page and from each other where organs touch, and labels that sit
 * inside its picture. `tones` is the row's tone set (anatomy/tones/<id>.ts, loaded with its pack);
 * `table` where its labels are placed (Digestion's anatomy/callouts.ts, or the pack's own anatomy file).
 */
export function flatProblems(
  s: SystemDef,
  tones: ToneSet,
  callouts: readonly string[] = FLAT_CALLOUTS[s.id] ?? [],
  table: Readonly<Record<string, Callout>> = CALLOUTS,
): string[] {
  const out: string[] = []
  const say = (what: string) => out.push(`${s.id}: ${what}`)
  const view = (FRAMINGS as Partial<Record<string, View>>)[s.camera.framing]
  if (!view) say(`framing ${s.camera.framing} has no VIEW (anatomy/human/base.ts FRAMINGS)`)
  if (s.draw === 'body' && s.id !== 'digestion')
    say("is drawn by the body, but only Digestion is: it needs its own flat layer (draw: 'layer', its pack's drawing)")

  const names = Object.keys(tones.tones)
  if (s.id !== 'digestion' && names.length > 5) say(`${names.length} tones: at most 5 (anatomy plan §5)`)
  for (const look of ['normal', 'projector'] as const) {
    const page = THEME[look].surfacePage
    for (const [name, hex] of Object.entries(tones.tones)) {
      const c = contrast(flatInk(hex, look), page)
      if (c < LINE_MIN) say(`tone ${name}: its ${look} outline is ${c.toFixed(2)}:1 on the page, under ${LINE_MIN}:1`)
    }
  }
  for (const [a, b] of tones.neighbours) {
    const [ta, tb] = [tones.tones[a], tones.tones[b]]
    if (!ta || !tb) {
      say(`neighbours ${a}/${b} name a tone it does not have`)
      continue
    }
    const cvd = cvdDeltaE(ta, tb)
    const normal = deltaE(ta, tb)
    if (cvd < CVD_MIN || normal < NORMAL_MIN)
      say(`neighbours ${a}/${b} are too alike: CVD ΔE ${cvd.toFixed(1)}, normal ΔE ${normal.toFixed(1)}`)
  }

  if (callouts.length === 0) say('has no labels (systems/check.ts FLAT_CALLOUTS)')
  const inside = (p: { x: number; y: number }) => !!view && p.x >= view.minX && p.x <= view.maxX && p.y >= view.minY && p.y <= view.maxY
  for (const id of callouts) {
    const c = (table as Partial<Record<string, Callout>>)[id]
    if (!c) say(`label ${id} has no callout (anatomy/callouts.ts)`)
    else if (!inside(c.anchor) || !inside(c.at)) say(`label ${id} is outside its ${s.camera.framing} framing`)
  }
  return out
}
