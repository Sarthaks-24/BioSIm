/**
 * The breathing pack's catalog rows (S-2, model §2.2, ACTIVATION_LOG). Lazy rows (architecture
 * §1.3): the main entry never imports this file, so the first download carries only the IDs' type;
 * the run chunk reads the rows through core/catalog/rows.ts, and the web registers them with the
 * breathing pack. Same rules as catalog.ts: never rename or delete an ID, only add.
 *
 * Every row is a "Model estimate": the gas module reads x.energy.total, whose resting part
 * (energy.usedRate) is one (model D9), and the rate/depth split is hand-picked (model §2.2 Limits).
 */
import type { SignalMeta } from '../catalog.ts'

export const BREATHING_SIGNAL_IDS = [
  'gas.o2UseRate',
  'gas.co2OutRate',
  'gas.exchangeRatio',
  'lungs.breathRate',
  'lungs.tidalVolume',
] as const
export type BreathingSignalId = (typeof BREATHING_SIGNAL_IDS)[number]

const k = (id: string) => `signals.${id}`
const GAS_SOURCES = ['kaiyala2019', 'byrne2005', 'herrmann2024'] as const
const RQ_SOURCES = ['charriere2016', 'gribok2016', 'spriet2020'] as const
const BREATH_SOURCES = ['openstax-ap2e-22'] as const

export const BREATHING_SIGNALS: { readonly [Id in BreathingSignalId]: SignalMeta<Id> } = {
  // Oxygen used: Weir without protein, VO2 = E ÷ (3.941 + 1.106·RQ) (model D1).
  'gas.o2UseRate': {
    id: 'gas.o2UseRate',
    unit: 'mL/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: GAS_SOURCES,
    i18nKey: k('gas.o2UseRate'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    round: 5,
    limitKey: 'limits.gasExchange',
    validRange: { low: 150, high: 3000, basis: 'guard' },
  },
  // Carbon dioxide made: VCO2 = RQ·VO2.
  'gas.co2OutRate': {
    id: 'gas.co2OutRate',
    unit: 'mL/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [...GAS_SOURCES, ...RQ_SOURCES],
    i18nKey: k('gas.co2OutRate'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    round: 5,
    limitKey: 'limits.gasExchange',
    validRange: { low: 100, high: 3000, basis: 'guard' },
  },
  // RQ = VCO2/VO2, steady state. Only in Teach and the table (model §2.2 Graphs).
  'gas.exchangeRatio': {
    id: 'gas.exchangeRatio',
    unit: 'ratio',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: RQ_SOURCES,
    i18nKey: k('gas.exchangeRatio'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    round: 0.01,
    limitKey: 'limits.gasExchange',
    validRange: { low: 0.7, high: 1, basis: 'guard' },
  },
  // Activated from the reserved list (unit kept): now a sim-clock level, graphed (ACTIVATION_LOG).
  'lungs.breathRate': {
    id: 'lungs.breathRate',
    unit: 'breaths/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: BREATH_SOURCES,
    i18nKey: k('lungs.breathRate'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    displayRange: [0, 50],
    round: 1,
    limitKey: 'limits.breathSplit',
    validRange: { low: 8, high: 50, basis: 'guard' },
  },
  'lungs.tidalVolume': {
    id: 'lungs.tidalVolume',
    unit: 'mL',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: BREATH_SOURCES,
    i18nKey: k('lungs.tidalVolume'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    displayRange: [0, 2500],
    round: 10,
    limitKey: 'limits.breathSplit',
    validRange: { low: 300, high: 2500, basis: 'guard' },
  },
}

/** The pack's rows, as `registerSignals` takes them (the web's `rows` loader of the `breathing` pack, U-2). */
const rows: readonly SignalMeta[] = Object.values(BREATHING_SIGNALS)
export default rows
