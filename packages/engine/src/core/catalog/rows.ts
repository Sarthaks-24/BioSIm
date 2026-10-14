/**
 * Every signal row the run chunk knows: the lean catalog's (catalog.ts) and each pack's lazy rows
 * (core/catalog/<pack>.ts, architecture §1.3). Only the run chunk, tests and scripts import this
 * file; the main entry keeps the lean catalog. The signal table lists rows in this order.
 */
import { ACTIVE_SIGNAL_IDS, EVENTS, EVENT_IDS, SIGNALS, type EventId, type EventMeta, type RunSignalId, type SignalMeta } from '../catalog.ts'
import { BREATHING_SIGNAL_IDS, BREATHING_SIGNALS } from './breathing.ts'
import { EFFORT_SIGNAL_IDS, EFFORT_SIGNALS } from './effort.ts'
import { CIRCULATION_EVENTS, CIRCULATION_EVENT_IDS, CIRCULATION_SIGNALS, CIRCULATION_SIGNAL_IDS } from './circulation.ts'

export const RUN_SIGNAL_IDS: readonly RunSignalId[] = [
  ...ACTIVE_SIGNAL_IDS,
  ...BREATHING_SIGNAL_IDS,
  ...EFFORT_SIGNAL_IDS,
  ...CIRCULATION_SIGNAL_IDS,
]

export const RUN_SIGNALS: { readonly [Id in RunSignalId]: SignalMeta<Id> } = {
  ...SIGNALS,
  ...BREATHING_SIGNALS,
  ...EFFORT_SIGNALS,
  ...CIRCULATION_SIGNALS,
}

export const isRunSignal = (id: string): id is RunSignalId => Object.hasOwn(RUN_SIGNALS, id)

/** Every event row a run can carry: the lean catalog's (EVENTS) and the packs' lazy ones. */
export const RUN_EVENT_IDS: readonly EventId[] = [...EVENT_IDS, ...CIRCULATION_EVENT_IDS]

export const RUN_EVENTS: { readonly [Id in EventId]: EventMeta<Id> } = { ...EVENTS, ...CIRCULATION_EVENTS }

export const isRunEvent = (id: string): id is EventId => Object.hasOwn(RUN_EVENTS, id)
