import { create } from 'zustand'
import { readPref, writePref } from './prefs.ts'

/**
 * The stage's one key map (G8 + UI-6), for a keyboard and for a presentation clicker (which sends
 * Page Down / Page Up). pages/Simulator.tsx listens on the window and runs the action; the help sheet
 * (KeysHelp) lists the same keys.
 *
 * - ← → 10 minutes, Shift + ← → 1 hour; Home / End: start and end of the clock.
 * - Page Down / Page Up: next / previous key moment (a clicker's two buttons).
 * - Space or K: play and pause. P: keep this meal to compare. T: the graphs as a table.
 * - 1, 2, 3: show the lit system's first, second or third graph (when the graphs show one at a
 *   time), and read its values out. S, B, E: digestion's Stomach, Blood sugar and Energy, v3.0
 *   only (each slot's `letter`, systems/digestion/def.ts; architecture §0).
 * - ?: this list, with the switches.
 *
 * Keys typed into a text box, a list or a dialog are never taken, nor keys a focused control
 * uses itself (Space on a button, arrows on a slider or in a group of choices), nor the scrolling
 * keys in a box of text that scrolls (`data-scroll`). Ctrl, Alt and Cmd combinations are the
 * browser's. ↑ and ↓ are never the stage's: they scroll the page where it scrolls (a phone, or a
 * laptop zoomed in).
 *
 * B is Blood sugar, although many presentation clickers send B (or .) for "blank the screen". It
 * only picks which graph shows, never changes the meal or the clock, and pressing it again does
 * nothing more, so a teacher who meant "blank" loses nothing (the tabs, S or E pick another). A
 * screen reader hears the graph's values (pages/Simulator.tsx), so the change is never silent. "." is free.
 *
 * WCAG 2.1.4: shortcuts made of one character (letters, ?, Space) can be switched off. The choice
 * is saved on the device as `lifepeek:keysOff` ('1'). Arrows, Page Up/Down, Home and End are not
 * characters (a clicker needs them), so they stay on.
 */
export type KeyAction =
  | 'back'
  | 'forward'
  | 'backHour'
  | 'forwardHour'
  | 'start'
  | 'end'
  | 'nextMoment'
  | 'prevMoment'
  | 'play'
  | 'keep'
  | 'table'
  | 'help'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slotS'
  | 'slotB'
  | 'slotE'

const LETTERS: Record<string, KeyAction> = {
  k: 'play',
  ' ': 'play',
  p: 'keep',
  t: 'table',
  '1': 'slot1',
  '2': 'slot2',
  '3': 'slot3',
  s: 'slotS',
  b: 'slotB',
  e: 'slotE',
  '?': 'help',
}

export interface KeyInput {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}

/** The action a key press asks for, or null. */
export function actionFor(e: KeyInput, keysOff: boolean): KeyAction | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null
  switch (e.key) {
    case 'ArrowLeft':
      return e.shiftKey ? 'backHour' : 'back'
    case 'ArrowRight':
      return e.shiftKey ? 'forwardHour' : 'forward'
    case 'PageDown':
      return 'nextMoment'
    case 'PageUp':
      return 'prevMoment'
    case 'Home':
      return 'start'
    case 'End':
      return 'end'
  }
  // One-character shortcuts (WCAG 2.1.4): the off-switch turns these off.
  if (keysOff || e.key.length !== 1) return null
  return LETTERS[e.key.toLowerCase()] ?? null
}

/** Where typing goes: text boxes, lists, and any dialog (it has its own keys, and Esc). */
const TYPING = 'input, select, textarea, [contenteditable="true"], dialog, [role="dialog"], [role="listbox"], [role="combobox"]'
/** Controls that use the arrows (and Home / End) themselves. Page Up / Down always step moments. */
const ARROWS = '[role="slider"], [role="radiogroup"], [role="tablist"], [role="menu"], [role="toolbar"], [data-arrows]'
/** Controls that Space (and Enter) press. */
const PRESSABLE = 'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="tab"]'

/** Keys that scroll a box of text (Space, Page Up / Down, Home / End, ↑ ↓). */
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])

/** True when the focused element should get this key, not the stage. */
export function keyBelongsToTarget(target: Element | null, key: string): boolean {
  if (!target || !target.closest) return false
  if (target.closest(TYPING)) return true
  // Focus in a box of text that scrolls ("More", marked `data-scroll`): its scrolling keys scroll
  // it (review 15, LOW 4). If all its text fits, they stay the stage's (a clicker still works).
  if (SCROLL_KEYS.has(key)) {
    const box = target.closest('[data-scroll]')
    if (box && box.scrollHeight > box.clientHeight + 1) return true
  }
  if (key.startsWith('Arrow') || key === 'Home' || key === 'End') return !!target.closest(ARROWS)
  if (key === ' ' || key === 'Enter') return !!target.closest(PRESSABLE)
  return false
}

export const KEYS_OFF_PREF = 'keysOff'

interface KeysState {
  /** True when the one-character shortcuts are switched off (saved on the device). */
  off: boolean
  setOff: (off: boolean) => void
}

export const useKeys = create<KeysState>((set) => ({
  off: readPref(KEYS_OFF_PREF) === '1',
  setOff: (off) => {
    writePref(KEYS_OFF_PREF, off ? '1' : '0')
    set({ off })
  },
}))
