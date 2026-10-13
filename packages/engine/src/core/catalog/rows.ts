/**
 * Every signal row the run chunk knows: the lean catalog's (catalog.ts) and each pack's lazy rows
 * (core/catalog/<pack>.ts, architecture §1.3). Only the run chunk, tests and scripts import this
 * file; the main entry keeps the lean catalog. The signal table lists rows in this order.
 */
import { ACTIVE_SIGNAL_IDS, SIGNALS, type RunSignalId, type SignalMeta } from '../catalog.ts'
import { BREATHING_SIGNAL_IDS, BREATHING_SIGNALS } from './breathing.ts'
import { EFFORT_SIGNAL_IDS, EFFORT_SIGNALS } from './effort.ts'

export const RUN_SIGNAL_IDS: readonly RunSignalId[] = [...ACTIVE_SIGNAL_IDS, ...BREATHING_SIGNAL_IDS, ...EFFORT_SIGNAL_IDS]

export const RUN_SIGNALS: { readonly [Id in RunSignalId]: SignalMeta<Id> } = { ...SIGNALS, ...BREATHING_SIGNALS, ...EFFORT_SIGNALS }

export const isRunSignal = (id: string): id is RunSignalId => Object.hasOwn(RUN_SIGNALS, id)
