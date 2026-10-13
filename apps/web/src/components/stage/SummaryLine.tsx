import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { RunResult } from '@lifepeek/engine'
import { compareSummary, singleSummary, type Summary } from '../../lib/summary.ts'
import { LineSwatch } from './KeptTag.tsx'

/** The headline with its key number ("8×", "35 min") in the colour of the line it is about. */
function Headline({ summary }: { summary: Summary }) {
  const { headline, key } = summary
  const at = key ? headline.indexOf(key.text) : -1
  if (!key || at < 0) return headline
  return (
    <>
      {headline.slice(0, at)}
      <span data-summary-key={key.line} className={`font-extrabold whitespace-nowrap ${key.line === 'run' ? 'text-run' : 'text-kept'}`}>
        {key.text}
      </span>
      {headline.slice(at + key.text.length)}
    </>
  )
}

/**
 * The summary sentence (council verdict #3): the answer in one sentence, under the body, so
 * nobody has to read a graph to get the point. One meal: when half of it has left the stomach.
 * With a kept meal: which stomach empties faster, about how many times, and why, only when the
 * reason is true (lib/summary.ts). It does not depend on the clock, so it is there from 0 min.
 *
 * It is the stage's answer, so it reads louder than the Now line (council round 2, C4): a step
 * up in size, semibold, and its key number in the colour of its line (blue for this meal, the
 * kept grey for the kept one; both dark enough to read as text). The reason is the quieter second
 * sentence; on a phone it gives way to the body (the headline stays).
 */
export default function SummaryLine({ run, kept, className = '' }: { run: RunResult; kept: RunResult | null; className?: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const summary = useMemo(() => (kept ? compareSummary(run, kept, t, lang) : singleSummary(run, t, lang)), [run, kept, t, lang])
  if (!summary) return null
  return (
    <p data-summary={kept ? 'compare' : 'single'} className={`flex items-start gap-2 text-control text-ink ${className}`}>
      <span className="sr-only">{t('summary.label')}: </span>
      {/* Both lines' samples when comparing, as in the graphs' legend: the sentence is about them. */}
      <span aria-hidden="true" className="mt-[0.6lh] flex shrink-0 flex-col gap-1 max-sm:hidden">
        <LineSwatch />
        {kept && <LineSwatch kept />}
      </span>
      <span>
        <strong data-summary-headline="" className="block font-semibold sm:text-lead">
          <Headline summary={summary} />
        </strong>
        {summary.reason && <span className="mt-0.5 block text-ink-muted max-sm:hidden">{summary.reason}</span>}
      </span>
    </p>
  )
}
