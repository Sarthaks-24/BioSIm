/**
 * LifePeek signal catalog — the frozen glossary (ROADMAP §2b). Frozen on: 2026-10-12.
 *
 * Every number the app draws, prints, reads aloud or writes into a link is one of these IDs.
 * The IDs are a PUBLIC CONTRACT: share links, golden tests, i18n keys and teachers' worksheets
 * depend on them.
 *   - NEVER rename or delete an ID. Only add new ones (and add them here first).
 *   - IDs are organism-neutral: never prefix with an organism ("human.gut…" is wrong). A shared ID
 *     means the same quantity, unit and definition in every organism that provides it.
 *     New anatomy gets new segments (gut.rumen.*, leaf.*, cell.*, gill.*).
 *   - Derived views (% of meal, rise above fasting, per kg) are HELPERS (core/derive.ts), not IDs.
 *   - Rows with shipsIn 'v2.0' are produced by the engine. All other rows are RESERVED names: they
 *     exist so nobody invents a new name for the same thing. The engine must not emit them yet.
 *   - Style: dotted, system first, camelCase segments. Organ and view IDs use the same style.
 * Tests: test/catalog.test.ts (shape), test/contract.test.ts (golden coverage, from WP-04),
 *        test/retired-names.test.ts (old plan names never come back)
 *        (WP-20 deleted the v1 files it used to skip; its `V1_EXEMPT` list is empty).
 */
import type { SourceId } from './sources.ts'
import type { OrganismId } from './organism.ts'

// ─── Vocabulary ──────────────────────────────────────────────────────────────────────────────
/** On screen: simulated → "Calculated from studies", assumption → "Model estimate", illustration → "Drawing only". */
export type SignalStatus = 'simulated' | 'assumption' | 'illustration'
/** 'sim' = the run's own clock (humans: the "meal clock", 0–48 h). 'real' = real seconds, whatever the sim speed. */
export type Clock = 'sim' | 'real'
export type Unit =
  'g' | 'g/min' | 'g/h' | 'kcal' | 'kcal/h' | 'kcal/min' | 'mg/dL' | 'xFasting' | 'beats/min' | 'breaths/min' | 'mL/min' | 'min'
/** level = amount right now · runningTotal = only goes up · rate = per unit time · rhythm = real-clock loop. */
export type SignalKind = 'level' | 'runningTotal' | 'rate' | 'rhythm'
/** Which release produces the signal. Only 'v2.0' is active. The others match ROADMAP bundles D, E, F. */
export type ShipsIn = 'v2.0' | 'lookInside' | 'bloodSugar' | 'alwaysRunning'

// ─── IDs ─────────────────────────────────────────────────────────────────────────────────────
/** Glossary rows 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13. The engine produces exactly these in v2.0. */
export const ACTIVE_SIGNAL_IDS = [
  'gut.stomach.contentG',
  'gut.stomach.liquidG',
  'gut.stomach.solidG',
  'gut.small.contentG',
  'gut.colon.contentG',
  'gut.absorbed.carbsG',
  'gut.absorbed.proteinG',
  'gut.absorbed.fatG',
  'gut.absorbed.waterG',
  'gut.absorbed.fibreG',
  'gut.leftBodyG',
  'blood.glucose',
  'energy.inRate',
  'energy.inTotal',
  'energy.usedRate',
  'energy.usedTotal',
] as const

/** Glossary rows 3, 7, 14–20. Reserved names: typed and documented, NOT produced yet. */
export const RESERVED_SIGNAL_IDS = [
  'gut.stomach.outflowRate',
  'gut.absorbRate.carbs',
  'gut.absorbRate.protein',
  'gut.absorbRate.fat',
  'gut.absorbRate.water',
  'blood.insulin',
  'liver.glucoseOutput',
  'liver.glycogenG',
  'brain.glucoseUse',
  'heart.rate',
  'lungs.breathRate',
  'kidney.filtrationRate',
] as const

