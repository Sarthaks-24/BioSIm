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
