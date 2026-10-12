import type { SystemDef } from '../types.ts'

export const HUMAN_SYSTEMS: readonly SystemDef[] = [
  {
    id: 'digestion',
    i18nKey: 'systems.digestion',
    lifeProcess: 'nutrition',
    clock: 'sim',
    organs: ['mouth', 'esophagus', 'stomach', 'smallIntestine', 'largeIntestine', 'liver', 'pancreas'],
    signals: ['gut.stomach.contentG', 'blood.glucose', 'energy.inRate', 'energy.usedRate'],
    knownLimits: ['limits.glucoseBand', 'limits.backToBase'],
    draw: 'body',
  },
]
