import type { TFunction } from 'i18next'

export const HORIZON_MIN = 48 * 60

/**
 * The timeline is not linear: the first 6 hours (stomach, blood sugar, absorption) are where
 * most of the action is, so they get 60 % of the bar. The slow large-intestine part gets the rest.
 */
const KNEE_MIN = 6 * 60
const KNEE_POS = 0.6

export function timeToPos(min: number): number {
  const t = Math.min(Math.max(min, 0), HORIZON_MIN)
  if (t <= KNEE_MIN) return (t / KNEE_MIN) * KNEE_POS
  return KNEE_POS + ((t - KNEE_MIN) / (HORIZON_MIN - KNEE_MIN)) * (1 - KNEE_POS)
}

export function posToTime(pos: number): number {
  const p = Math.min(Math.max(pos, 0), 1)
  if (p <= KNEE_POS) return (p / KNEE_POS) * KNEE_MIN
  return KNEE_MIN + ((p - KNEE_POS) / (1 - KNEE_POS)) * (HORIZON_MIN - KNEE_MIN)
}

export const TIMELINE_TICKS = [0, 60, 120, 180, 240, 360, 720, 1440, 2160, 2880]

/** "45 min", "3 h", "3 h 20 min" — rounded sensibly for the size of the number. */
export function formatDuration(min: number, t: TFunction): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return t('units.min', { n: m })
  if (m >= 12 * 60) return t('units.h', { n: Math.round(m / 60) })
  const h = Math.floor(m / 60)
  const rest = Math.round((m - h * 60) / 5) * 5
  if (rest === 0) return t('units.h', { n: h })
  if (rest === 60) return t('units.h', { n: h + 1 })
  return t('units.hm', { h, m: rest })
}

/** Compact clock for the timeline readout, e.g. "3:05" or "26:40". */
export function formatClock(min: number): string {
  const m = Math.max(0, Math.floor(min))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** Speed presets: simulated minutes per real second. */
export const SPEEDS = [2, 10, 30, 120, 360] as const
export type Speed = (typeof SPEEDS)[number]
