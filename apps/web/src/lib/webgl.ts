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

/** Whether the stage shows the flat body because 3D can't be drawn here (no WebGL, or it failed). */
let flat = false
const listeners = new Set<() => void>()

/** The flat body stands in for the 3D one for good (components/BodyView.tsx). */
export function sayFlat() {
  if (flat) return
  flat = true
  listeners.forEach((l) => l())
}

/**
 * True once the flat body stands in for the 3D one: the stage's notes say why, in one line that can
 * be dismissed (FP-5, U9: the note used to lie over the body and the food pieces' key).
 */
export const useFlat = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    () => flat,
  )
