import { create } from 'zustand'
import {
  DEFAULT_ORGANISM,
  DEFAULT_PROFILE,
  MAX_ITEMS,
  PARAMS,
  clampServings,
  decodeShareState,
  encodeShareState,
  mealKcal,
  sortBouts,
  type ActivityBout,
  type LinkChange,
  type MealItem,
  type ProfileId,
  type ShareLang,
} from '@lifepeek/engine'
import { lookupFood } from '../data/foods.ts'
import { DEFAULT_SYSTEM, systemForLink, systemOf, type SystemId } from '../systems/registry.ts'
import { loadPack } from '../systems/load.ts'
import { DEFAULT_PRESET } from '../lib/presets.ts'
import { useClock } from './clock.ts'
import { useStripTab } from './stripTab.ts'

/**
 * The v2 run state (ROADMAP A6 + UI-3): one meal, and optionally a kept run to compare it with
 * (drawn as a dashed ghost line, never a second body). Both hold INPUTS, never result arrays:
 * `hooks/useRun.ts` recomputes each run from them, so a kept run is a few bytes and always
 * matches the current model.
 *
 * Links keep v1's letters (ARCHITECTURE.md: only ever add optional parameters):
 *   a = the meal, b = the kept run. `?v=2&a=cola:1&b=cheeseburger:1,fries:1` opens as
 *   "cola, with cheeseburger + fries kept", so every old A/B link is still a comparison.
 * Time lives in the meal clock (state/clock.ts); `loadLink` sets it from the link's `t`.
 */

/** A kept run: what to recompute, not what came out. Its activity plan is kept with it (E-3b-eng; link `bact`). */
export interface KeptRun {
  items: MealItem[]
  profile: ProfileId
  activity: ActivityBout[]
}

export interface RunState {
  meal: MealItem[]
  /** The activity bouts with the meal, in start order (link `act`); empty = resting. */
  activity: ActivityBout[]
  kept: KeptRun | null
  /** The stated person for the meal (URL `who`). */
  profile: ProfileId
  /** The one body-system layer that is lit (URL `layer`). */
  layer: SystemId
  /** The opened link had `?preview=1`: a hidden system may be lit (architecture §5.2). Kept in the written link. */
  preview: boolean
  /**
   * A system asked for whose pack is still loading, or failed to load (R71): the lit one stays drawn
   * meanwhile, and the title says "Getting the lungs ready…", or that it could not, with Try again.
   */
  switching: { to: SystemId; failed: boolean } | null
  /** Model version the open link was made with (to warn about old links); null = not opened from a link. */
  linkModelVersion: number | null
  /** The `o` of a link made by a newer LifePeek for an organism this version lacks; the run opened as human. */
  unknownOrganism: string | null
  /** Foods in the opened link that no longer exist (dropped, and counted for a notice). */
  droppedFoods: number
  /** The rest of what the opened link asked for that is shown differently or left out (B21; components/stage/LinkNotes.tsx). */
  changes: LinkChange[]
  /** Set when the user tried to make the meal bigger than the cap allows. */
  capBlocked: boolean
  /** The opened link asked for Hindi, which this build doesn't have (R47): it opened in English, with a note. */
  hindiLater: boolean

  /** Returns false if the food is already there, the meal is full, or it would go over the cap. */
  addFood: (foodId: string) => boolean
  /** Returns false if growing the meal would go over the cap (shrinking is always allowed). */
  setServings: (foodId: string, servings: number) => boolean
  removeFood: (foodId: string) => void
  /** The activity plan as a whole (the sheet and the chips' ✕ change it; links are read by loadLink). Kept in start order. */
  setActivity: (bouts: readonly ActivityBout[]) => void
  /** Copies the current meal and bouts into `kept` (they stay as they are). An empty plan is not kept. */
  keep: () => void
  unkeep: () => void
  setLayer: (layer: SystemId) => void
  /** Opens a link's query string (meal, kept run, person, layer, and time on the meal clock). Returns its language. */
  loadLink: (search: string) => ShareLang | undefined
  /** A bare page (no link): keeps the open meal, or opens the default meal if nothing is open. */
  openDefault: () => void
}

