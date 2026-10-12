import { create } from 'zustand'
import { MAX_ITEMS, clampServings, decodeShareState, encodeShareState, type MealItem } from '@biosim/engine'
import { HORIZON_MIN, SPEEDS, type Speed } from '../lib/time.ts'

export type MealKey = 'a' | 'b'

interface SimState {
  a: MealItem[]
  b: MealItem[]
  time: number
  playing: boolean
  speed: Speed
  /** Model version the current link was created with (to warn about old links). */
  linkModelVersion: number | null

  setTime: (t: number) => void
  nudge: (deltaMin: number) => void
  togglePlay: () => void
  pause: () => void
  restart: () => void
  setSpeed: (s: Speed) => void
  addFood: (meal: MealKey, foodId: string) => void
  setServings: (meal: MealKey, foodId: string, servings: number) => void
  removeFood: (meal: MealKey, foodId: string) => void
  loadFromUrl: (search: string) => void
}

const clampTime = (t: number) => Math.min(Math.max(t, 0), HORIZON_MIN)

export const useSim = create<SimState>((set, get) => ({
  a: [],
  b: [],
  time: 0,
  playing: false,
  speed: SPEEDS[2],
  linkModelVersion: null,

  setTime: (t) => set({ time: clampTime(t) }),
  nudge: (d) => set({ time: clampTime(get().time + d) }),
  togglePlay: () => {
    const { playing, time } = get()
    // Pressing play at the end starts over.
    set({ playing: !playing, time: !playing && time >= HORIZON_MIN ? 0 : time })
  },
  pause: () => set({ playing: false }),
  restart: () => set({ time: 0, playing: false }),
  setSpeed: (speed) => set({ speed }),

  addFood: (meal, foodId) => {
    const items = get()[meal]
    if (items.some((i) => i.foodId === foodId) || items.length >= MAX_ITEMS) return
    set({ [meal]: [...items, { foodId, servings: 1 }] } as Pick<SimState, MealKey>)
  },
  setServings: (meal, foodId, servings) =>
    set({
      [meal]: get()[meal].map((i) => (i.foodId === foodId ? { ...i, servings: clampServings(servings) } : i)),
    } as Pick<SimState, MealKey>),
  removeFood: (meal, foodId) => set({ [meal]: get()[meal].filter((i) => i.foodId !== foodId) } as Pick<SimState, MealKey>),

  loadFromUrl: (search) => {
    const params = new URLSearchParams(search)
    const s = decodeShareState(params)
    set({ a: s.a, b: s.b, time: s.t, playing: false, linkModelVersion: params.has('v') ? s.modelVersion : null })
  },
}))

/** The URL that reopens exactly this comparison. */
export function shareSearch(state: Pick<SimState, 'a' | 'b' | 'time'>): string {
  return encodeShareState({ a: state.a, b: state.b, t: state.time }).toString()
}
