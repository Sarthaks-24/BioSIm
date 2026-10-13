import { create } from 'zustand'
import type { TFunction } from 'i18next'
import {
  MAX_ITEMS,
  PARAMS,
  clampServings,
  decodeShareState,
  encodeShareState,
  mealKcal,
  type MealItem,
  type ShareLang,
  type Simulation,
} from '@lifepeek/engine'
import { HORIZON_MIN, DEFAULT_PACE, type Pace } from '../lib/time.ts'
import { lookupFood } from '../data/foods.ts'
import type { BodyClock } from '../hooks/useBodyClock.ts'

export type MealKey = 'a' | 'b'
export const MEAL_KEYS: MealKey[] = ['a', 'b']

/** The two simulations side by side. */
export type Sims = Record<MealKey, Simulation>

/** Meals that actually have food in them, in A, B order. */
export const presentMeals = (sims: Partial<Record<MealKey, Simulation>>): MealKey[] =>
  MEAL_KEYS.filter((k) => (sims[k]?.meal.items.length ?? 0) > 0)

export const mealLabel = (k: MealKey, t: TFunction) => (k === 'a' ? t('sim.mealA') : t('sim.mealB'))

interface SimState {
  a: MealItem[]
  b: MealItem[]
  time: number
  playing: boolean
  pace: Pace
  /** Model version the open link was made with (to warn about old links). */
  linkModelVersion: number | null
  /** Set when the user tried to add more than the meal cap allows. */
  capBlocked: MealKey | null
  /** Foods in the opened link that no longer exist. */
  droppedFoods: number

  setTime: (t: number) => void
  togglePlay: () => void
  pause: () => void
  restart: () => void
  setPace: (p: Pace) => void
  /** Returns false if adding would push the meal over the size cap. */
  addFood: (meal: MealKey, foodId: string) => boolean
  setServings: (meal: MealKey, foodId: string, servings: number) => boolean
  removeFood: (meal: MealKey, foodId: string) => void
  loadShareState: (search: string) => ShareLang | undefined
}

const clampTime = (t: number) => Math.min(Math.max(t, 0), HORIZON_MIN)
const fitsCap = (items: MealItem[]) => mealKcal(items, lookupFood) <= PARAMS.maxMealKcal
/** State update that replaces one meal's items. */
const withMeal = (meal: MealKey, items: MealItem[]) => (meal === 'a' ? { a: items } : { b: items })

export const useSim = create<SimState>((set, get) => ({
  a: [],
  b: [],
  time: 0,
  playing: false,
  pace: DEFAULT_PACE,
  linkModelVersion: null,
  capBlocked: null,
  droppedFoods: 0,

  setTime: (t) => set({ time: clampTime(t) }),
  togglePlay: () => {
    const { playing, time } = get()
    // Pressing play at the end starts over.
    set({ playing: !playing, time: !playing && time >= HORIZON_MIN ? 0 : time })
  },
  pause: () => set({ playing: false }),
  restart: () => set({ time: 0, playing: false }),
  setPace: (pace) => set({ pace }),

  addFood: (meal, foodId) => {
    const items = get()[meal]
    if (items.some((i) => i.foodId === foodId) || items.length >= MAX_ITEMS) return false
    const next = [...items, { foodId, servings: 1 }]
    if (!fitsCap(next)) {
      set({ capBlocked: meal })
      return false
    }
    set({ ...withMeal(meal, next), capBlocked: null })
    return true
  },
  setServings: (meal, foodId, servings) => {
    const current = get()[meal]
    const next = current.map((i) => (i.foodId === foodId ? { ...i, servings: clampServings(servings) } : i))
    // Making a meal smaller is always allowed, even if it is still over the cap (e.g. from an old link).
    const shrinking = mealKcal(next, lookupFood) <= mealKcal(current, lookupFood)
    if (!shrinking && !fitsCap(next)) {
      set({ capBlocked: meal })
      return false
    }
    set({ ...withMeal(meal, next), capBlocked: null })
    return true
  },
  removeFood: (meal, foodId) =>
    set({
      ...withMeal(
        meal,
        get()[meal].filter((i) => i.foodId !== foodId),
      ),
      capBlocked: null,
    }),

  loadShareState: (search) => {
    const params = new URLSearchParams(search)
    const s = decodeShareState(params)
    // Foods that no longer exist are dropped (and counted for a notice), so they can't linger
    // invisibly in the meal or be written back into the link.
    const known = (items: MealItem[]) => items.filter((i) => lookupFood(i.foodId))
    const a = known(s.a)
    const b = known(s.b)
    set({
      a,
      b,
      time: s.t,
      playing: false,
      linkModelVersion: params.has('v') ? s.modelVersion : null,
      droppedFoods: s.a.length + s.b.length - a.length - b.length,
      capBlocked: null,
    })
    return s.lang
  },
}))

/** The query string that reopens exactly this comparison. */
export function shareQuery(state: Pick<SimState, 'a' | 'b' | 'time'>, lang?: string): string {
  return encodeShareState({
    a: state.a,
    b: state.b,
    t: state.time,
    ...(lang === 'en' || lang === 'hi' ? { lang } : {}),
  }).toString()
}

/** The bodies on v1 `/sim` follow this store's time (hooks/useBodyClock.ts; the stage's is the default). */
export const V1_BODY_CLOCK: BodyClock = {
  now: () => useSim.getState().time,
  subscribe: (onChange) => useSim.subscribe((s, prev) => s.time !== prev.time && onChange()),
  useMinute: () => useSim((s) => Math.round(s.time)),
}