export const DEFAULT_LAYER: SystemId = DEFAULT_SYSTEM
export const DEFAULT_RUN_PROFILE: ProfileId = DEFAULT_PROFILE[DEFAULT_ORGANISM]
/** What a bare `/sim` opens: the first preset's meal (cola), nothing kept, so Play works at once. */
export const DEFAULT_MEAL: readonly MealItem[] = DEFAULT_PRESET.meal

/** The system last asked for: a slower pack that arrives after a newer choice does not light its system. */
let wanted: SystemId = DEFAULT_LAYER
/** Loads the pack of a system (systems/load.ts); null when it is ready, or the system has no row yet. */
const packFor = (layer: SystemId) => {
  const s = systemOf(layer)
  return s ? loadPack(s.pack) : null
}

const fitsCap = (items: MealItem[]) => mealKcal(items, lookupFood) <= PARAMS.maxMealKcal
/** A kept run with no food and no activity is no kept run. */
const keptOf = (items: MealItem[], profile: ProfileId, activity: ActivityBout[] = []): KeptRun | null =>
  items.length || activity.length ? { items, profile, activity } : null

/** Everything a fresh page starts with (also used by tests to reset the store). */
export const INITIAL_RUN = {
  meal: [] as MealItem[],
  activity: [] as ActivityBout[],
  kept: null as KeptRun | null,
  profile: DEFAULT_RUN_PROFILE,
  layer: DEFAULT_LAYER,
  preview: false,
  switching: null as RunState['switching'],
  linkModelVersion: null as number | null,
  unknownOrganism: null as string | null,
  droppedFoods: 0,
  changes: [] as LinkChange[],
  capBlocked: false,
  hindiLater: false,
} satisfies Partial<RunState>

