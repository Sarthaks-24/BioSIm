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
 *   - Rows with shipsIn 'v2.0' or 'v3.0' are produced by the engine. All other rows are RESERVED names: they
 *     exist so nobody invents a new name for the same thing. The engine must not emit them yet.
 *   - This file is the IDs, types and helpers. The active rows are in each pack's file
 *     (catalog/<packId>.ts, W-1), which the stage's first download never carries; reserved rows and
 *     each row's `definition` and `retired` names are in catalog-docs.ts.
 *   - Style: dotted, system first, camelCase segments. Organ and view IDs use the same style.
 * Tests: test/catalog.test.ts (shape, and that the two files agree), test/contract.test.ts (golden coverage, from WP-04),
 *        test/retired-names.test.ts (old plan names never come back)
 *        (WP-20 deleted the v1 files it used to skip; its `V1_EXEMPT` list is empty).
 */
import type { SourceId } from './sources.ts'
import type { BreathingSignalId } from './catalog/breathing.ts'

// ─── Vocabulary ──────────────────────────────────────────────────────────────────────────────
/** On screen: simulated → "Calculated from studies", assumption → "Model estimate", illustration → "Drawing only". */
export type SignalStatus = 'simulated' | 'assumption' | 'illustration'
/** 'sim' = the run's own clock (humans: the "meal clock", 0–48 h). 'real' = real seconds, whatever the sim speed. */
export type Clock = 'sim' | 'real'
export type Unit =
  | 'g'
  | 'g/min'
  | 'g/h'
  | 'kcal'
  | 'kcal/h'
  | 'kcal/min'
  | 'mg/dL'
  | 'xFasting'
  | 'beats/min'
  | 'breaths/min'
  | 'mL/min'
  | 'min'
  // Model version 3 (model ACTIVATION_LOG "New units").
  | 'mL'
  | 'ratio'
/** level = amount right now · runningTotal = only goes up · rate = per unit time · rhythm = real-clock loop. */
export type SignalKind = 'level' | 'runningTotal' | 'rate' | 'rhythm'
/** Which release produces the signal: 'v2.0' and 'v3.0' are active (model ACTIVATION_LOG). The others match ROADMAP bundles D, E, F. */
export type ShipsIn = 'v2.0' | 'v3.0' | 'v3.1' | 'lookInside' | 'bloodSugar' | 'alwaysRunning'

// ─── IDs ─────────────────────────────────────────────────────────────────────────────────────
/** Glossary rows 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, then version 3's. The engine produces exactly these. */
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
  // Model version 3 (E-3b-eng, model §2.1 and ACTIVATION_LOG). Added at the end, so every earlier row keeps its place.
  'gut.absorbRate.carbs',
  'gut.absorbRate.protein',
  'gut.absorbRate.fat',
  'gut.absorbRate.water',
  'energy.activityRate',
  'energy.activityTotal',
  'energy.foodEffectRate',
] as const

/** Glossary rows 3, 7, 14–20. Reserved names: typed and documented, NOT produced yet. */
export const RESERVED_SIGNAL_IDS = [
  'gut.stomach.outflowRate',
  'blood.insulin',
  'liver.glucoseOutput',
  'liver.glycogenG',
  'brain.glucoseUse',
  'heart.rate',
  'kidney.filtrationRate',
] as const

/** Glossary "event.*" row. Points in time on the sim clock (timeline markers, summary sentences). */
export const EVENT_IDS = [
  'event.stomachHalfEmpty',
  'event.glucosePeak',
  'event.glucoseBackToBase',
  'event.mostlyAbsorbed',
  'event.firstLeftovers',
  'event.activityStart',
  'event.activityEnd',
] as const

export type ActiveSignalId = (typeof ACTIVE_SIGNAL_IDS)[number]
export type ReservedSignalId = (typeof RESERVED_SIGNAL_IDS)[number]
/**
 * Lazy rows (architecture §1.3): signals the engine produces whose rows arrive with their system's
 * pack (core/catalog/<pack>.ts), so the first download carries only their type. The run chunk
 * knows every row (core/catalog/rows.ts). lungs.breathRate left the reserved list for the
 * breathing pack (S-2, model ACTIVATION_LOG), unit kept.
 */
export type PackSignalId = BreathingSignalId
/** Every signal a run produces: the lean catalog's rows and the packs' rows. */
export type RunSignalId = ActiveSignalId | PackSignalId
export type SignalId = ActiveSignalId | ReservedSignalId | PackSignalId
export type EventId = (typeof EVENT_IDS)[number]
export type CatalogId = SignalId | EventId

// ─── Metadata shapes ─────────────────────────────────────────────────────────────────────────
/** The range every run must stay in (model §5 validRange), never clamped to pass, and what it rests on. */
export interface ValidRange {
  low: number
  high: number
  /** 'cited' = a read source gives it; 'guard' = a design guard (G). */
  basis: 'cited' | 'guard'
}

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
  band?: BandMeta
  /** Fixed graph y-range (a hint, not a clamp). Same for every meal: no per-meal rescaling. */
  displayRange?: readonly [number, number]
  /** Display rounding step (glucose 1, kcal/h 5, g 5). */
  round?: number
  /** i18n key of the "known limit" text shown in "How we know". */
  limitKey?: string
  /** Version-3 pack rows (architecture §1.3): checked by the fuzz test. */
  validRange?: ValidRange
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
}

/** A graph may only take these. Illustration and real-clock signals are never charted (binding 5). */
export type ChartableMeta = SignalMeta & { status: 'simulated' | 'assumption'; clock: 'sim' }
export const isChartable = (m: SignalMeta): m is ChartableMeta => m.status !== 'illustration' && m.clock === 'sim'

// ─── The frozen rows ─────────────────────────────────────────────────────────────────────────
/**
 * The rows are in each pack's own file, core/catalog/<packId>.ts (architecture §1.3, W-1): this
 * file is IDs, types and helpers only, so a screen module that needs an ID never brings every row
 * into the first download. The engine (the run chunk), tests and scripts read every row here.
 * A new pack's rows join these two maps when its system is built.
 */
export { CORE_SIGNALS as SIGNALS, CORE_EVENTS as EVENTS } from './catalog/core.ts'

export const isActiveSignal = (id: string): id is ActiveSignalId => (ACTIVE_SIGNAL_IDS as readonly string[]).includes(id)
export const isSignalId = (id: string): id is SignalId => isActiveSignal(id) || (RESERVED_SIGNAL_IDS as readonly string[]).includes(id)
export const isEventId = (id: string): id is EventId => (EVENT_IDS as readonly string[]).includes(id)
