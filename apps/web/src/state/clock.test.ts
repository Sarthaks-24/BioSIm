import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_GAP_SEC, startMealClock, useClock, type FrameSource } from './clock.ts'
import { DEFAULT_PACE, HORIZON_MIN, KNEE_MIN, posToTime, timeToPos, windowEnd } from '../lib/time.ts'

const initial = useClock.getState()
/** The page's `document` (only what the clock reads): shown, until a test hides it. */
let page: EventTarget & { hidden: boolean }
beforeEach(() => {
  useClock.setState(initial, true)
  page = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', page)
})
afterEach(() => vi.unstubAllGlobals())

const clock = () => useClock.getState()

/** Hides or shows the page, as the browser does (visibilitychange). */
function setHidden(hidden: boolean) {
  page.hidden = hidden
  page.dispatchEvent(new Event('visibilitychange'))
}

/** A hand-cranked requestAnimationFrame: frames run only when the test calls `frame(ms)`. */
function fakeFrames() {
  let next = 1
  const pending = new Map<number, (now: number) => void>()
  let requested = 0
  const source: FrameSource = {
    request: (cb) => {
      requested++
      pending.set(next, cb)
      return next++
    },
    cancel: (id) => void pending.delete(id),
  }
  let now = 0
  return {
    source,
    /** Runs the frames waiting now, `ms` after the previous one. */
    frame(ms = 1000 / 30) {
      now += ms
      const due = [...pending.values()]
      pending.clear()
      for (const cb of due) cb(now)
    },
    get waiting() {
      return pending.size
    },
    get requested() {
      return requested
    },
  }
}

describe('meal clock: moving it by hand', () => {
  it('starts paused at 0 and never plays by itself', () => {
    expect(clock().simMin).toBe(0)
    expect(clock().playing).toBe(false)
    expect(clock().pace).toBe(DEFAULT_PACE)
  })

  it('clamps setSimMin to the bar', () => {
    clock().setSimMin(-30)
    expect(clock().simMin).toBe(0)
    clock().setSimMin(HORIZON_MIN + 500)
    expect(clock().simMin).toBe(HORIZON_MIN)
    clock().setSimMin(Number.NaN)
    expect(clock().simMin).toBe(0)
  })

  it('steps by ± minutes, clamped, and pauses', () => {
    clock().play()
    clock().step(10)
    expect(clock().simMin).toBe(10)
    expect(clock().playing).toBe(false)
    clock().step(-60)
    expect(clock().simMin).toBe(0)
    clock().setSimMin(HORIZON_MIN - 5)
    clock().step(60)
    expect(clock().simMin).toBe(HORIZON_MIN)
  })

  it('steps to the next and previous key moment', () => {
    clock().setMoments([240, null, 35, 1500, 35, undefined, HORIZON_MIN + 100])
    expect(clock().moments).toEqual([35, 240, 1500, HORIZON_MIN])

    clock().stepToMoment(1)
    expect(clock().simMin).toBe(35)
    clock().stepToMoment(1)
    expect(clock().simMin).toBe(240)
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(35)
    // Before the first moment, "previous" goes back to the start.
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(0)

    // Between two moments.
    clock().setSimMin(1000)
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(240)

    // Past the last one, "next" stays put.
    clock().setSimMin(HORIZON_MIN)
    clock().stepToMoment(1)
    expect(clock().simMin).toBe(HORIZON_MIN)
  })

  it('stepping to a moment pauses', () => {
    clock().setMoments([60])
    clock().play()
    clock().stepToMoment(1)
    expect(clock()).toMatchObject({ simMin: 60, playing: false })
  })

  it('with no moments, next stays and previous goes to 0', () => {
    clock().setSimMin(100)
    clock().stepToMoment(1)
    expect(clock().simMin).toBe(100)
    clock().stepToMoment(-1)
    expect(clock().simMin).toBe(0)
  })
})

describe('meal clock: play and pause', () => {
  it('toggle plays and pauses', () => {
    clock().toggle()
    expect(clock().playing).toBe(true)
    clock().toggle()
    expect(clock().playing).toBe(false)
  })

  it('play at 48 h restarts from 0', () => {
    clock().setSimMin(HORIZON_MIN)
    clock().play()
    expect(clock()).toMatchObject({ simMin: 0, playing: true })
    // Play elsewhere keeps the time.
    clock().pause()
    clock().setSimMin(300)
    clock().toggle()
    expect(clock()).toMatchObject({ simMin: 300, playing: true })
  })

  it('advances at a steady speed along the bar (same knee as v1)', () => {
    useClock.setState({ pace: 60 })
    clock().play()
    // 0.1 s of 60 s for the whole bar = 1/600 of the bar.
    clock().advance(0.1)
    expect(timeToPos(clock().simMin)).toBeCloseTo(1 / 600, 9)
    // The first 6 hours are 60 % of the bar, so 36 s of play.
    clock().setSimMin(0)
    for (let i = 0; i < 360; i++) clock().advance(0.1)
    expect(clock().simMin).toBeCloseTo(KNEE_MIN, 6)
  })

  it('a slow frame counts in full; a gap over MAX_GAP_SEC (the laptop slept) not at all', () => {
    clock().play()
    // A 2 GB phone drawing 1–2 frames a second plays at full pace (B18).
    clock().advance(2)
    expect(timeToPos(clock().simMin)).toBeCloseTo(2 / DEFAULT_PACE, 9)
    const at = clock().simMin
    clock().advance(MAX_GAP_SEC + 0.01)
    clock().advance(30)
    clock().advance(-1)
    clock().advance(Number.NaN)
    expect(clock().simMin).toBe(at)
  })

  it('does not advance while paused', () => {
    clock().setSimMin(50)
    clock().advance(0.1)
    expect(clock().simMin).toBe(50)
  })

  it('stops at the end of the bar', () => {
    clock().setSimMin(HORIZON_MIN - 1)
    clock().play()
    for (let i = 0; i < 10; i++) clock().advance(0.1)
    expect(clock()).toMatchObject({ simMin: HORIZON_MIN, playing: false })
  })
})

