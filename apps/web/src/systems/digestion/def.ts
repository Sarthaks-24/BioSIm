import type { SystemDef } from '../registry.ts'

/**
 * Digestion (architecture §5.1): the `core` pack, first paint, drawn by the body itself. Its three
 * graphs are the stomach, blood sugar and energy (coming in and used at rest on one kcal/h axis);
 * keys 1–3 pick them, and S, B, E too in v3.0 (lib/keys.ts).
 *
 * Every graph's "How we know" lists the steady emptying (its level-then-fall, which the squeezed
 * axis makes look like a cliff at 6 h: council round 2, C2); blood sugar's also that more of the
 * same food stays up longer at the same highest point (capped release). Beside a kept meal a ring's
 * label names its meal ("Cola: half the energy has left the stomach"; council round 2, C3).
 */
export const DIGESTION: SystemDef = {
  id: 'digestion',
  i18nKey: 'systems.digestion',
  lifeProcess: 'nutrition',
  clock: 'sim',
  organs: ['mouth', 'esophagus', 'stomach', 'smallIntestine', 'largeIntestine', 'liver', 'pancreas'],
  slots: [
    {
      id: 'gut',
      signals: ['gut.stomach.contentG'],
      unit: 'g',
      letter: 's',
      limits: ['limits.steadyEmptying'],
      marks: { 'graph.halfEnergyLeft': 'graph.halfEnergyLeftOf', 'signals.event.stomachHalfEmpty.name': 'graph.halfLeftOf' },
    },
    {
      id: 'blood',
      signals: ['blood.glucose'],
      unit: 'mg/dL',
      letter: 'b',
      limits: ['limits.glucoseSameHighest', 'limits.steadyEmptying'],
      marks: { 'graph.highest': 'graph.highestOf' },
    },
    { id: 'energy', signals: ['energy.inRate', 'energy.usedRate'], unit: 'kcal/h', letter: 'e', limits: ['limits.steadyEmptying'] },
  ],
  knownLimits: ['limits.glucoseBand', 'limits.backToBase'],
  draw: 'body',
  pack: 'core',
  inputs: ['meal', 'activity'],
  rhythms: [],
  // The meal clock's 48 h (lib/time.ts HORIZON_MIN).
  graphWindowMin: 2880,
  public: true,
}
