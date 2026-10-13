import type { TFunction } from 'i18next'
import type { ActiveSignalId, RunResult } from '@lifepeek/engine'
import type { SystemUi } from '../systems/registry.ts'

/**
 * A graph's description (G8, its text alternative): this meal's sentence, then the kept meal's,
 * named ("Kept: Cola. …"). The sentences are the lit system's (`SystemUi.stripSummary`; digestion's
 * are in systems/digestion/stripSummary.ts). What a screen reader reads after the graph's name,
 * and the caption of its table.
 */
export function stripDescription(
  summarize: SystemUi['stripSummary'],
  id: ActiveSignalId,
  run: RunResult,
  kept: RunResult | null,
  keptName: string,
  t: TFunction,
  lang: string,
): string | undefined {
  const own = summarize(id, run, t, lang)
  const other = kept && summarize(id, kept, t, lang)
  return [own, other && `${t('keep.tag', { meal: keptName })}. ${other}`].filter(Boolean).join(' ') || undefined
}