/** Glossary "event.*" row. Points in time on the sim clock (timeline markers, summary sentences). */
export const EVENT_IDS = [
  'event.stomachHalfEmpty',
  'event.glucosePeak',
  'event.glucoseBackToBase',
  'event.mostlyAbsorbed',
  'event.firstLeftovers',
] as const

export type ActiveSignalId = (typeof ACTIVE_SIGNAL_IDS)[number]
export type ReservedSignalId = (typeof RESERVED_SIGNAL_IDS)[number]
export type SignalId = ActiveSignalId | ReservedSignalId
export type EventId = (typeof EVENT_IDS)[number]
export type CatalogId = SignalId | EventId

// ─── Metadata shapes ─────────────────────────────────────────────────────────────────────────
/** The "how people differ" band around a series (low/high edges). Has its own status. */
export interface BandMeta {
  status: SignalStatus
  sourceIds: readonly SourceId[]
  /** i18n: `${i18nKey}.name` ("How much people differ"). */
  i18nKey: string
}

export interface SignalMeta<Id extends SignalId = SignalId> {
  id: Id
  unit: Unit
  status: SignalStatus
  clock: Clock
  kind: SignalKind
  /** Registered sources. At run time the Series adds `food:<id>` for each food in the meal. */
  sourceIds: readonly SourceId[]
  /** Always `signals.${id}`. Sub-keys: .name .short .desc (required), .summary .summaryNone (optional) (see §7). */
  i18nKey: string
  /** false ⇒ the UI says it does not come from this meal ("Same for every meal", or "Always running" when clock is 'real'). */
  reactsToMeal: boolean
  shipsIn: ShipsIn
  /** One precise English sentence: what quantity, measured how. Shown to reviewers, used in docs. */
  definition: string
  band?: BandMeta
  /** Fixed graph y-range (a hint, not a clamp). Same for every meal: no per-meal rescaling. */
  displayRange?: readonly [number, number]
  /** Display rounding step (glucose 1, kcal/h 5, g 5). */
  round?: number
  /** i18n key of the "known limit" text shown in "How we know". */
  limitKey?: string
  /** Old plan names this ID replaces. Never use them in code (retired-names.test.ts). */
  retired: readonly string[]
}

export interface EventMeta<Id extends EventId = EventId> {
  id: Id
  unit: 'min'
  status: SignalStatus
  clock: 'sim'
  /** The signal the event is read from (the marker's "Show as table" points at it). */
  foundOn: ActiveSignalId
  /** true ⇒ the point has low/high edges (between-person range). */
  hasRange: boolean
  sourceIds: readonly SourceId[]
  /** Always `signals.${id}` (so `signals.event.glucosePeak.name`). */
  i18nKey: string
  shipsIn: ShipsIn
  definition: string
  retired: readonly string[]
}

/** A graph may only take these. Illustration and real-clock signals are never charted (binding 5). */
export type ChartableMeta = SignalMeta & { status: 'simulated' | 'assumption'; clock: 'sim' }
export const isChartable = (m: SignalMeta): m is ChartableMeta => m.status !== 'illustration' && m.clock === 'sim'

// ─── The frozen rows ─────────────────────────────────────────────────────────────────────────
const k = (id: string) => `signals.${id}`
const GUT_EMPTYING = ['ziessman2009', 'brener1983', 'hunt1975', 'abell2008', 'siegel1988'] as const
const GUT_TRANSIT = ['openstax-ap2e-23', 'nandhra2023'] as const

