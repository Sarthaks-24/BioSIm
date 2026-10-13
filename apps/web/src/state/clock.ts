import { useEffect } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { DEFAULT_PACE, HORIZON_MIN, posToTime, timeToPos, type Pace } from '../lib/time.ts'

/**
 * The meal clock (v2, roadmap A4a): simulated minutes since the first bite, for the whole page.
 * Graphs and the 3D body read it per frame with `useClock.getState().simMin` or
 * `useClock.subscribe((s) => s.simMin, draw)`, so playing does not re-render React components.
 * Text that shows "now" selects only what it shows, so it re-renders only when that changes.
 *
 * It never starts by itself: only `play()` / `toggle()` (the user pressing Play) start it, so a
 * page opened with reduced motion stays still.
 */
export interface ClockState {
  /** Sim minutes, 0 … HORIZON_MIN. */
  simMin: number
  playing: boolean
  /** Seconds to play the whole bar. */
  pace: Pace
  /** Key-moment times (sorted, unique) for stepToMoment; set by the page from the run's moments. */
  moments: readonly number[]

  /** Moves the clock (clamped). Does not pause: scrubbing code pauses first if it wants to. */
  setSimMin: (min: number) => void
  /** Starts playing; at the end of the bar it starts over from 0. */
  play: () => void
  pause: () => void
  toggle: () => void
  setPace: (pace: Pace) => void
  /** Pauses and moves by ±minutes (keyboard ← →), clamped to the bar. */
  step: (deltaMin: number) => void
  /** Pauses and jumps to the next (+1) or previous (−1) key moment; before the first one, to 0. */
  stepToMoment: (dir: 1 | -1) => void
  /** The moments stepToMoment visits, in sim minutes. Moments that don't happen (null) are skipped. */
  setMoments: (atMin: readonly (number | null | undefined)[]) => void
  /** One playback step of `dtSec` real seconds along the bar (called by the playback loop). */
  advance: (dtSec: number) => void
}

export const clampSimMin = (min: number) => (Number.isFinite(min) ? Math.min(Math.max(min, 0), HORIZON_MIN) : 0)

/** Moments closer than this to "now" count as "here", so stepping never lands on the same one twice. */
const SAME_MOMENT_MIN = 0.5
/**
 * A gap between two frames longer than this (seconds) is not playing time: the laptop slept, or
 * the tab was hidden without saying so. It moves the clock not at all. Anything shorter counts in
 * full, so a cheap phone drawing 1–2 frames a second still plays at the pace the Teach page
 * promises (B18: a 0.1 s cap per frame made a 4 fps phone run at 40 %). A tab that says it is
 * hidden (`visibilitychange`) stops the loop instead (startMealClock).
 */
export const MAX_GAP_SEC = 5

export const useClock = create<ClockState>()(
  subscribeWithSelector((set, get) => ({
    simMin: 0,
    playing: false,
    pace: DEFAULT_PACE,
    moments: [],

    setSimMin: (min) => set({ simMin: clampSimMin(min) }),
    play: () => {
      if (get().playing) return
      // Pressing Play at the end starts over.
      set({ playing: true, simMin: get().simMin >= HORIZON_MIN ? 0 : get().simMin })
    },
    pause: () => set({ playing: false }),
    toggle: () => (get().playing ? get().pause() : get().play()),
    setPace: (pace) => set({ pace }),
    step: (deltaMin) => set({ playing: false, simMin: clampSimMin(get().simMin + deltaMin) }),
    stepToMoment: (dir) => {
      const { simMin, moments } = get()
      // Forward: the first moment after now (none left: stay). Back: the last one before now, else 0.
      // (A filter instead of findLast, which older school browsers lack.)
      const target =
        dir > 0 ? moments.find((m) => m > simMin + SAME_MOMENT_MIN) : (moments.filter((m) => m < simMin - SAME_MOMENT_MIN).pop() ?? 0)
      set({ playing: false, simMin: target ?? simMin })
    },
    setMoments: (atMin) => {
      const times = atMin.filter((m): m is number => typeof m === 'number' && Number.isFinite(m)).map(clampSimMin)
      set({ moments: [...new Set(times)].sort((x, y) => x - y) })
    },
    advance: (dtSec) => {
      const { simMin, pace, playing } = get()
      if (!playing) return
      // Real elapsed time (a gap over MAX_GAP_SEC: none). Steady speed along the BAR (lib/time.ts),
      // so the busy first 6 hours get 60 % of the playing time.
      const dt = dtSec > MAX_GAP_SEC || !(dtSec > 0) ? 0 : dtSec
      const next = posToTime(timeToPos(simMin) + dt / pace)
      if (next >= HORIZON_MIN) set({ simMin: HORIZON_MIN, playing: false })
      else set({ simMin: next })
    },
  })),
)

export interface FrameSource {
  request: (cb: (now: number) => void) => number
  cancel: (id: number) => void
}

/** Whether the page is hidden (another tab, a minimised window), and a way to hear when that changes. */
export interface VisibilitySource {
  hidden: () => boolean
  /** Calls `cb` when the page is hidden or shown again; returns a function that stops listening. */
  watch: (cb: () => void) => () => void
}

const browserFrames: FrameSource = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
}

// (No document outside a browser, as in the unit tests: always shown.)
const browserVisibility: VisibilitySource = {
  hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  watch: (cb) => {
    if (typeof document === 'undefined') return () => undefined
    document.addEventListener('visibilitychange', cb)
    return () => document.removeEventListener('visibilitychange', cb)
  },
}

/**
 * The playback loop: one requestAnimationFrame chain that runs only while `playing` is true and
 * the page is shown, and asks for no frames at all while paused. Each frame advances the clock by
 * the real time since the one before (B18). A hidden page stops the loop and keeps `playing`:
 * shown again, it goes on from where it was, without a jump. Returns a function that stops it.
 * Outside React so it can be tested with fake frames and visibility.
 */
export function startMealClock(frames: FrameSource = browserFrames, page: VisibilitySource = browserVisibility): () => void {
  let id: number | null = null
  let last = 0

  const tick = (now: number) => {
    const dt = (now - last) / 1000
    last = now
    useClock.getState().advance(dt)
    id = useClock.getState().playing ? frames.request(tick) : null
  }
  const start = () => {
    if (id !== null || page.hidden()) return
    // The first frame only sets the start time (advances 0), so Play never jumps.
    id = frames.request((now) => {
      last = now
      tick(now)
    })
  }
  const stop = () => {
    if (id === null) return
    frames.cancel(id)
    id = null
  }

  if (useClock.getState().playing) start()
  const unsubscribe = useClock.subscribe(
    (s) => s.playing,
    (playing) => (playing ? start() : stop()),
  )
  const unwatch = page.watch(() => (page.hidden() || !useClock.getState().playing ? stop() : start()))
  return () => {
    unsubscribe()
    unwatch()
    stop()
  }
}

/**
 * Runs the meal clock's playback loop while the calling component is mounted (one per page).
 * It selects nothing from the store, so the component never re-renders because the clock moved.
 */
export function useMealClock() {
  useEffect(() => startMealClock(), [])
}
