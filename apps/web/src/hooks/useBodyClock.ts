import { createContext, useContext } from 'react'
import { useSim } from '../state/sim.ts'
import { useClock, useSimMinute } from '../state/clock.ts'

/**
 * Which clock a body picture follows. The flat and 3D bodies are shared by v1 `/sim` (its own
 * store, state/sim.ts) and the v2 stage at `/next` (the meal clock, state/clock.ts), so they read
 * time through this small interface instead of importing a store. v1 gets its store by default
 * and does not change; the stage wraps its body in `<BodyClockContext value={MEAL_BODY_CLOCK}>`.
 * WP-20 deletes the v1 entry.
 */
export interface BodyClock {
  /** Sim minutes now, read per frame without re-rendering. */
  now: () => number
  /** Calls `onChange` whenever the time moves; returns the unsubscribe function. */
  subscribe: (onChange: () => void) => () => void
  /** Hook: the current sim minute, rounded (re-renders at most once per sim minute). */
  useMinute: () => number
}

/** v1 `/sim`: the comparison store's own time. */
export const V1_BODY_CLOCK: BodyClock = {
  now: () => useSim.getState().time,
  subscribe: (onChange) => useSim.subscribe((s, prev) => s.time !== prev.time && onChange()),
  useMinute: () => useSim((s) => Math.round(s.time)),
}

/** The v2 stage: the meal clock. */
export const MEAL_BODY_CLOCK: BodyClock = {
  now: () => useClock.getState().simMin,
  subscribe: (onChange) => useClock.subscribe((s) => s.simMin, onChange),
  useMinute: useSimMinute,
}

export const BodyClockContext = createContext<BodyClock>(V1_BODY_CLOCK)

/** The clock the surrounding page gave its body (v1's store if none). */
export const useBodyClock = () => useContext(BodyClockContext)
