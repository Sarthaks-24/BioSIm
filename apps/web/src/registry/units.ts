import type { Unit } from '@lifepeek/engine'

/** The i18n template (`{{n}} …`) for each unit. Every unit of a signal an organism provides needs one (registry.test.ts). */
export const UNIT_KEYS: Partial<Record<Unit, string>> = {
  g: 'units.g',
  'mg/dL': 'units.mgdl',
  kcal: 'units.kcal',
  'kcal/h': 'units.kcalPerH',
}
