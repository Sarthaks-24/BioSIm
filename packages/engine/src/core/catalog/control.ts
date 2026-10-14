/**
 * The control pack's catalog rows (hormones + nerves; S-6, model §2.5, ACTIVATION_LOG). Lazy rows
 * (architecture §1.3): the main entry never imports this file, so the first download carries only
 * the IDs' type; the run chunk reads the rows through core/catalog/rows.ts. Same rules as
 * catalog.ts: never rename or delete an ID, only add. blood.insulin and brain.glucoseUse left the
 * reserved list for this pack, units kept. The bloodSugar module computes them (D4: `control` is a
 * pack, not a module); the hormones and nerves rows show them (v3.1).
 *
 * Both rows are a "Model estimate" (model D9): insulin rests on a calibrated gut term (c) and a
 * between-person band, the brain's use is a cited constant. The pack's one moment is lazy too.
 */
import type { EventMeta, SignalMeta } from '../catalog.ts'

export const CONTROL_SIGNAL_IDS = ['blood.insulin', 'brain.glucoseUse'] as const
export type ControlSignalId = (typeof CONTROL_SIGNAL_IDS)[number]

export const CONTROL_EVENT_IDS = ['event.insulinPeak'] as const
export type ControlEventId = (typeof CONTROL_EVENT_IDS)[number]

const k = (id: string) => `signals.${id}`
/** Secretion (Dalla Man), half-life (Lebovitz), the calibration and band (Takahashi), the hold-out (Polonsky). */
const INSULIN_SOURCES = ['dallaman2007', 'lebovitz2011', 'takahashi2018', 'polonsky1988'] as const

export const CONTROL_SIGNALS: { readonly [Id in ControlSignalId]: SignalMeta<Id> } = {
  // Open loop (E1): from glucose and the glucose coming in, never fed back. × before eating, never µU/mL.
  'blood.insulin': {
    id: 'blood.insulin',
    unit: 'xFasting',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: INSULIN_SOURCES,
    i18nKey: k('blood.insulin'),
    reactsToMeal: true,
    shipsIn: 'v3.1',
    // Takahashi 2018's spread at the 30-min sample (74.1 ± 33.4 µU/mL), ±45 % of the rise.
    band: { status: 'assumption', sourceIds: ['takahashi2018'], i18nKey: k('blood.insulin.band') },
    displayRange: [0, 20],
    round: 0.1,
    limitKey: 'limits.insulinOpenLoop',
    // Exactly 1 at fasting, never below; Takahashi's highest group mean is 12× (74.1 / 6.2): 40× is a design guard.
    validRange: { low: 1, high: 40, basis: 'guard' },
  },
  // 5.6 mg per 100 g per min × 1.3 kg ≈ 4.4 g/h (Mergenthaler 2013), 106 g a day (Cahill & Owen 1968: 100–145).
  'brain.glucoseUse': {
    id: 'brain.glucoseUse',
    unit: 'g/h',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: ['mergenthaler2013', 'cahill1968'],
    i18nKey: k('brain.glucoseUse'),
    reactsToMeal: false,
    shipsIn: 'v3.1',
    round: 0.1,
    limitKey: 'limits.brainGlucoseConstant',
    // 100–145 g a day (Cahill & Owen 1968) = 4.2–6.0 g/h.
    validRange: { low: 100 / 24, high: 145 / 24, basis: 'cited' },
  },
}

export const CONTROL_EVENTS: { readonly [Id in ControlEventId]: EventMeta<Id> } = {
  // First minute of the highest insulin; absent when it never rises by 0.1× (water, no food).
  'event.insulinPeak': {
    id: 'event.insulinPeak',
    unit: 'min',
    status: 'assumption',
    clock: 'sim',
    foundOn: 'blood.insulin',
    hasRange: false,
    sourceIds: ['takahashi2018'],
    i18nKey: k('event.insulinPeak'),
    shipsIn: 'v3.1',
  },
}
