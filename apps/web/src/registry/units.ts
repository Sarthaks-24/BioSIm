import type { Unit } from '@lifepeek/engine'

/** The i18n template (`{{n}} …`) for each unit. Every unit of a signal an organism provides needs one (registry.test.ts). */
export const UNIT_KEYS: Partial<Record<Unit, string>> = {
  g: 'units.g',
  'mg/dL': 'units.mgdl',
  kcal: 'units.kcal',
  'kcal/h': 'units.kcalPerH',
  'g/min': 'units.gPerMin',
  'breaths/min': 'units.breathsPerMin',
  mL: 'units.mL',
  'mL/min': 'units.mLPerMin',
  'beats/min': 'units.beatsPerMin',
  'L/min': 'units.LPerMin',
  // The kidneys pack's (U-4).
  'mL/h': 'units.mLPerH',
  // The control pack's (U-6): insulin as × before eating (never µU/mL), the brain's sugar in g an hour.
  xFasting: 'units.xFasting',
  'g/h': 'units.gPerH',
}
