import { describe, expect, it } from 'vitest'
import { actionFor, keyBelongsToTarget, type KeyInput } from './keys.ts'

const press = (key: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
})

describe('the stage’s key map', () => {
  it('moves the clock: arrows 10 min, Shift 1 h, Home / End, Page Down / Up between moments', () => {
    expect(actionFor(press('ArrowRight'), false)).toBe('forward')
    expect(actionFor(press('ArrowLeft', { shiftKey: true }), false)).toBe('backHour')
    expect(actionFor(press('Home'), false)).toBe('start')
    expect(actionFor(press('End'), false)).toBe('end')
    expect(actionFor(press('PageDown'), false)).toBe('nextMoment')
    expect(actionFor(press('PageUp'), false)).toBe('prevMoment')
  })

  it('plays with Space or K, keeps with P, opens the table with T and the list with ?', () => {
    expect(actionFor(press(' '), false)).toBe('play')
    expect(actionFor(press('k'), false)).toBe('play')
    expect(actionFor(press('K', { shiftKey: true }), false)).toBe('play')
    expect(actionFor(press('p'), false)).toBe('keep')
    expect(actionFor(press('t'), false)).toBe('table')
    expect(actionFor(press('?', { shiftKey: true }), false)).toBe('help')
  })

  it('1, 2 and 3 pick a graph by its place; S, B and E are digestion’s aliases (v3.0)', () => {
    expect(['1', '2', '3'].map((k) => actionFor(press(k), false))).toEqual(['slot1', 'slot2', 'slot3'])
    expect(['s', 'b', 'e'].map((k) => actionFor(press(k), false))).toEqual(['slotS', 'slotB', 'slotE'])
  })

  it('leaves Ctrl, Alt and Cmd combinations to the browser', () => {
    expect(actionFor(press('t', { ctrlKey: true }), false)).toBeNull()
    expect(actionFor(press('p', { metaKey: true }), false)).toBeNull()
    expect(actionFor(press('ArrowRight', { altKey: true }), false)).toBeNull()
  })

  it('the off-switch turns off every one-character shortcut, but not the clicker keys (WCAG 2.1.4)', () => {
    for (const k of [' ', 'k', 'p', 't', '1', '2', '3', 's', 'b', 'e', '?']) expect(actionFor(press(k), true), k).toBeNull()
    expect(actionFor(press('PageDown'), true)).toBe('nextMoment')
    expect(actionFor(press('ArrowRight'), true)).toBe('forward')
  })
})

describe('keys that belong to the focused control', () => {
  /** A stand-in element (unit tests run without a DOM): it and its parents match these selectors. */
  const el = (...matches: string[]) =>
    ({ closest: (sel: string) => (sel.split(', ').some((s) => matches.includes(s)) ? {} : null) }) as unknown as Element

  it('typing in a text box, a list or a dialog is never taken', () => {
    expect(keyBelongsToTarget(el('input'), 'k')).toBe(true)
    expect(keyBelongsToTarget(el('button', 'dialog'), 'ArrowRight')).toBe(true)
    expect(keyBelongsToTarget(el('[role="dialog"]'), 't')).toBe(true)
  })

  it('Space presses a focused button; arrows stay with a slider or a toolbar', () => {
    expect(keyBelongsToTarget(el('button'), ' ')).toBe(true)
    expect(keyBelongsToTarget(el('button'), 'ArrowRight')).toBe(false)
    expect(keyBelongsToTarget(el('[role="slider"]'), 'ArrowLeft')).toBe(true)
    expect(keyBelongsToTarget(el('button', '[role="toolbar"]'), 'Home')).toBe(true)
  })

  it('in a box of text that scrolls, its scrolling keys scroll it; if it all fits, they stay the stage’s', () => {
    const inBox = (scrolls: boolean) =>
      ({
        closest: (sel: string) => (sel === '[data-scroll]' ? { scrollHeight: scrolls ? 400 : 200, clientHeight: 200 } : null),
      }) as unknown as Element
    for (const key of [' ', 'PageDown', 'PageUp', 'Home', 'End']) {
      expect(keyBelongsToTarget(inBox(true), key), key).toBe(true)
      expect(keyBelongsToTarget(inBox(false), key), key).toBe(false)
    }
    // ← → still move the clock, letters are still shortcuts.
    expect(keyBelongsToTarget(inBox(true), 'ArrowRight')).toBe(false)
    expect(keyBelongsToTarget(inBox(true), 'p')).toBe(false)
  })

  it('Page Down / Up and letters on a button still reach the stage (a clicker, a shortcut)', () => {
    expect(keyBelongsToTarget(el('button', '[role="toolbar"]'), 'PageDown')).toBe(false)
    expect(keyBelongsToTarget(el('button'), 'p')).toBe(false)
    expect(keyBelongsToTarget(null, 'p')).toBe(false)
  })
})