describe('meal clock: a system’s shorter graph window (ui-ux §4, Kidneys & water 0–12 h)', () => {
  afterEach(() => clock().setWindow(HORIZON_MIN))

  it('the bar ends at the window: the first 6 h keep 60 %, the tail is 6–12 h; the clock stays inside it', () => {
    clock().setSimMin(1000)
    clock().setWindow(720)
    expect(windowEnd()).toBe(720)
    expect(clock().windowMin).toBe(720)
    expect(clock().simMin).toBe(720)
    expect(timeToPos(KNEE_MIN)).toBeCloseTo(0.6, 10)
    expect(timeToPos(720)).toBe(1)
    expect(timeToPos(2000)).toBe(1)
    expect(posToTime(0.8)).toBeCloseTo(540, 10)
    clock().setSimMin(HORIZON_MIN)
    expect(clock().simMin).toBe(720)
  })

  it('playing stops at the window’s end, and Play there starts over', () => {
    clock().setWindow(720)
    clock().setSimMin(715)
    clock().play()
    for (let i = 0; i < 10; i++) clock().advance(0.1)
    expect(clock()).toMatchObject({ simMin: 720, playing: false })
    clock().play()
    expect(clock().simMin).toBe(0)
  })

  it('“48 h ›” widens it to the whole bar, and back to the window', () => {
    clock().setWindow(720)
    clock().setWindow(HORIZON_MIN)
    expect(windowEnd()).toBe(HORIZON_MIN)
    clock().setSimMin(2000)
    expect(clock().simMin).toBe(2000)
    clock().setWindow(720)
    expect(clock().simMin).toBe(720)
  })
})

describe('meal clock: playback loop', () => {
  it('asks for no frames while paused', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    expect(frames.requested).toBe(0)
    clock().setSimMin(200)
    clock().step(10)
    expect(frames.requested).toBe(0)
    stop()
  })

  it('moves only after Play, one frame at a time, and stops asking for frames on pause', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().play()
    expect(frames.waiting).toBe(1)
    // The first frame only notes the start time: pressing Play never jumps.
    frames.frame()
    expect(clock().simMin).toBe(0)
    for (let i = 0; i < 30; i++) frames.frame(1000 / 30)
    // About 1 s of a 60 s bar.
    expect(timeToPos(clock().simMin)).toBeCloseTo(1 / 60, 6)

    clock().pause()
    expect(frames.waiting).toBe(0)
    const at = clock().simMin
    const before = frames.requested
    for (let i = 0; i < 10; i++) frames.frame()
    expect(frames.requested).toBe(before)
    expect(clock().simMin).toBe(at)
    stop()
  })

  it('keeps real pace with slow frames: 250 ms frames for 3 s move the bar 3 / pace (±1 %)', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().play()
    frames.frame()
    for (let i = 0; i < 12; i++) frames.frame(250)
    const moved = timeToPos(clock().simMin)
    expect(Math.abs(moved / (3 / DEFAULT_PACE) - 1)).toBeLessThan(0.01)
    stop()
  })

  it('a hidden page asks for no frames and does not move; shown again it goes on without a jump', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().play()
    frames.frame()
    for (let i = 0; i < 10; i++) frames.frame(100)
    const at = clock().simMin
    expect(at).toBeGreaterThan(0)

    setHidden(true)
    expect(frames.waiting).toBe(0)
    // 10 s hidden: nothing asked for, nothing moved, still playing.
    for (let i = 0; i < 100; i++) frames.frame(100)
    expect(clock()).toMatchObject({ simMin: at, playing: true })

    setHidden(false)
    expect(frames.waiting).toBe(1)
    // The first frame back only notes the time (the 10 s are not played).
    frames.frame(10_000)
    expect(clock().simMin).toBe(at)
    frames.frame(100)
    expect(timeToPos(clock().simMin)).toBeCloseTo(timeToPos(at) + 0.1 / DEFAULT_PACE, 9)
    stop()
  })

  it('Play on a hidden page waits for it to be shown', () => {
    const frames = fakeFrames()
    setHidden(true)
    const stop = startMealClock(frames.source)
    clock().play()
    expect(frames.waiting).toBe(0)
    setHidden(false)
    expect(frames.waiting).toBe(1)
    // Paused while hidden: shown again, still no frames.
    clock().pause()
    setHidden(true)
    setHidden(false)
    expect(frames.waiting).toBe(0)
    stop()
  })

  it('stops asking for frames when it reaches the end', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().setSimMin(HORIZON_MIN - 1)
    clock().play()
    for (let i = 0; i < 20; i++) frames.frame(100)
    expect(clock()).toMatchObject({ simMin: HORIZON_MIN, playing: false })
    expect(frames.waiting).toBe(0)
    stop()
  })

  it('the stop function ends the loop and the subscription', () => {
    const frames = fakeFrames()
    const stop = startMealClock(frames.source)
    clock().play()
    stop()
    expect(frames.waiting).toBe(0)
    clock().pause()
    clock().play()
    expect(frames.waiting).toBe(0)
  })

  it('per-frame readers subscribe to simMin without a React render', () => {
    const seen: number[] = []
    const unsubscribe = useClock.subscribe(
      (s) => s.simMin,
      (min) => seen.push(min),
    )
    clock().setSimMin(5)
    clock().setSimMin(5)
    clock().pause()
    clock().setSimMin(6)
    unsubscribe()
    expect(seen).toEqual([5, 6])
  })
})
