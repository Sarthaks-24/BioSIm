import { useSyncExternalStore } from 'react'

let cached: boolean | null = null

/** True if this device can create a WebGL context. Old school PCs and some phones can't. */
export function hasWebGL(): boolean {
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    // The probe's context is left for the garbage collector. Losing it on purpose
    // (WEBGL_lose_context) printed "WebGL context was lost" in Firefox on every load (B19); it is
    // one context, made once, and browsers allow 16.
    cached = !!gl
  } catch {
    cached = false
  }
  return cached
}

/**
 * What the stage's notes say about the body (stage/Notes.tsx), set by components/BodyView.tsx:
 * - `webgl`: 3D can't be drawn here (no WebGL, or it failed), the flat body stands in for good;
 * - `slow`: the 3D file is still loading after 6 s, the flat body meanwhile (R71);
 * - `offline`: the 3D file was never saved and there is no internet: it needs the internet once;
 * - `failed`: it didn't load with the internet on: Try again (`retry3d`).
 * The meal, the time and the flat body stay; the screen is never cleared (R71).
 */
export type BodyNote = '' | 'webgl' | 'slow' | 'offline' | 'failed'

let note: BodyNote = ''
/** How many times the 3D body was asked for again (Try again, or the internet came back). */
let tries = 0
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** Sets the body's note; with `onlyIf`, only while that note is shown. */
export function sayBody(next: BodyNote, onlyIf?: BodyNote) {
  if (note === next || (onlyIf !== undefined && note !== onlyIf)) return
  note = next
  listeners.forEach((l) => l())
}

/** Asks for the 3D body again (BodyView remounts it). */
export function retry3d() {
  tries++
  note = ''
  listeners.forEach((l) => l())
}

// Back online: a 3D body that needed the internet is asked for again.
if (typeof window !== 'undefined') window.addEventListener('online', () => note === 'offline' && retry3d())

export const useBodyNote = () => useSyncExternalStore(subscribe, () => note)
export const use3dTries = () => useSyncExternalStore(subscribe, () => tries)
