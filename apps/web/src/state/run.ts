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
  type LinkChange,
  type MealItem,
  type ProfileId,
  type ShareLang,
} from '@lifepeek/engine'
import { lookupFood } from '../data/foods.ts'
import { ORGANISMS } from '../registry/index.ts'
import type { SystemId } from '../registry/types.ts'
import { DEFAULT_PRESET } from '../lib/presets.ts'
import { useClock } from './clock.ts'

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

/** A kept run: what to recompute, not what came out. */
export interface KeptRun {
  items: MealItem[]
  profile: ProfileId
}

export interface RunState {
  meal: MealItem[]
  kept: KeptRun | null
  /** The stated person for the meal (URL `who`). */
  profile: ProfileId
  /** The one body-system layer that is lit (URL `layer`). */
  layer: SystemId
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
  /** Copies the current meal into `kept` (the meal stays as it is). An empty meal is not kept. */
  keep: () => void
  unkeep: () => void
  /** The kept run becomes the meal and the meal becomes the kept run. */
  swapKept: () => void
  setLayer: (layer: SystemId) => void
  /** Opens a link's query string (meal, kept run, person, layer, and time on the meal clock). Returns its language. */
  loadLink: (search: string) => ShareLang | undefined
  /** A bare page (no link): keeps the open meal, or opens the default meal if nothing is open. */
  openDefault: () => void
}

const HUMAN = ORGANISMS[DEFAULT_ORGANISM].organism
export const DEFAULT_LAYER: SystemId = HUMAN.defaultSystem
export const DEFAULT_RUN_PROFILE: ProfileId = DEFAULT_PROFILE[DEFAULT_ORGANISM]
/** What a bare `/sim` opens: the first preset's meal (cola), nothing kept, so Play works at once. */
export const DEFAULT_MEAL: readonly MealItem[] = DEFAULT_PRESET.meal

const fitsCap = (items: MealItem[]) => mealKcal(items, lookupFood) <= PARAMS.maxMealKcal
const isLayer = (id: string | undefined): id is SystemId => ORGANISMS[DEFAULT_ORGANISM].systems.some((s) => s.id === id)
/** A kept run with no food is no kept run. */
const keptOf = (items: MealItem[], profile: ProfileId): KeptRun | null => (items.length ? { items, profile } : null)

/** Everything a fresh page starts with (also used by tests to reset the store). */
export const INITIAL_RUN = {
  meal: [] as MealItem[],
  kept: null as KeptRun | null,
  profile: DEFAULT_RUN_PROFILE,
  layer: DEFAULT_LAYER,
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

  keep: () => {
    const { meal, profile } = get()
    if (meal.length) set({ kept: keptOf(meal, profile) })
  },
  unkeep: () => set({ kept: null }),
  swapKept: () => {
    const { meal, profile, kept } = get()
    if (!kept) return
    // A meal over the cap (from an old link) may come back as the meal: the cap only stops growing it.
    set({ meal: kept.items, profile: kept.profile, kept: keptOf(meal, profile), capBlocked: false })
  },
  setLayer: (layer) => set({ layer }),

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
    const layer = isLayer(s.layer) ? s.layer : DEFAULT_LAYER
    // A view this version doesn't have is a change too (the codec checks only its shape).
    let changes = [...(s.changes ?? []), ...(s.layer && s.layer !== layer ? [{ param: 'layer', asked: s.layer }] : [])]
    // The e2e build's `lang=pseudo` (i18n/pseudo.ts) is no change. Not in a real build.
    if (import.meta.env.VITE_PSEUDO === '1') changes = changes.filter((c) => c.asked !== 'pseudo')
    set({
      meal,
      kept: keptOf(keptItems, profile),
      profile,
      layer,
      linkModelVersion: params.has('v') ? s.modelVersion : null,
      unknownOrganism: s.unknownOrganism ?? null,
      droppedFoods: s.a.length + s.b.length - meal.length - keptItems.length,
      changes,
      capBlocked: false,
    })
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
 * The query string that reopens exactly this run: v, a (meal), b (kept), t, then `who` and
 * `layer` only when they are not the default, then lang. A one-profile kept run can't carry its
 * own `who` yet (the kept run's person is the link's person; `bo` and friends are reserved).
 */
export function linkQuery(run: Pick<RunState, 'meal' | 'kept' | 'profile' | 'layer'>, simMin: number, lang?: string): string {
  return encodeShareState({
    a: run.meal,
    b: run.kept?.items ?? [],
    t: simMin,
    ...(run.profile !== DEFAULT_RUN_PROFILE ? { who: run.profile } : {}),
    ...(run.layer !== DEFAULT_LAYER ? { layer: run.layer } : {}),
    ...(lang === 'en' || lang === 'hi' ? { lang } : {}),
  }).toString()
}
