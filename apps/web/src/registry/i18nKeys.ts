import { ACTIVE_SIGNAL_IDS, EVENTS, PROFILES, SIGNALS, type SignalStatus } from '@lifepeek/engine'
import { ORGANISMS } from './index.ts'

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
  for (const id of ACTIVE_SIGNAL_IDS) {
    const row = SIGNALS[id]
    for (const sub of ['name', 'short', 'desc']) required.add(`${row.i18nKey}.${sub}`)
    for (const sub of ['summary', 'summaryNone']) optional.add(`${row.i18nKey}.${sub}`)
    if (row.band) required.add(`${row.band.i18nKey}.name`)
    if (row.limitKey) required.add(row.limitKey)
  }
  for (const row of Object.values(EVENTS)) {
    if (row.shipsIn !== 'v2.0') continue
    required.add(`${row.i18nKey}.name`)
    optional.add(`${row.i18nKey}.desc`)
  }
  required.add('signals.event.never')
  for (const s of SIGNAL_STATUSES) for (const sub of ['label', 'help']) required.add(`status.${s}.${sub}`)
  required.add('status.howWeKnow')
  required.add('status.sameEveryMeal')
  return { required, optional }
}

/** Organisms, their profiles, systems (with life process and known limits) and organs. */
export function registryKeys(): KeyUse {
  const required = new Set<string>()
  for (const { organism, systems, organs } of Object.values(ORGANISMS)) {
    required.add(`${organism.i18nKey}.name`)
    for (const p of organism.profiles) for (const sub of ['tag', 'desc']) required.add(`${PROFILES[p].i18nKey}.${sub}`)
    for (const s of systems) {
      required.add(`${s.i18nKey}.name`)
      required.add(`lifeProcess.${s.lifeProcess}`)
      for (const k of s.knownLimits) required.add(k)
    }
    for (const o of organs) required.add(o.i18nKey)
  }
  return { required, optional: new Set() }
}
