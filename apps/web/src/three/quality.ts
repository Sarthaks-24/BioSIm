/**
 * Cheap-phone settings for the 3D body (roadmap 3D-1 phone fixes, plan-systems-3d §3.5).
 *
 * The device pixel ratio is capped: a 3× phone screen would otherwise shade 9 pixels for every
 * CSS pixel. 1.5 keeps edges crisp on most phones; a 2 GB phone (`deviceMemory ≤ 2`) gets 1.25
 * and no multisampling, which it cannot afford. The full quality tiers with a matcap material
 * and a frame governor are WP-16b, only if a real 2 GB phone misses 30 fps.
 */
export interface Quality {
  /** Highest device pixel ratio the canvas renders at. */
  dpr: number
  /** Multisample anti-aliasing. */
  antialias: boolean
}

/** What we read from `navigator`; deviceMemory is Chromium-only (undefined elsewhere). */
export interface DeviceHints {
  deviceMemory?: number
}

export const LOW_MEMORY_GB = 2

export function quality(hints: DeviceHints = typeof navigator === 'undefined' ? {} : (navigator as DeviceHints)): Quality {
  const low = hints.deviceMemory !== undefined && hints.deviceMemory <= LOW_MEMORY_GB
  return low ? { dpr: 1.25, antialias: false } : { dpr: 1.5, antialias: true }
}
