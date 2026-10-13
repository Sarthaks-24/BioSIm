import { createContext, useContext } from 'react'
import { useClock, useSimMinute } from '../state/clock.ts'

/**
 * Which clock a body picture follows. The flat and 3D bodies are shared by v1 `/sim` (its own
 * store, state/sim.ts) and the v2 stage at `/sim` (the meal clock, state/clock.ts), so they read
 * time through this small interface instead of importing a store. The meal clock is the default;
 * v1 wraps its bodies in `<BodyClockContext value={V1_BODY_CLOCK}>` (state/sim.ts), so the stage
 * never downloads v1's store (size budget, FIX-D). WP-20 deletes the v1 entry.
 */
export interface BodyClock {
  /** Sim minutes now, read per frame without re-rendering. */
  now: () => number
  /** Calls `onChange` whenever the time moves; returns the unsubscribe function. */
  subscribe: (onChange: () => void) => () => void
  /** Hook: the current sim minute, rounded (re-renders at most once per sim minute). */
  useMinute: () => number
}

/** The v2 stage: the meal clock. */
export const MEAL_BODY_CLOCK: BodyClock = {
  now: () => useClock.getState().simMin,
  subscribe: (onChange) => useClock.subscribe((s) => s.simMin, onChange),
  useMinute: useSimMinute,
}

export const BodyClockContext = createContext<BodyClock>(MEAL_BODY_CLOCK)

/** The clock the surrounding page gave its body (the meal clock if none). */
export const useBodyClock = () => useContext(BodyClockContext)
