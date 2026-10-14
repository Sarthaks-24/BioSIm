/**
 * The `effort` pack's catalog rows (muscles + skin; model §2.7, §2.9; S-1). Lazy rows
 * (architecture §1.3): the IDs are typed in core/catalog.ts (PackSignalId) so links, goldens and
 * the run's table can name them, but these rows load only with the run chunk (core/catalog/rows.ts)
 * or, from W-1 on, with the pack's `registerSignals`, never with the main entry. Add-only, like
 * every catalog row.
 */
import type { SignalMeta } from '../catalog.ts'

export const EFFORT_SIGNAL_IDS = ['muscle.energyRate', 'skin.sweatRate', 'skin.sweatTotal'] as const
export type EffortSignalId = (typeof EFFORT_SIGNAL_IDS)[number]

const k = (id: string) => `signals.${id}`
/** The activity cost (Compendium, the person's weight) every effort row is built on. */
const ACTIVITY_SOURCES = ['herrmann2024', 'icmr-nin2020'] as const
const SWEAT_SOURCES = ['baker2019', 'bakerwolfe2020', 'openstax-ap2e-24', ...ACTIVITY_SOURCES] as const

export const EFFORT_SIGNALS: { readonly [Id in EffortSignalId]: SignalMeta<Id> } = {
  // Resting muscle (Elia 1992's 13 kcal/kg/day via Wang 2012, × Janssen 2000's 38.4 % muscle) + all of the activity extra.
  'muscle.energyRate': {
    id: 'muscle.energyRate',
    unit: 'kcal/h',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: ['wang2012', 'janssen2000', ...ACTIVITY_SOURCES],
    i18nKey: k('muscle.energyRate'),
    reactsToMeal: false,
    shipsIn: 'v3.0',
    round: 1,
    limitKey: 'limits.muscleEnergy',
    // Resting muscle (13.5 kcal/h) up to a run's 580 kcal/h, with room: a design guard.
    validRange: { low: 10, high: 700, basis: 'guard' },
  },
  // Warm room: the activity's extra heat leaves as evaporated sweat (580 kcal per kg, Baker 2019).
  'skin.sweatRate': {
    id: 'skin.sweatRate',
    unit: 'mL/h',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: SWEAT_SOURCES,
    i18nKey: k('skin.sweatRate'),
    reactsToMeal: false,
    shipsIn: 'v3.0',
    round: 10,
    limitKey: 'limits.sweatWarmRoom',
    // Reported whole-body sweating rates "~ 0.2 to 3 L/h" (Baker & Wolfe 2020); 0 at rest.
    validRange: { low: 0, high: 3000, basis: 'cited' },
  },
  'skin.sweatTotal': {
    id: 'skin.sweatTotal',
    unit: 'mL',
    status: 'assumption',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: SWEAT_SOURCES,
    i18nKey: k('skin.sweatTotal'),
    reactsToMeal: false,
    shipsIn: 'v3.0',
    round: 5,
    limitKey: 'limits.sweatWarmRoom',
    // At most 3 L/h for all 48 h would be 144 L; the plans allowed give well under 20 L: a design guard.
    validRange: { low: 0, high: 20000, basis: 'guard' },
  },
}

/** The pack's rows, as `registerSignals` takes them (the web's `rows` loader of the `effort` pack, U-1). */
const rows: readonly SignalMeta[] = Object.values(EFFORT_SIGNALS)
export default rows
