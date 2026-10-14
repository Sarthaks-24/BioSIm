/**
 * The circulation pack's catalog rows (Heart & blood; S-3, model §2.3). Lazy rows (architecture
 * §1.3): the main entry never imports this file, so the first download carries only the IDs' type;
 * the run chunk reads the rows through core/catalog/rows.ts. Same rules as catalog.ts: never
 * rename or delete an ID, only add. heart.rate left the reserved list (a real-clock beat) for this
 * pack as a graphed sim-clock level, unit kept (model ACTIVATION_LOG).
 *
 * Every row is a "Model estimate": the module reads gas.o2UseRate and the food effect, both
 * assumptions (D9), and the resting a–v O2 difference, the gut-flow K and the carbohydrate weight
 * are calibrations (V-3). The pack's one event row is lazy too (core/catalog.ts PackEventId).
 */
import type { EventMeta, RunEventId, SignalMeta } from '../catalog.ts'

export const CIRCULATION_SIGNAL_IDS = ['heart.rate', 'heart.output', 'heart.strokeVolume', 'blood.flow.gut', 'blood.flow.muscle'] as const
export type CirculationSignalId = (typeof CIRCULATION_SIGNAL_IDS)[number]

export const CIRCULATION_EVENT_IDS = ['event.gutFlowPeak'] as const
export type CirculationEventId = (typeof CIRCULATION_EVENT_IDS)[number]

const k = (id: string) => `signals.${id}`
/** Resting CO (Klabunde, Higginbotham), the moving slope (Stringer, Cook) and OpenStax's bands. */
const CO_SOURCES = ['klabunde2023', 'stringer2005', 'cook2005', 'openstax-ap2e-19'] as const
/** The meal's part: Eriksen's calibration and additivity, Sieber's weights, Waaler's timing. */
const MEAL_SOURCES = ['eriksen1994', 'sieber1992', 'waaler1991'] as const
const SV_SOURCES = ['higginbotham1986', 'openstax-ap2e-19'] as const
const FLOW_SOURCES = ['openstax-ap2e-20'] as const

export const CIRCULATION_SIGNALS: { readonly [Id in CirculationSignalId]: SignalMeta<Id> } = {
  // HR = CO / SV, at most 220 − 29 = 191 (OpenStax §19.4).
  'heart.rate': {
    id: 'heart.rate',
    unit: 'beats/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: [...CO_SOURCES, 'higginbotham1986', ...MEAL_SOURCES],
    i18nKey: k('heart.rate'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    displayRange: [0, 200],
    round: 1,
    limitKey: 'limits.heartSplit',
    validRange: { low: 40, high: 191, basis: 'guard' },
  },
  // CO = CO_rest + 5.5·ΔVO2 of moving + the gut's extra flow (D7).
  'heart.output': {
    id: 'heart.output',
    unit: 'L/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [...CO_SOURCES, ...MEAL_SOURCES],
    i18nKey: k('heart.output'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    displayRange: [0, 20],
    round: 0.1,
    limitKey: 'limits.heartOutput',
    // Rest 4.3 up to a run with a big meal (about 16): a design guard.
    validRange: { low: 3, high: 25, basis: 'guard' },
  },
  // SV = 65 mL × (1 + 0.4·min(1, ΔCO of moving / 5 L/min)) (D8); a meal does not change it.
  'heart.strokeVolume': {
    id: 'heart.strokeVolume',
    unit: 'mL',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: [...SV_SOURCES, 'kelbaek1989'],
    i18nKey: k('heart.strokeVolume'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    displayRange: [0, 130],
    round: 1,
    limitKey: 'limits.heartSplit',
    // OpenStax §19.4: "Normal range for SV would be 55–100 mL" at rest; "SV can also increase from
    // 70 to approximately 130 mL" (a bout after a meal: 1.4× for moving and the meal's share, R80).
    validRange: { low: 55, high: 130, basis: 'cited' },
  },
  // 24 % of resting CO (OpenStax Table 20.3) + the meal's rise (Sieber weights, Eriksen size, R80),
  // less what it gives the muscles in a bout (Table 20.3: down to 600 of 1400 mL/min, R83).
  'blood.flow.gut': {
    id: 'blood.flow.gut',
    unit: 'mL/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [...FLOW_SOURCES, ...MEAL_SOURCES, 'klabunde2023'],
    i18nKey: k('blood.flow.gut'),
    reactsToMeal: true,
    shipsIn: 'v3.0',
    displayRange: [0, 5000],
    round: 10,
    limitKey: 'limits.gutFlow',
    // Fasting about 1 L/min, at most 3 L/min more, at least 43 % of it in the hardest bout: a design guard.
    validRange: { low: 400, high: 4500, basis: 'guard' },
  },
  // 21 % of resting CO + 90 % of the moving rise + what the gut gives up in a bout (OpenStax Table
  // 20.3, R83); a meal does not change it.
  'blood.flow.muscle': {
    id: 'blood.flow.muscle',
    unit: 'mL/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [...FLOW_SOURCES, 'klabunde2023', 'stringer2005', 'cook2005'],
    i18nKey: k('blood.flow.muscle'),
    reactsToMeal: false,
    shipsIn: 'v3.0',
    displayRange: [0, 15000],
    round: 10,
    limitKey: 'limits.heartOutput',
    // OpenStax Table 20.3: 1200 mL/min at rest, 12,500 in maximal exercise; with room: a design guard.
    validRange: { low: 500, high: 15000, basis: 'guard' },
  },
}

export const CIRCULATION_EVENTS: { readonly [Id in CirculationEventId]: EventMeta<Id> } = {
  // The minute the gut's blood flow is highest after a meal (none for water or a fasting rest).
  'event.gutFlowPeak': {
    id: 'event.gutFlowPeak',
    unit: 'min',
    status: 'assumption',
    clock: 'sim',
    foundOn: 'blood.flow.gut',
    hasRange: false,
    sourceIds: ['waaler1991', 'eriksen1994', 'sieber1992'],
    i18nKey: k('event.gutFlowPeak'),
    shipsIn: 'v3.0',
  },
}

/**
 * The pack's rows, as `registerSignals` takes them (the web's `rows` loader of the `circulation`
 * pack, U-3): its signals and its one moment.
 */
const rows: readonly (SignalMeta | EventMeta<RunEventId>)[] = [...Object.values(CIRCULATION_SIGNALS), ...Object.values(CIRCULATION_EVENTS)]
export default rows
