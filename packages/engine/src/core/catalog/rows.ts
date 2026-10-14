/**
 * Every signal row the run chunk knows: the lean catalog's (catalog.ts) and each pack's lazy rows
 * (core/catalog/<pack>.ts, architecture §1.3). Only the run chunk, tests and scripts import this
 * file; the main entry keeps the lean catalog. The signal table lists rows in this order. The same
 * for moments: the lean catalog's events, then each pack's (S-4's kidney moments).
 */
import {
  ACTIVE_SIGNAL_IDS,
  EVENTS,
  EVENT_IDS,
  SIGNALS,
  type EventMeta,
  type RunEventId,
  type RunSignalId,
  type SignalMeta,
} from '../catalog.ts'
import { BREATHING_SIGNAL_IDS, BREATHING_SIGNALS } from './breathing.ts'
import { EFFORT_SIGNAL_IDS, EFFORT_SIGNALS } from './effort.ts'
import { KIDNEY_EVENT_IDS, KIDNEY_EVENTS, KIDNEY_SIGNAL_IDS, KIDNEY_SIGNALS } from './kidneys.ts'
import { CIRCULATION_EVENTS, CIRCULATION_EVENT_IDS, CIRCULATION_SIGNALS, CIRCULATION_SIGNAL_IDS } from './circulation.ts'

export const RUN_SIGNAL_IDS: readonly RunSignalId[] = [
  ...ACTIVE_SIGNAL_IDS,
  ...BREATHING_SIGNAL_IDS,
  ...EFFORT_SIGNAL_IDS,
  ...KIDNEY_SIGNAL_IDS,
  ...CIRCULATION_SIGNAL_IDS,
]

export const RUN_SIGNALS: { readonly [Id in RunSignalId]: SignalMeta<Id> } = {
  ...SIGNALS,
  ...BREATHING_SIGNALS,
  ...EFFORT_SIGNALS,
  ...KIDNEY_SIGNALS,
  ...CIRCULATION_SIGNALS,
}

export const isRunSignal = (id: string): id is RunSignalId => Object.hasOwn(RUN_SIGNALS, id)

/** Every moment a run can carry, lean events first. */
export const RUN_EVENT_IDS: readonly RunEventId[] = [...EVENT_IDS, ...KIDNEY_EVENT_IDS, ...CIRCULATION_EVENT_IDS]

export const RUN_EVENTS: { readonly [Id in RunEventId]: EventMeta<Id> } = { ...EVENTS, ...KIDNEY_EVENTS, ...CIRCULATION_EVENTS }

export const isRunEvent = (id: string): id is RunEventId => Object.hasOwn(RUN_EVENTS, id)
