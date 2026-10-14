import type { ComponentType, RefObject } from 'react'
import type { TFunction } from 'i18next'
import type {
  ActiveSignalId,
  ActivityBout,
  CatalogId,
  Clock,
  EventMeta,
  MealItem,
  RunEventId,
  RunResult,
  Series,
  SignalMeta,
  Unit,
} from '@lifepeek/engine'
import type { Moment } from '../lib/moments.ts'
import type { Layer3d } from '../three/layer.ts'
import type { LifeProcess, Loader, OrganId, SystemCamera } from '../registry/types.ts'
import { DIGESTION } from './digestion/def.ts'
import { BREATHING } from './breathing/row.ts'
import { CIRCULATION } from './circulation/row.ts'
import { KIDNEYS } from './kidneys/row.ts'
import { LYMPH } from './lymph/def.ts'
import { HORMONES } from './hormones/row.ts'
import { BONES, MUSCLES, SKIN } from './muscles/row.ts'

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
  /**
   * Its tab's text key, when it is not `stage.strips.<id>` (core): a pack's graph names come with the
   * pack (`sys.<packId>.…`), never in the first download (tabKey).
   */
  tab?: string
  /** Its y range, when its main signal's catalog row has none (the pack's oxygen and carbon dioxide). */
  range?: readonly [number, number]
  /** A range drawn as a pale band across the graph, its key under it (breathing: most children's breaths, R57). */
  reference?: { low: number; high: number }
  /**
   * Beside a kept plan its lines show one at a time, each against its kept ghost, picked under the
   * graph (Heart & blood's "Where blood goes": Gut | Muscles; ui-ux §7). Alone, both lines show.
   */
  oneWithKept?: boolean
}

/** Which of a slot's lines shows, when they show one at a time (GraphSlotDef.oneWithKept), and how to pick another. */
export interface SlotPick {
  at: number
  set: (index: number) => void
}

/** The text key of a slot's tab (and its table's title): `stage.strips.<id>`, or the pack's own. */
export const tabKey = (slot: GraphSlotDef): string => slot.tab ?? `stage.strips.${slot.id}`

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
  /** A rhythm system's chip over the body ("≋ 15 a minute · typical adult, resting · shown at its true speed"; ui-ux §4). */
  chip?: ComponentType<{ run: RunResult }>
  /**
   * Lines under one of its graphs: what moves it, the book's value, a reference band's key (ui-ux §6,
   * R10, R29, R57), and "Count yours" beside the book line (X-2; it names the run's own value).
   */
  note?: ComponentType<{ slot: GraphSlotDef; pick?: SlotPick; run: RunResult }>
  /** A Drawing-only row's card (R11), shown in the graph column's place: lymph's germ defence. */
  card?: ComponentType
  /**
   * A one-signal graph's second line that is not a signal of the run, the same for every meal (U-4:
   * urine on a day without this meal, ui-ux §7). The same object for the same run, so the graph is drawn once.
   */
  background?: (slot: GraphSlotDef, run: RunResult) => Series | null
}

/**
 * A system's ready lesson (ui-ux §8.1, content-i18n §6): a plan, a kept plan, a graph and a time, with
 * its release (R18). Each is a data file in its system's folder (`systems/<id>/lesson.ts`) that only
 * Teach reads (lib/lessons.ts, X-1), never its pack: Teach lists a lesson without loading the pack,
 * and a module both imported would be split out of the pack's chunk.
 */
export interface SystemLesson {
  key: string
  release: 'v3.0' | 'v3.1'
  layer: SystemId
  slot: SlotId
  meal: MealItem[]
  activity: ActivityBout[]
  kept: MealItem[]
  keptActivity: ActivityBout[]
  /** Minutes on the meal clock the lesson opens at (paused). */
  t: number
  /** Its title and question (`teach.lessons.<key>`, `teach.lessonQuestions.<key>`: Teach's own text). */
  title: string
  question: string
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
  /**
   * Its 3D layer (v3.1+, optional per system: R43): a lazy chunk of ≤ 20 KB gz (three/layers/<id>.ts),
   * mounted by the 3D body in place of the last one (three/mount.ts). Without one the system is drawn
   * flat on every device. Digestion's is in the 3D body's own chunk, so its row has none.
   */
  layer3d?: Loader<Layer3d>
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

/**
 * The human's systems, in picker order. Only built systems are here: the others are SystemIds with no
 * row yet. A pack's system is a row here from the first paint (its name, framing and release flag:
 * the title and the picker need them); its graphs, rhythms and limits arrive with its pack
 * (systems/load.ts), so the first download carries none of its signal IDs (check-budget's guard).
 */
export const SYSTEMS: readonly SystemDef[] = [DIGESTION, BREATHING, CIRCULATION, KIDNEYS, LYMPH, HORMONES, MUSCLES, BONES, SKIN]

export const systemOf = (id: string | undefined): SystemDef | undefined => SYSTEMS.find((s) => s.id === id)

/** The system a bare page and a link without `layer` (and without activity) open. */
export const DEFAULT_SYSTEM: SystemId = 'digestion'

const isPublic = (id: SystemId) => !!systemOf(id)?.public

/**
 * The system a link with no `layer` opens: Heart & blood when it carries activity (R39), once that
 * row is public, or already in a preview session (`?preview=1`, where hidden built rows open); until
 * then Digestion. So linkQuery writes `layer` whenever a run has bouts (R93): a link made today keeps
 * opening what it showed once this default changes.
 */
export const defaultSystemFor = (activity: readonly ActivityBout[], preview = false): SystemId =>
  activity.length && (isPublic('circulation') || (preview && !!systemOf('circulation'))) ? 'circulation' : DEFAULT_SYSTEM

/**
 * The system a link opens (architecture §5.2): what it asks for if that row is public, or is built
 * and the link has `?preview=1`; otherwise the default (with the "link changed" note, state/run.ts).
 */
export function systemForLink(asked: string | undefined, activity: readonly ActivityBout[], preview: boolean): SystemId {
  const s = systemOf(asked)
  return s && (s.public || preview) ? s.id : defaultSystemFor(activity, preview)
}

/** One catalog row as a pack registers it (a pack's moments too: Heart & blood's gut-flow peak). */
export type CatalogRow = SignalMeta | EventMeta<RunEventId>

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

/**
 * The rows the picker offers: the public ones, and in a preview session (`?preview=1`) the built
 * hidden ones too, so a preview can switch between them (architecture §5.2; never linked by the app).
 */
export const pickerSystems = (preview: boolean): SystemDef[] => SYSTEMS.filter((s) => s.public || preview)

/** The picker's row before (−1) or after (+1) the lit one, round the list (`‹ ›`, keys [ and ]; ui-ux §3.2). */
export function stepSystem(lit: SystemId, preview: boolean, dir: 1 | -1): SystemId {
  const rows = pickerSystems(preview)
  const i = rows.findIndex((s) => s.id === lit)
  return rows[(i + dir + rows.length) % rows.length]!.id
}