export const SIGNALS: { readonly [Id in SignalId]: SignalMeta<Id> } = {
  // ── v2.0 (active) ──────────────────────────────────────────────────────────────────────
  'gut.stomach.contentG': {
    id: 'gut.stomach.contentG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: GUT_EMPTYING,
    i18nKey: k('gut.stomach.contentG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Grams of the meal still in the stomach, counted as food and drink as eaten (liquid + solid).',
    displayRange: [0, 1000],
    round: 5,
    retired: ['stomach.share', 'gut.stomach.fill', 'gut.stomach.contents', 'stomach.contentsG'],
  },
  'gut.stomach.liquidG': {
    id: 'gut.stomach.liquidG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: ['ziessman2009', 'brener1983', 'hunt1975'],
    i18nKey: k('gut.stomach.liquidG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Grams of the drinks in the meal still in the stomach.',
    displayRange: [0, 1000],
    round: 5,
    retired: ['stomach.liquidG'],
  },
  'gut.stomach.solidG': {
    id: 'gut.stomach.solidG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: ['abell2008', 'siegel1988', 'hunt1975'],
    i18nKey: k('gut.stomach.solidG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Grams of the solid foods in the meal still in the stomach.',
    displayRange: [0, 1000],
    round: 5,
    retired: ['stomach.solidG'],
  },
  'gut.small.contentG': {
    id: 'gut.small.contentG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: GUT_TRANSIT,
    i18nKey: k('gut.small.contentG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Grams of tracked nutrients (carbohydrate, protein, fat, fibre, water) from the meal in the small intestine.',
    round: 5,
    retired: ['gut.smallIntestineG', 'si.contentsG', 'gut.si.contentG'],
  },
  'gut.colon.contentG': {
    id: 'gut.colon.contentG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: GUT_TRANSIT,
    i18nKey: k('gut.colon.contentG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Grams of tracked nutrients from the meal in the large intestine (colon).',
    round: 5,
    retired: ['gut.colonG', 'colon.contentsG'],
  },
  'gut.absorbed.carbsG': {
    id: 'gut.absorbed.carbsG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: ['openstax-ap2e-23'],
    i18nKey: k('gut.absorbed.carbsG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Running total of digestible carbohydrate (not fibre) from the meal absorbed into the body.',
    round: 1,
    retired: ['absorbed.carbs'],
  },
  'gut.absorbed.proteinG': {
    id: 'gut.absorbed.proteinG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: ['openstax-ap2e-23'],
    i18nKey: k('gut.absorbed.proteinG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Running total of protein from the meal absorbed into the body.',
    round: 1,
    retired: ['absorbed.protein'],
  },
  'gut.absorbed.fatG': {
    id: 'gut.absorbed.fatG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: ['openstax-ap2e-23'],
    i18nKey: k('gut.absorbed.fatG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Running total of fat from the meal absorbed into the body (blood and lymph).',
    round: 1,
    retired: ['absorbed.fat'],
  },
  'gut.absorbed.waterG': {
    id: 'gut.absorbed.waterG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: ['openstax-ap2e-23'],
    i18nKey: k('gut.absorbed.waterG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Running total of water from the meal absorbed in the small and large intestine.',
    round: 5,
    retired: ['absorbed.water', 'water.absorbed.total'],
  },
  'gut.absorbed.fibreG': {
    id: 'gut.absorbed.fibreG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: ['openstax-ap2e-23'],
    i18nKey: k('gut.absorbed.fibreG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Running total of fibre absorbed. Always 0 in this model: the body cannot digest fibre.',
    round: 1,
    retired: ['absorbed.fibre', 'absorbed.fiber'],
  },
  'gut.leftBodyG': {
    id: 'gut.leftBodyG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: GUT_TRANSIT,
    i18nKey: k('gut.leftBodyG'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Running total of tracked nutrients from the meal that have left the body (mostly fibre and water).',
    round: 1,
    retired: ['body.leftG', 'gut.excretedG', 'gut.location.leftBody'],
  },
  'blood.glucose': {
    id: 'blood.glucose',
    unit: 'mg/dL',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: ['freckmann2007', 'bergman1979', 'brouns2005', 'moghaddam2006', 'atkinson2008'],
    i18nKey: k('blood.glucose'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition:
      'Plasma glucose of the typical healthy adult, absolute (fasting ≈ 90 mg/dL). The rise above fasting is a helper, not an ID.',
    // Band edges ×0.65 / ×1.45 (PARAMS.glucose.bandLow/High) are not cited yet, so the band is a 'Model estimate'.
    band: { status: 'assumption', sourceIds: [], i18nKey: k('blood.glucose.band') },
    displayRange: [60, 200],
    round: 1,
    limitKey: 'limits.glucoseTail',
    retired: ['glucose.plasma', 'blood.glucoseRise', 'blood.glucose.riseAboveFasting'],
  },
  'energy.inRate': {
    id: 'energy.inRate',
    unit: 'kcal/h',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: ['fao2003', 'openstax-ap2e-23'],
    i18nKey: k('energy.inRate'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition:
      'Food energy entering the body per hour: 4·carbohydrate + 4·protein + 9·fat (kcal/g, Atwater) of the grams absorbed in that hour. Fibre left out.',
    displayRange: [0, 400],
    round: 5,
    limitKey: 'limits.energyInAtwater',
    retired: ['energy.in.rate'], // note: earlier plans used kcal/min under this same ID; the unit is kcal/h, frozen
  },
  'energy.inTotal': {
    id: 'energy.inTotal',
    unit: 'kcal',
    status: 'simulated',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: ['fao2003', 'openstax-ap2e-23'],
    i18nKey: k('energy.inTotal'),
    reactsToMeal: true,
    shipsIn: 'v2.0',
    definition: 'Running total of energy.inRate: kcal from this meal that have entered the body so far.',
    round: 5,
    limitKey: 'limits.energyInAtwater',
    retired: ['energy.inCum', 'energy.in.total', 'energy.inKcal'],
  },
  'energy.usedRate': {
    id: 'energy.usedRate',
    unit: 'kcal/h',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: ['faowhounu2004', 'icmr-nin2020'],
    i18nKey: k('energy.usedRate'),
    reactsToMeal: false,
    shipsIn: 'v2.0',
    definition:
      "Resting energy use of the run's profile per hour: Schofield BMR (FAO/WHO/UNU 2004) with the ICMR-NIN 2020 Indian adjustment, ÷ 24. Does not depend on the meal.",
    displayRange: [0, 400],
    round: 5,
    limitKey: 'limits.energyUsedResting',
    retired: ['energy.used.rate'],
  },
  'energy.usedTotal': {
    id: 'energy.usedTotal',
    unit: 'kcal',
    status: 'assumption',
    clock: 'sim',
    kind: 'runningTotal',
    sourceIds: ['faowhounu2004', 'icmr-nin2020'],
    i18nKey: k('energy.usedTotal'),
    reactsToMeal: false,
    shipsIn: 'v2.0',
    definition: 'Running total of energy.usedRate since the meal started.',
    round: 5,
    limitKey: 'limits.energyUsedResting',
    retired: ['energy.usedCum', 'energy.used.total', 'energy.usedKcal'],
  },

  // ── Reserved (do NOT emit yet). sourceIds are filled when the bundle ships. ────────────
  'gut.stomach.outflowRate': {
    id: 'gut.stomach.outflowRate',
    unit: 'kcal/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('gut.stomach.outflowRate'),
    reactsToMeal: true,
    shipsIn: 'lookInside',
    definition: 'Food energy leaving the stomach through the pylorus per minute.',
    retired: ['outflow'],
  },
  'gut.absorbRate.carbs': {
    id: 'gut.absorbRate.carbs',
    unit: 'g/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('gut.absorbRate.carbs'),
    reactsToMeal: true,
    shipsIn: 'lookInside',
    definition: 'Grams of carbohydrate absorbed per minute.',
    retired: ['gut.si.absorbRate.carbs', 'gut.carbAbsorbRate', 'liver.portalCarbInflow'],
  },
  'gut.absorbRate.protein': {
    id: 'gut.absorbRate.protein',
    unit: 'g/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('gut.absorbRate.protein'),
    reactsToMeal: true,
    shipsIn: 'lookInside',
    definition: 'Grams of protein absorbed per minute.',
    retired: ['gut.si.absorbRate.protein'],
  },
  'gut.absorbRate.fat': {
    id: 'gut.absorbRate.fat',
    unit: 'g/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('gut.absorbRate.fat'),
    reactsToMeal: true,
    shipsIn: 'lookInside',
    definition: 'Grams of fat absorbed per minute.',
    retired: ['gut.si.absorbRate.fat'],
  },
  'gut.absorbRate.water': {
    id: 'gut.absorbRate.water',
    unit: 'g/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('gut.absorbRate.water'),
    reactsToMeal: true,
    shipsIn: 'lookInside',
    definition: 'Grams of water absorbed per minute (small + large intestine).',
    retired: ['gut.si.absorbRate.water'],
  },
  'blood.insulin': {
    id: 'blood.insulin',
    unit: 'xFasting',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: [],
    i18nKey: k('blood.insulin'),
    reactsToMeal: true,
    shipsIn: 'bloodSugar',
    definition: "Plasma insulin as a multiple of the fasting level. NOT today's lagged 'insulin action' term in glucose.ts.",
    retired: ['insulin.relative', 'insulin.action', 'pancreas.insulinAction', 'pancreas.insulinSecretion'],
  },
  'liver.glucoseOutput': {
    id: 'liver.glucoseOutput',
    unit: 'g/min',
    status: 'simulated',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('liver.glucoseOutput'),
    reactsToMeal: true,
    shipsIn: 'bloodSugar',
    definition: 'Net glucose the liver releases into the blood per minute (+ release, − taking up and storing).',
    retired: [],
  },
  'liver.glycogenG': {
    id: 'liver.glycogenG',
    unit: 'g',
    status: 'simulated',
    clock: 'sim',
    kind: 'level',
    sourceIds: [],
    i18nKey: k('liver.glycogenG'),
    reactsToMeal: true,
    shipsIn: 'bloodSugar',
    definition: 'Grams of glycogen stored in the liver.',
    retired: ['glycogen.liver'],
  },
  'brain.glucoseUse': {
    id: 'brain.glucoseUse',
    unit: 'g/h',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('brain.glucoseUse'),
    reactsToMeal: false,
    shipsIn: 'bloodSugar',
    definition: 'Glucose the brain uses per hour (cited constant; does not react to the meal).',
    retired: ['brain.glucoseUseGPerH'],
  },
  'heart.rate': {
    id: 'heart.rate',
    unit: 'beats/min',
    status: 'illustration',
    clock: 'real',
    kind: 'rhythm',
    sourceIds: [],
    i18nKey: k('heart.rate'),
    reactsToMeal: false,
    shipsIn: 'alwaysRunning',
    definition: 'Resting heart rate of the profile, shown as a real-time beat. Never graphed.',
    retired: ['heart.rateBpm', 'vitals.heartRate', 'rhythm.heart'],
  },
  'lungs.breathRate': {
    id: 'lungs.breathRate',
    unit: 'breaths/min',
    status: 'illustration',
    clock: 'real',
    kind: 'rhythm',
    sourceIds: [],
    i18nKey: k('lungs.breathRate'),
    reactsToMeal: false,
    shipsIn: 'alwaysRunning',
    definition: 'Resting breathing rate of the profile, shown as a real-time breath. Never graphed.',
    retired: ['lungs.breathsPerMin', 'vitals.breathRate', 'rhythm.breath'],
  },
  'kidney.filtrationRate': {
    id: 'kidney.filtrationRate',
    unit: 'mL/min',
    status: 'illustration',
    clock: 'real',
    kind: 'rate',
    sourceIds: [],
    i18nKey: k('kidney.filtrationRate'),
    reactsToMeal: false,
    shipsIn: 'alwaysRunning',
    definition: 'Plasma filtered by both kidneys per minute (GFR), shown as a caption. Never graphed.',
    retired: ['kidney.gfr', 'kidney.filtrationMlMin'],
  },
}

export const EVENTS: { readonly [Id in EventId]: EventMeta<Id> } = {
  'event.stomachHalfEmpty': {
    id: 'event.stomachHalfEmpty',
    unit: 'min',
    status: 'simulated',
    clock: 'sim',
    foundOn: 'gut.stomach.contentG',
    hasRange: false,
    sourceIds: ['ziessman2009', 'brener1983', 'hunt1975', 'abell2008'],
    i18nKey: k('event.stomachHalfEmpty'),
    shipsIn: 'v2.0',
    // By energy on purpose: adding water to a meal never makes it look faster (a drink with
    // calories can, a little: its energy leaves first). So on a grams strip the half-way point in
    // grams can come before this marker (the drink's grams leave first).
    definition: "First minute when half of the meal's food energy (for energy-free drinks: half its weight) has left the stomach.",
    retired: ['events.stomachHalfEmpty', 'events.half'],
  },
  'event.glucosePeak': {
    id: 'event.glucosePeak',
    unit: 'min',
    status: 'simulated',
    clock: 'sim',
    foundOn: 'blood.glucose',
    hasRange: false,
    sourceIds: ['freckmann2007', 'brouns2005'],
    i18nKey: k('event.glucosePeak'),
    shipsIn: 'v2.0',
    definition: 'Minute when typical blood glucose is highest. Absent if the rise is under 1 mg/dL.',
    retired: ['events.glucosePeak', 'events.peak'],
  },
  'event.glucoseBackToBase': {
    id: 'event.glucoseBackToBase',
    unit: 'min',
    status: 'simulated',
    clock: 'sim',
    foundOn: 'blood.glucose',
    hasRange: false,
    sourceIds: ['ada2001'],
    i18nKey: k('event.glucoseBackToBase'),
    shipsIn: 'v2.0',
    definition:
      'First minute after the peak when typical blood glucose is within PARAMS.glucose.backToBaseMgDl (5) of fasting. The threshold is a display choice, not physiology.',
    retired: ['events.backToBaseline'],
  },
  'event.mostlyAbsorbed': {
    id: 'event.mostlyAbsorbed',
    unit: 'min',
    status: 'simulated',
    clock: 'sim',
    foundOn: 'gut.absorbed.carbsG',
    hasRange: false,
    sourceIds: ['openstax-ap2e-23'],
    i18nKey: k('event.mostlyAbsorbed'),
    shipsIn: 'v2.0',
    definition: '90 % of the carbohydrate, protein and fat that will be absorbed is in the body. Absent if the meal has < 0.5 g of them.',
    retired: ['events.mostlyAbsorbed', 'events.absorbed'],
  },
  'event.firstLeftovers': {
    id: 'event.firstLeftovers',
    unit: 'min',
    status: 'simulated',
    clock: 'sim',
    foundOn: 'gut.leftBodyG',
    hasRange: true,
    sourceIds: ['nandhra2023', 'openstax-ap2e-23', 'wang2015'],
    i18nKey: k('event.firstLeftovers'),
    shipsIn: 'v2.0',
    definition:
      'Leftovers (fibre the body cannot digest) start leaving the body. Typical value plus a low–high range that depends mostly on the person. Absent if < 1 g fibre.',
    retired: ['events.firstExit', 'events.exit'],
  },
}

/** What each organism can produce. The contract test requires goldens per organism for these. */
export const PROVIDES: { readonly [O in OrganismId]: readonly ActiveSignalId[] } = {
  human: ACTIVE_SIGNAL_IDS,
}
export const HUMAN_PROVIDES = PROVIDES.human

export const isActiveSignal = (id: string): id is ActiveSignalId => (ACTIVE_SIGNAL_IDS as readonly string[]).includes(id)
export const isSignalId = (id: string): id is SignalId => Object.hasOwn(SIGNALS, id)
export const isEventId = (id: string): id is EventId => Object.hasOwn(EVENTS, id)
