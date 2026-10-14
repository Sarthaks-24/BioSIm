import { isChartable, type SignalMeta, type Unit } from '@lifepeek/engine'
import { PACK_OF, type CatalogRow, type PackId, type SystemDef } from './registry.ts'

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
  /** The packs pack-manifest.mjs knows. */
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
  if (!ctx.manifestPacks.includes(s.pack)) say(`pack ${s.pack} is not in scripts/pack-manifest.mjs`)
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
    needText(`stage.strips.${slot.id}`, `${at}'s tab`)
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