export const useRunStore = create<RunState>((set, get) => ({
  ...INITIAL_RUN,

  // The cap rules are v1's (its two meals' addFood / setServings), for one meal.
  addFood: (foodId) => {
    const items = get().meal
    if (items.some((i) => i.foodId === foodId) || items.length >= MAX_ITEMS) return false
    const next = [...items, { foodId, servings: 1 }]
    if (!fitsCap(next)) {
      set({ capBlocked: true })
      return false
    }
    set({ meal: next, capBlocked: false })
    return true
  },
  setServings: (foodId, servings) => {
    const current = get().meal
    const next = current.map((i) => (i.foodId === foodId ? { ...i, servings: clampServings(servings) } : i))
    // Making a meal smaller is always allowed, even if it is still over the cap (e.g. from an old link).
    const shrinking = mealKcal(next, lookupFood) <= mealKcal(current, lookupFood)
    if (!shrinking && !fitsCap(next)) {
      set({ capBlocked: true })
      return false
    }
    set({ meal: next, capBlocked: false })
    return true
  },
  removeFood: (foodId) => set({ meal: get().meal.filter((i) => i.foodId !== foodId), capBlocked: false }),
  setActivity: (bouts) => set({ activity: sortBouts(bouts) }),

  keep: () => {
    const { meal, profile, activity } = get()
    if (meal.length || activity.length) set({ kept: keptOf(meal, profile, activity) })
  },
  unkeep: () => set({ kept: null }),
  // A new system starts on its first graph (architecture §5.2). Its pack (rows, UI, words: I-1)
  // loads first, and the lit system stays drawn meanwhile (R71: never clear the screen; a failed
  // load keeps it too, and the title says so and offers Try again: components/SystemTitle.tsx).
  setLayer: (layer) => {
    wanted = layer
    const light = () => {
      if (wanted !== layer) return
      if (layer !== get().layer) useStripTab.setState({ tab: null })
      set({ layer, switching: null })
    }
    const loading = packFor(layer)
    if (!loading) return light()
    set({ switching: { to: layer, failed: false } })
    loading.then(light, () => wanted === layer && set({ switching: { to: layer, failed: true } }))
  },

  loadLink: (search) => {
    const params = new URLSearchParams(search)
    const s = decodeShareState(params)
    // Foods that no longer exist are dropped (and counted for a notice), so they can't linger
    // invisibly in the run or be written back into the link.
    const known = (items: MealItem[]) => items.filter((i) => lookupFood(i.foodId))
    const meal = known(s.a)
    const keptItems = known(s.b)
    // One `who` per link: the kept run is about the same person.
    const profile = s.who ?? DEFAULT_RUN_PROFILE
    const activity = s.act ?? []
    // A system this version doesn't have, or has but not yet public (unless `?preview=1`), opens
    // the default system, and the link's notes say so (architecture §5.2; the codec checks only its shape).
    const preview = params.get('preview') === '1'
    const layer = systemForLink(s.layer, activity, preview)
    let changes = [...(s.changes ?? []), ...(s.layer && s.layer !== layer ? [{ param: 'layer', asked: s.layer, shown: layer }] : [])]
    // The e2e build's `lang=pseudo` (i18n/pseudo.ts) is no change. Not in a real build.
    if (import.meta.env.VITE_PSEUDO === '1') changes = changes.filter((c) => c.asked !== 'pseudo')
    set({
      meal,
      // The bouts the codec could not show are in `changes` (R21).
      activity,
      kept: keptOf(keptItems, profile, s.bact ?? []),
      profile,
      // A system whose pack has not loaded yet is lit once it has (setLayer); the lit one meanwhile.
      layer: packFor(layer) ? get().layer : layer,
      preview,
      linkModelVersion: params.has('v') ? s.modelVersion : null,
      unknownOrganism: s.unknownOrganism ?? null,
      droppedFoods: s.a.length + s.b.length - meal.length - keptItems.length,
      changes,
      capBlocked: false,
    })
    get().setLayer(layer)
    // A link opens paused at its time (never auto-plays).
    useClock.getState().pause()
    useClock.getState().setSimMin(s.t)
    return s.lang
  },
  openDefault: () => {
    const { meal, kept } = get()
    if (meal.length || kept) return
    set({ ...INITIAL_RUN, meal: [...DEFAULT_MEAL] })
    useClock.getState().pause()
    useClock.getState().setSimMin(0)
  },
}))

/**
 * The query string that reopens exactly this run: v, a (meal), b (kept), t, then `who` when it is
 * not the default, `layer` when it is not Digestion or the run has bouts (a link with bouts and no
 * `layer` would open Heart & blood once that row is public, R39), then lang, then `act` / `bact` when there are bouts
 * (and `preview=1` in a preview session). A one-profile kept run can't carry its
 * own `who` yet (the kept run's person is the link's person; `bo` and friends are reserved).
 */
export function linkQuery(
  run: Pick<RunState, 'meal' | 'kept' | 'profile' | 'layer' | 'activity'> & { preview?: boolean; switching?: RunState['switching'] },
  simMin: number,
  lang?: string,
): string {
  const wanted = run.switching?.to ?? run.layer
  const query = encodeShareState({
    a: run.meal,
    b: run.kept?.items ?? [],
    t: simMin,
    ...(run.profile !== DEFAULT_RUN_PROFILE ? { who: run.profile } : {}),
    // The system asked for, while its pack loads or after it failed to (a reload asks for it again);
    // with bouts always, as the system such a link opens by default will change (R39, R93 #5).
    ...(wanted !== DEFAULT_SYSTEM || run.activity.length || run.kept?.activity.length ? { layer: wanted } : {}),
    ...(lang === 'en' || lang === 'hi' ? { lang } : {}),
    act: run.activity,
    bact: run.kept?.activity ?? [],
  })
  // A preview session stays one when the page is reloaded; the app never links to it otherwise.
  if (run.preview) query.set('preview', '1')
  return query.toString()
}
