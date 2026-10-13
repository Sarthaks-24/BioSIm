/**
 * Every row the run can produce: the lean catalog's active rows (core/catalog.ts, main entry) and
 * the pack rows (core/catalog/<pack>.ts). Run chunk, tests and docs only: the main entry never
 * imports this file, so pack rows stay out of the first download (architecture §1.3 "lazy rows").
 * One line per pack in each list below.
 */
import { ACTIVE_SIGNAL_IDS, SIGNALS, type PackSignalId, type ProducedSignalId, type SignalMeta } from '../catalog.ts'
import { EFFORT_SIGNALS, EFFORT_SIGNAL_IDS } from './effort.ts'

export { EFFORT_SIGNALS, EFFORT_SIGNAL_IDS, type EffortSignalId } from './effort.ts'

/** Pack rows, in pack order (each pack's own order inside). */
export const PACK_SIGNAL_IDS: readonly PackSignalId[] = [...EFFORT_SIGNAL_IDS]

export const PACK_SIGNALS: { readonly [Id in PackSignalId]: SignalMeta<Id> } = {
  ...EFFORT_SIGNALS,
}

/** The signal table's row order: the lean catalog's rows first, then each pack's (D13 iii: added rows never move earlier ones). */
export const PRODUCED_SIGNAL_IDS: readonly ProducedSignalId[] = [...ACTIVE_SIGNAL_IDS, ...PACK_SIGNAL_IDS]

export const PRODUCED_SIGNALS: { readonly [Id in ProducedSignalId]: SignalMeta<Id> } = { ...SIGNALS, ...PACK_SIGNALS }

export const isPackSignal = (id: string): id is PackSignalId => Object.hasOwn(PACK_SIGNALS, id)
export const isProducedSignal = (id: string): id is ProducedSignalId => Object.hasOwn(PRODUCED_SIGNALS, id)
