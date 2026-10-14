import type { ComponentType, RefObject } from 'react'
import type { TFunction } from 'i18next'
import type { ActiveSignalId, ActivityBout, CatalogId, Clock, EventMeta, RunResult, SignalMeta, Unit } from '@lifepeek/engine'
import type { Moment } from '../lib/moments.ts'
import type { LayerComponent, LifeProcess, Loader, OrganId, SystemCamera } from '../registry/types.ts'
import { DIGESTION } from './digestion/def.ts'

/**
 * The systems registry (W-1, architecture §0, §5.1 and §5.2): every body system the stage can
 * light, as data. A system is one `SystemDef` (its graph slots, organs, drawing, release flag)
 * and one `SystemUi` (its Now line, summary sentence, graph sentences and moments: systems/ui.ts).
 * The stage reads these instead of hard-wiring digestion, so a new system is its folder here
 * (`systems/<id>/`), its pack (`systems/packs.ts`) and one entry in SYSTEMS.
 * `registry.test.ts` checks every piece and names the one that is missing.
 */

/**
 * SystemIds (architecture §0, frozen): the `layer` link values, one picker row each, one anatomy
 * layer each. Never renamed: links and lessons carry them.
 */
export const SYSTEM_IDS = [
  'digestion',
  'breathing',
  'circulation',
  'kidneys',
  'muscles',
  'skin',
  'bones',
  'lymph',
  'hormones',
  'nerves',
  'reproduction',
] as const
export type SystemId = (typeof SYSTEM_IDS)[number]

/**
 * PackIds (architecture §0, frozen): one lazy set of chunks (UI, catalog rows, flat drawing) and one
 * text section `sys.<packId>` each. `core` is digestion (first paint). Never `movement` or `defence`.
 */
export const PACK_IDS = ['core', 'breathing', 'circulation', 'kidneys', 'effort', 'lymph', 'control', 'reproduction'] as const
export type PackId = (typeof PACK_IDS)[number]

/** Which pack serves each system (architecture §5.1): a pack may serve several rows. */
export const PACK_OF: { readonly [S in SystemId]: PackId } = {
  digestion: 'core',
  breathing: 'breathing',
  circulation: 'circulation',
  kidneys: 'kidneys',
  muscles: 'effort',
  skin: 'effort',
  bones: 'effort',
  lymph: 'lymph',
  hormones: 'control',
  nerves: 'control',
  reproduction: 'reproduction',
}

/**
 * A graph slot's id: its tab name (`stage.strips.<id>`), the table it opens, the graph a lesson is
 * about. Keys 1–3 pick a slot by its place; digestion's are `gut`, `blood` and `energy`.
 */
export type SlotId = string

/** One graph: a main line and, on the same axis, an optional second (architecture §5.2). */
export interface GraphSlotDef {
  id: SlotId
  /** The main line, then the second (one unit, one y-axis). Never a drawing-only or real-clock signal. */
  signals: readonly [ActiveSignalId] | readonly [ActiveSignalId, ActiveSignalId]
  /** The slot's one unit: every signal in it has this unit (registry.test). */
  unit: Unit
  /** v3.0 only: digestion's letter alias of the slot's key (S, B, E; lib/keys.ts). */
  letter?: 's' | 'b' | 'e'
  /** "How we know" limits besides each signal's own (`limits.*` keys; their text loads with the panel). */
  limits?: readonly string[]
  /** The ring's label on the main line → the label naming the meal, used when a kept meal is drawn too. */
  marks?: Readonly<Record<string, string>>
}

/** What a system's Now line gets from the stage (components/stage/BodyPane.tsx). */
export interface NowProps {
  run: RunResult
  kept: RunResult | null
  open: boolean
  onToggle: () => void
  /** The control "More" opens from; focus returns to it when the text closes. */
  moreRef: RefObject<HTMLButtonElement | null>
  panelId: string
  className?: string
}

/** One meal or the kept one: whose line a summary's key number is about. */
export type RunKey = 'run' | 'kept'

/** The summary sentence under the body: the headline, its key number (in its line's colour), the reason. */
export interface Summary {
  headline: string
  key?: { text: string; line: RunKey }
  reason?: string
}

/** A system's words and moments (architecture §5.2). Digestion's is static (systems/ui.ts); a pack brings its others. */
export interface SystemUi {
  /** The Now line: where things are at this minute of the meal clock. */
  now: ComponentType<NowProps>
  /** The summary sentence for this meal, or this meal against the kept one. */
  summary: (run: RunResult, kept: RunResult | null, t: TFunction, lang: string) => Summary | null
  /** One graph's sentence (its text alternative), by its main signal; null when there is none. */
  stripSummary: (id: ActiveSignalId, run: RunResult, t: TFunction, lang: string) => string | null
  /** The run's key moments, in catalog order: the dock's markers and Page Up / Down. */
  moments: (run: RunResult) => Moment[]
}

