/**
 * The kidneys pack's catalog rows (S-4, model §2.4, ACTIVATION_LOG). Lazy rows (architecture
 * §1.3): the main entry never imports this file, so the first download carries only the IDs' type;
 * the run chunk reads the rows through core/catalog/rows.ts, and the web registers them with the
 * kidneys pack (U-4). Same rules as catalog.ts: never rename or delete an ID, only add.
 * kidney.filtrationRate left the reserved list for this pack as a sim-clock constant, unit kept.
 *
 * Every row is a "Model estimate" (model D9): urine rests on a hand-picked steady background day
 * (D17) and a calibrated ADH lag, and the water of moving on energy.activityRate, itself one.
 * The pack's two moments are lazy too (KIDNEY_EVENTS): the Digestion dock never lists them.
 */
import type { EventMeta, RunEventId, SignalMeta } from '../catalog.ts'

export const KIDNEY_SIGNAL_IDS = [
  'kidney.urineRate',
  'kidney.urineTotal',
  'kidney.bladderMl',
  'water.bodyExtraMl',
  'kidney.filtrationRate',
] as const
export type KidneySignalId = (typeof KIDNEY_SIGNAL_IDS)[number]

export const KIDNEY_EVENT_IDS = ['event.bladderFirstUrge', 'event.halfMealWaterPassed'] as const
export type KidneyEventId = (typeof KIDNEY_EVENT_IDS)[number]

const k = (id: string) => `signals.${id}`
/** The steady background day (OpenStax ch. 25–26), the drink calibration (Maughan) and its hold-out (Crowe). */
const URINE_SOURCES = ['openstax-ap2e-26', 'openstax-ap2e-25', 'iom2005', 'maughan2016', 'crowe1987', 'calvi2024'] as const

export const KIDNEY_SIGNALS: { readonly [Id in KidneySignalId]: SignalMeta<Id> } = {
  // U = clamp(U0 + kx·S, Umin, Umax): background 1.5 L a day plus the lagged extra water (model §2.4).
  'kidney.urineRate': {
    id: 'kidney.urineRate',
    unit: 'mL/h',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: URINE_SOURCES,
    i18nKey: k('kidney.urineRate'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    round: 5,
    limitKey: 'limits.waterSteadyDay',
    // At least "about 500 mL/day" (OpenStax §25.1, 21 mL/h); with water loading "600 to 1,000 mL/hour" (IOM 2005 p83).
    validRange: { low: 21, high: 1000, basis: 'cited' },
  },
  'kidney.urineTotal': {
    id: 'kidney.urineTotal',
    unit: 'mL',
    status: 'assumption',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: URINE_SOURCES,
    i18nKey: k('kidney.urineTotal'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    round: 5,
    limitKey: 'limits.waterSteadyDay',
    // 48 h at the background rate is 3 L; the biggest drink adds 1.25 L: a design guard.
    validRange: { low: 0, high: 10000, basis: 'guard' },
  },
  // Starts empty, fills with urine, empties at 300 mL (Model estimate); the urge is felt at about 150 mL.
  'kidney.bladderMl': {
    id: 'kidney.bladderMl',
    unit: 'mL',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: ['openstax-ap2e-25'],
    i18nKey: k('kidney.bladderMl'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    round: 5,
    limitKey: 'limits.bladderEmpties',
    // "Volumes in adults can range from nearly zero to 500–600 mL" (OpenStax §25.2).
    validRange: { low: 0, high: 600, basis: 'cited' },
  },
  // E: body water above a normal day (drinks, food and metabolic water in; extra urine and sweat not yet drunk back out).
  'water.bodyExtraMl': {
    id: 'water.bodyExtraMl',
    unit: 'mL',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: ['openstax-ap2e-23', 'iom2005', 'maughan2016'],
    i18nKey: k('water.bodyExtraMl'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    round: 5,
    limitKey: 'limits.waterSteadyDay',
    // Below 0 for a while after sweating (the sweat is drunk back over about 90 min, R81). The
    // codec's longest plans (8 bouts of 2 h) sweat about 16 L: a design guard.
    validRange: { low: -20000, high: 2000, basis: 'guard' },
  },
  // Glomerular filtration, a constant (model D15): "about 125 mL/min … in males (range of 90 to 140 mL/min)" (OpenStax §25.5).
  'kidney.filtrationRate': {
    id: 'kidney.filtrationRate',
    unit: 'mL/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: ['openstax-ap2e-25'],
    i18nKey: k('kidney.filtrationRate'),
    reactsToMeal: false,
    shipsIn: 'v3.0',
    round: 1,
    limitKey: 'limits.gfrFixed',
    validRange: { low: 90, high: 140, basis: 'cited' },
  },
}

export const KIDNEY_EVENTS: { readonly [Id in KidneyEventId]: EventMeta<Id> } = {
  // The bladder first holds about 150 mL: "an urge to void is sensed but is easily overridden" (OpenStax §25.2).
  'event.bladderFirstUrge': {
    id: 'event.bladderFirstUrge',
    unit: 'min',
    status: 'assumption',
    clock: 'sim',
    foundOn: 'kidney.bladderMl',
    hasRange: false,
    sourceIds: ['openstax-ap2e-25'],
    i18nKey: k('event.bladderFirstUrge'),
    shipsIn: 'v3.0',
  },
  // Half of the meal's absorbed water has left as extra urine (never when there is none to pass; R84).
  'event.halfMealWaterPassed': {
    id: 'event.halfMealWaterPassed',
    unit: 'min',
    status: 'assumption',
    clock: 'sim',
    foundOn: 'kidney.urineTotal',
    hasRange: false,
    sourceIds: ['maughan2016', 'crowe1987'],
    i18nKey: k('event.halfMealWaterPassed'),
    shipsIn: 'v3.0',
  },
}

/** The pack's rows and moments, as `registerSignals` takes them (the web's `rows` loader of the `kidneys` pack, U-4). */
const rows: readonly (SignalMeta | EventMeta<RunEventId>)[] = [...Object.values(KIDNEY_SIGNALS), ...Object.values(KIDNEY_EVENTS)]
export default rows
