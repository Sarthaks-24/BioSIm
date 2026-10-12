import { useEffect, useMemo } from 'react'
import { simulate, type MealItem, type ProfileId, type Simulation } from '@lifepeek/engine'
import { lookupFood } from '../data/foods.ts'
import { useRunStore } from '../state/run.ts'
import { useClock } from '../state/clock.ts'

/** Dots for the body picture. Only the current run is drawn; the kept run is a ghost line (no dots). */
const CURRENT_PARTICLES = 56

/** One run's inputs as a string, so equal meals reuse the result whatever the array identity. */
export const runKey = (items: readonly MealItem[], profile: ProfileId) =>
  `${profile}|${items.map((i) => `${i.foodId}:${i.servings}`).join(',')}`

/** Runs the model for one meal (a 48 h run takes a few milliseconds). */
export function computeRun(items: MealItem[], profile: ProfileId, which: 'current' | 'kept'): Simulation {
  return simulate({ items, profile }, { lookup: lookupFood, particles: which === 'current' ? CURRENT_PARTICLES : 0 })
}

/**
 * The current run or the kept run, recomputed only when its inputs change (like v1's
 * useSimulation). This is the ONLY place the v2 screen calls `simulate`, so moving the engine to
 * a worker later (plan-architecture A16) changes this one file.
 * The kept run is null when nothing is kept.
 */
export function useRun(which: 'current'): Simulation
export function useRun(which: 'kept'): Simulation | null
export function useRun(which: 'current' | 'kept'): Simulation | null {
  // Both selectors return values already in the store, so the component re-renders only when they change.
  const items = useRunStore((s) => (which === 'current' ? s.meal : (s.kept?.items ?? null)))
  const profile = useRunStore((s) => (which === 'current' ? s.profile : (s.kept?.profile ?? s.profile)))
  const key = items ? runKey(items, profile) : null
  return useMemo(() => (items ? computeRun(items, profile, which) : null), [key, which]) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hands the run's key moments to the meal clock, so "next / previous moment" (stepToMoment)
 * steps through this run's markers. Moments that don't happen within 48 h are skipped.
 */
export function useMomentsOnClock(run: Simulation) {
  useEffect(() => {
    useClock.getState().setMoments([...run.moments.values()].map((m) => m.atMin))
  }, [run])
}