/** What a system's inputs are: the meal, the activity bouts. */
export type InputKind = 'meal' | 'activity'

export interface SystemDef {
  id: SystemId
  /** `systems.${id}` (.name). */
  i18nKey: string
  lifeProcess: LifeProcess
  /** 'sim' = moves with the meal clock; 'real' = always running; 'both' = has loops of each kind. */
  clock: Clock | 'both'
  /** Its framing (the flat VIEW: torso, chest, upper or full; anatomy plan §1), later its 3D preset. */
  camera: SystemCamera
  /** Organs lit when this system is on. */
  organs: readonly OrganId[]
  /** Its graphs, at most 3, in key order (1–3). Empty for a drawing-only row (R11). */
  slots: readonly GraphSlotDef[]
  /** `limits.*` texts "How we know" lists for this system, besides each signal's own `limitKey`. */
  knownLimits: readonly string[]
  /**
   * How the system is drawn. 'body': the organism's own body draws it (digestion). 'layer': a flat
   * layer over the base body, from its pack's drawing module (systems/load.ts `PackDef.drawing`), which
   * loads with the pack when the system is first lit (A-0 flat registry; R71, R74).
   */
  draw: 'body' | 'layer'
  /** Its 3D layer (v3.1+, optional per system: R43). Without one the system is drawn flat on every device. */
  layer3d?: Loader<LayerComponent>
  /** Its pack (architecture §0): the lazy chunks and the text section `sys.<pack>`. */
  pack: PackId
  inputs: readonly InputKind[]
  /** Real-clock loops it draws (a heartbeat, a breath), never graphed. */
  rhythms: readonly ActiveSignalId[]
  /** The time its graphs show, in meal-clock minutes. */
  graphWindowMin: number
  /** The NCERT chapter the picker names (U-2), when the system is in one. */
  ncertKey?: string
  /**
   * In the picker and openable from a plain link. Only after the release gate (architecture §5.2);
   * a drawing-only row may be public with empty `slots` (R11). Hidden rows open only with `?preview=1`.
   */
  public: boolean
  /** Shown only when a teacher switches it on (reproduction, v3.2+). */
  teacherSwitch?: boolean
}

/** The human's systems, in picker order. Only built systems are here: the others are SystemIds with no row yet. */
export const SYSTEMS: readonly SystemDef[] = [DIGESTION]

export const systemOf = (id: string | undefined): SystemDef | undefined => SYSTEMS.find((s) => s.id === id)

/** The system a bare page and a link without `layer` (and without activity) open. */
export const DEFAULT_SYSTEM: SystemId = 'digestion'

const isPublic = (id: SystemId) => !!systemOf(id)?.public

/**
 * The system a link with no `layer` opens: Heart & blood when it carries activity (R39), once that
 * row is public; until then Digestion. linkQuery writes `layer` only when it differs from this.
 */
export const defaultSystemFor = (activity: readonly ActivityBout[]): SystemId =>
  activity.length && isPublic('circulation') ? 'circulation' : DEFAULT_SYSTEM

/**
 * The system a link opens (architecture §5.2): what it asks for if that row is public, or is built
 * and the link has `?preview=1`; otherwise the default (with the "link changed" note, state/run.ts).
 */
export function systemForLink(asked: string | undefined, activity: readonly ActivityBout[], preview: boolean): SystemId {
  const s = systemOf(asked)
  return s && (s.public || preview) ? s.id : defaultSystemFor(activity)
}

/** One catalog row as a pack registers it. */
export type CatalogRow = SignalMeta | EventMeta

const ROWS = new Map<CatalogId, CatalogRow>()
const REGISTERED = new Map<PackId, Set<CatalogId>>()

/**
 * Lazy catalog rows (architecture §1.3): a pack's rows arrive with the pack, not in the first
 * download. The pack's loader hands them here; the stage reads a row with `signalRow`. Every series
 * of a run also carries its own row (`series.meta`), so nothing needs a row before a run.
 */
export function registerSignals(pack: PackId, rows: Iterable<CatalogRow>): void {
  const ids = REGISTERED.get(pack) ?? new Set()
  for (const row of rows) {
    ROWS.set(row.id, row)
    ids.add(row.id)
  }
  REGISTERED.set(pack, ids)
}

/** A registered row, or undefined if its pack has not brought it. */
export const signalRow = (id: CatalogId): CatalogRow | undefined => ROWS.get(id)

/** The IDs a pack registered (registry.test: a slot's signal must come from its own pack or `core`). */
export const rowsOf = (pack: PackId): ReadonlySet<CatalogId> => REGISTERED.get(pack) ?? new Set()

/** The rows the layer switch offers: the public ones, and the lit one if a preview link opened a hidden row. */
export const pickerSystems = (lit: SystemId): SystemDef[] => SYSTEMS.filter((s) => s.public || s.id === lit)
