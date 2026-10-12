import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { clearPref, readPref, writePref } from '../lib/prefs.ts'

/**
 * One reduced-motion flag for the whole app (roadmap A4a, UI-7). It follows the device setting
 * (`prefers-reduced-motion`, live), unless the user has chosen in the app: school PCs rarely
 * change the system setting. The choice is saved as `lifepeek:reduceMotion` ('1' on, '0' off).
 *
 * When `reduced` is true nothing moves on its own: the meal clock never auto-plays (it never
 * does), particles stop tumbling and loops draw one still frame (WP-16). Play still moves the
 * clock, because the user asked for it.
 */
export interface MotionState {
  /** True when motion should be reduced: the in-app choice if there is one, else the device setting. */
  reduced: boolean
  /** What the device asks for (prefers-reduced-motion). */
  system: boolean
  /** The in-app choice: true = reduce, false = full motion, null = follow the device. */
  choice: boolean | null
  /** Saves the in-app choice; null forgets it and follows the device again. */
  setChoice: (choice: boolean | null) => void
}

export const REDUCE_MOTION_PREF = 'reduceMotion'
const QUERY = '(prefers-reduced-motion: reduce)'

/** What the store needs from the browser, so tests can pass their own. */
export interface MotionEnv {
  matchMedia?: (query: string) => Pick<MediaQueryList, 'matches' | 'addEventListener'>
  readPref: (key: string) => string | null
  writePref: (key: string, value: string) => void
  clearPref: (key: string) => void
}

const parseChoice = (v: string | null): boolean | null => (v === '1' ? true : v === '0' ? false : null)

export function createMotionStore(env: MotionEnv): UseBoundStore<StoreApi<MotionState>> {
  const query = env.matchMedia?.(QUERY)
  const choice = parseChoice(env.readPref(REDUCE_MOTION_PREF))
  const system = !!query?.matches

  const store = create<MotionState>((set, get) => ({
    reduced: choice ?? system,
    system,
    choice,
    setChoice: (next) => {
      if (next === null) env.clearPref(REDUCE_MOTION_PREF)
      else env.writePref(REDUCE_MOTION_PREF, next ? '1' : '0')
      set({ choice: next, reduced: next ?? get().system })
    },
  }))
  // The device setting can change while the page is open (e.g. a battery saver turns it on).
  query?.addEventListener('change', (e) => store.setState((s) => ({ system: e.matches, reduced: s.choice ?? e.matches })))
  return store
}

const browserEnv: MotionEnv = {
  matchMedia: typeof window !== 'undefined' && window.matchMedia ? (q) => window.matchMedia(q) : undefined,
  readPref,
  writePref,
  clearPref,
}

/** `useMotion((s) => s.reduced)` in components; `useMotion.getState().reduced` per frame. */
export const useMotion = createMotionStore(browserEnv)
