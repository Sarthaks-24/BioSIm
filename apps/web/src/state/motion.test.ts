import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { REDUCE_MOTION_PREF, createMotionStore, type MotionEnv } from './motion.ts'

/** A fake browser: a prefers-reduced-motion query that can change, and an in-memory pref store. */
function fakeEnv(systemReduced: boolean, saved?: string) {
  const prefs = new Map<string, string>(saved === undefined ? [] : [[REDUCE_MOTION_PREF, saved]])
  const listeners: ((e: { matches: boolean }) => void)[] = []
  const query = { matches: systemReduced, addEventListener: (_: string, l: (e: { matches: boolean }) => void) => void listeners.push(l) }
  const env: MotionEnv = {
    matchMedia: () => query as unknown as MediaQueryList,
    readPref: (k) => prefs.get(k) ?? null,
    writePref: (k, v) => void prefs.set(k, v),
    clearPref: (k) => void prefs.delete(k),
  }
  const setSystem = (matches: boolean) => {
    query.matches = matches
    for (const l of listeners) l({ matches })
  }
  return { env, prefs, setSystem }
}

describe('reduced-motion flag', () => {
  it('follows the device setting when there is no in-app choice', () => {
    expect(createMotionStore(fakeEnv(false).env).getState()).toMatchObject({ reduced: false, choice: null })
    expect(createMotionStore(fakeEnv(true).env).getState()).toMatchObject({ reduced: true, system: true, choice: null })
  })

  it('updates live when the device setting changes', () => {
    const f = fakeEnv(false)
    const store = createMotionStore(f.env)
    f.setSystem(true)
    expect(store.getState().reduced).toBe(true)
    f.setSystem(false)
    expect(store.getState().reduced).toBe(false)
  })

  it('the in-app choice wins over the device and is saved as lifepeek:reduceMotion', () => {
    const f = fakeEnv(false)
    const store = createMotionStore(f.env)
    store.getState().setChoice(true)
    expect(store.getState().reduced).toBe(true)
    expect(f.prefs.get('reduceMotion')).toBe('1')
    // A device change doesn't override the user's choice.
    f.setSystem(false)
    expect(store.getState().reduced).toBe(true)

    store.getState().setChoice(false)
    f.setSystem(true)
    expect(store.getState()).toMatchObject({ reduced: false, system: true })
    expect(f.prefs.get('reduceMotion')).toBe('0')

    // Forgetting the choice follows the device again.
    store.getState().setChoice(null)
    expect(store.getState()).toMatchObject({ reduced: true, choice: null })
    expect(f.prefs.has('reduceMotion')).toBe(false)
  })

  it('reads a saved choice at start; junk values are ignored', () => {
    expect(createMotionStore(fakeEnv(false, '1').env).getState()).toMatchObject({ reduced: true, choice: true })
    expect(createMotionStore(fakeEnv(true, '0').env).getState()).toMatchObject({ reduced: false, choice: false })
    expect(createMotionStore(fakeEnv(true, 'yes').env).getState()).toMatchObject({ reduced: true, choice: null })
  })

  it('works without matchMedia (old browsers, tests)', () => {
    const { env } = fakeEnv(false)
    expect(createMotionStore({ ...env, matchMedia: undefined }).getState().reduced).toBe(false)
  })
})

describe('the in-app choice in CSS', () => {
  it('main.tsx reads the same saved choice, so html[data-motion] is right before the first draw', () => {
    const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
    expect(main).toContain(`readPref('${REDUCE_MOTION_PREF}')`)
  })
})
