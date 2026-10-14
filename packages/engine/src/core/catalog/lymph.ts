/**
 * The lymph pack's catalog rows (Lymph & germ defence; S-5, model §2.10). Lazy rows (architecture
 * §1.3): the main entry never imports this file, so the first download carries only the IDs' type;
 * the run chunk reads the rows through core/catalog/rows.ts. Same rules as catalog.ts: never
 * rename or delete an ID, only add. They ship in v3.1 as new signals only (model D12, D13 iii):
 * no earlier row changes.
 *
 * Every row is a "Model estimate" (model D9): both time constants are calibrated (Nordestgaard
 * 2016) on one lumped plasma pool. No band and no threshold line on blood fat (model §2.10). The
 * pack's one event row is lazy too (core/catalog.ts PackEventId).
 */
import type { EventMeta, SignalMeta } from '../catalog.ts'

export const LYMPH_SIGNAL_IDS = ['lymph.fatFlowRate', 'blood.triglyceride'] as const
export type LymphSignalId = (typeof LYMPH_SIGNAL_IDS)[number]

export const LYMPH_EVENT_IDS = ['event.triglyceridePeak'] as const
export type LymphEventId = (typeof LYMPH_EVENT_IDS)[number]

const k = (id: string) => `signals.${id}`

export const LYMPH_SIGNALS: { readonly [Id in LymphSignalId]: SignalMeta<Id> } = {
  // The absorbed fat, packed into chyle and carried by the lacteals and lymph to the blood (OpenStax §21.1, §23.7).
  'lymph.fatFlowRate': {
    id: 'lymph.fatFlowRate',
    unit: 'g/min',
    status: 'assumption',
    clock: 'sim',
    kind: 'rate',
    sourceIds: ['openstax-ap2e-21', 'openstax-ap2e-23', 'nordestgaard2016'],
    i18nKey: k('lymph.fatFlowRate'),
    reactsToMeal: true,
    shipsIn: 'v3.1',
    displayRange: [0, 0.5],
    round: 0.01,
    limitKey: 'limits.lymphFat',
    // The fastest fat absorption of the codec's biggest meals stays well under 2 g/min: a design guard.
    validRange: { low: 0, high: 2, basis: 'guard' },
  },
  // 80 mg/dL fasting (Liu 2022) plus the meal's fat in 29 dL of plasma (OpenStax §18.1). No band, no threshold line.
  'blood.triglyceride': {
    id: 'blood.triglyceride',
    unit: 'mg/dL',
    status: 'assumption',
    clock: 'sim',
    kind: 'level',
    sourceIds: ['liu2022', 'openstax-ap2e-18', 'nordestgaard2016', 'odoherty2018', 'joshi2014'],
    i18nKey: k('blood.triglyceride'),
    reactsToMeal: true,
    shipsIn: 'v3.1',
    displayRange: [0, 200],
    round: 1,
    limitKey: 'limits.lymphFat',
    // Model §5: 60–400 mg/dL, a design guard.
    validRange: { low: 60, high: 400, basis: 'guard' },
  },
}

export const LYMPH_EVENTS: { readonly [Id in LymphEventId]: EventMeta<Id> } = {
  // The minute blood fat is highest after a meal (none for a meal without fat).
  'event.triglyceridePeak': {
    id: 'event.triglyceridePeak',
    unit: 'min',
    status: 'assumption',
    clock: 'sim',
    foundOn: 'blood.triglyceride',
    hasRange: false,
    sourceIds: ['nordestgaard2016', 'odoherty2018'],
    i18nKey: k('event.triglyceridePeak'),
    shipsIn: 'v3.1',
  },
}
