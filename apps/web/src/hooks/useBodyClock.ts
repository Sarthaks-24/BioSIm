import { createContext, useContext } from 'react'
import { useClock } from '../state/clock.ts'

/**
 * Which clock a body picture follows. The flat and 3D bodies read time through this small
 * interface instead of importing a store. The stage's meal clock (state/clock.ts) is the default
 * and, since WP-20 deleted v1's own clock, the only one; a page that plays a body on another
 * clock can give its own with `<BodyClockContext value={…}>`.
 */
export interface BodyClock {
  /** Sim minutes now, read per frame without re-rendering. */
  now: () => number
  /** Calls `onChange` whenever the time moves; returns the unsubscribe function. */
  subscribe: (onChange: () => void) => () => void
}

/** The stage: the meal clock. */
export const MEAL_BODY_CLOCK: BodyClock = {
  now: () => useClock.getState().simMin,
  subscribe: (onChange) => useClock.subscribe((s) => s.simMin, onChange),
}

export const BodyClockContext = createContext<BodyClock>(MEAL_BODY_CLOCK)

/** The clock the surrounding page gave its body (the meal clock if none). */
export const useBodyClock = () => useContext(BodyClockContext)
