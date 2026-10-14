import { ACTIVE_SIGNAL_IDS, EVENTS, PROFILES, SIGNALS, type SignalMeta, type SignalStatus } from '@lifepeek/engine'
import BREATHING_ROWS from '@lifepeek/engine/catalog/breathing'
import { ORGANISMS } from './index.ts'

/** The built packs' lazy rows (each U-n adds its pack's): their texts load with the pack. */
const PACK_ROWS: readonly SignalMeta[] = [...BREATHING_ROWS]

/**
 * The i18n keys the screen builds from the catalog and the registry (`${i18nKey}.name` …), which
 * a scan for t('…') cannot see. `required` keys must exist in en.json and hi.json; `optional`
 * keys count as used when present. Used by i18n.test.ts and registry.test.ts only.
 */
export interface KeyUse {
  required: Set<string>
  optional: Set<string>
}

const STATUS_WORDS: { readonly [S in SignalStatus]: true } = { simulated: true, assumption: true, illustration: true }
export const SIGNAL_STATUSES = Object.keys(STATUS_WORDS) as SignalStatus[]

/** Signals the engine produces (.name .short .desc; .summary .summaryNone if a strip has them), bands, events, limits, status words. */
export function catalogKeys(): KeyUse {
  const required = new Set<string>()
  const optional = new Set<string>()
  for (const row of [...ACTIVE_SIGNAL_IDS.map((id) => SIGNALS[id] as SignalMeta), ...PACK_ROWS]) {
    for (const sub of ['name', 'short', 'desc']) required.add(`${row.i18nKey}.${sub}`)
    for (const sub of ['summary', 'summaryNone']) optional.add(`${row.i18nKey}.${sub}`)
    if (row.band) required.add(`${row.band.i18nKey}.name`)
    if (row.limitKey) required.add(row.limitKey)
  }
  for (const row of Object.values(EVENTS)) {
    if (row.shipsIn !== 'v2.0' && row.shipsIn !== 'v3.0') continue
    required.add(`${row.i18nKey}.name`)
    optional.add(`${row.i18nKey}.desc`)
  }
  required.add('signals.event.never')
  for (const s of SIGNAL_STATUSES) for (const sub of ['label', 'help']) required.add(`status.${s}.${sub}`)
  required.add('status.howWeKnow')
  required.add('status.sameEveryMeal')
  return { required, optional }
}

/**
 * Organisms, their profiles, systems (with life process, known limits and graph slots) and organs.
 * A hidden system's own keys (its name, its group's name) are `optional` in Hindi: English first,
 * Hindi before it goes public (R47; systems/check.ts asks a public row for both).
 */
export function registryKeys(): KeyUse & { englishOnly: Set<string> } {
  const required = new Set<string>()
  const englishOnly = new Set<string>()
  for (const { organism, systems, organs } of Object.values(ORGANISMS)) {
    required.add(`${organism.i18nKey}.name`)
    for (const p of organism.profiles) for (const sub of ['tag', 'desc']) required.add(`${PROFILES[p].i18nKey}.${sub}`)
    for (const s of systems) {
      const need = s.public ? required : englishOnly
      need.add(`${s.i18nKey}.name`)
      need.add(`lifeProcess.${s.lifeProcess}`)
      for (const k of s.knownLimits) required.add(k)
      // Each graph's tab name, its limits and its ring labels (systems/registry.ts GraphSlotDef).
      for (const slot of s.slots) {
        required.add(`stage.strips.${slot.id}`)
        for (const k of [...(slot.limits ?? []), ...Object.values(slot.marks ?? {})]) required.add(k)
      }
    }
    for (const o of organs) required.add(o.i18nKey)
  }
  for (const k of required) englishOnly.delete(k)
  return { required, optional: new Set(), englishOnly }
}
