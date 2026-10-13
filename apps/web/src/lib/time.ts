import type { TFunction } from 'i18next'
import { PARAMS } from '@lifepeek/engine'

/** The 48 h bar of the meal clock and the timeline. A run's own length is `run.horizonMin`. */
export const HORIZON_MIN = PARAMS.horizonMin

/**
 * The timeline is not linear: the first 6 hours (stomach, blood sugar, absorption) are where
 * most of the action is, so they get 60 % of the bar. The slow large-intestine part gets the rest.
 * Playback moves along the BAR at a steady pace, so those 6 hours also get 60 % of the playing time.
 */
export const KNEE_MIN = 6 * 60
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

export const KNEE_FRACTION = KNEE_POS

export const TIMELINE_TICKS = [0, 60, 120, 180, 240, 360, 720, 1440, 2160, 2880]

/** "35 min", "3 h", "3 h 20 min" — rounded to 5 minutes so the model doesn't pretend to be precise. */
export function formatDuration(min: number, t: TFunction): string {
  const m = Math.max(0, Math.round(min))
  if (m < 10) return t('units.min', { n: m })
  if (m < 60) return t('units.min', { n: Math.round(m / 5) * 5 })
  if (m >= 12 * 60) return t('units.h', { n: Math.round(m / 60) })
  const h = Math.floor(m / 60)
  const rest = Math.round((m - h * 60) / 5) * 5
  if (rest === 0) return t('units.h', { n: h })
  if (rest === 60) return t('units.h', { n: h + 1 })
  return t('units.hm', { h, m: rest })
}

/** Playback pace: seconds to play the whole 2-day bar. */
export type Pace = 240 | 120 | 60 | 30
export const DEFAULT_PACE: Pace = 60
