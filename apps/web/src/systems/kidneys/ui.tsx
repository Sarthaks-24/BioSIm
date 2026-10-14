import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActiveSignalId, type RunResult } from '@lifepeek/engine'
import WhyCard from '../../components/WhyCard.tsx'
import { useClock } from '../../state/clock.ts'
import type { Moment } from '../../lib/moments.ts'
import type { SystemParts } from '../load.ts'
import type { GraphSlotDef, NowProps, SystemUi } from '../registry.ts'
import { kidneysStripSummary, kidneysSummary } from './summary.ts'
import { URGE_ML, backgroundOf, momentAt, seriesOf } from './water.ts'

/**
 * Kidneys & water's words, graphs and moments (U-4; ui-ux §4, §6, §7), loaded with the `kidneys`
 * pack when the system is first lit (systems/load.ts): the Now line, the lines under its graphs
 * (what moves them, R10; the filtering constant card with its source line, R13), the background
 * line on the urine graph, the summary and the graphs' sentences, and its two moments. It shares no
 * code with the stage but the meal clock's.
 */

const URINE = 'kidney.urineRate'
const BLADDER = 'kidney.bladderMl'
/** The pack's signal IDs in a slot (the lean catalog's ActiveSignalId does not list them). */
const id = (s: string) => s as ActiveSignalId

/**
 * The rest of kidneys' row (systems/kidneys/row.ts): two graphs on a 0–12 h window, every line a
 * "Model estimate" (model D9). Urine made per hour carries the background line (a day without this
 * meal, `background`); water in the body above normal goes below zero after sweating (R84). Each
 * range is the same for every meal: one glass of water fits; four stretch it once.
 */
const DEFS: { kidneys: SystemParts } = {
  kidneys: {
    slots: [
      {
        id: 'urine',
        tab: 'sys.kidneys.strips.urine',
        signals: [id(URINE)],
        unit: 'mL/h',
        range: [0, 400],
        limits: ['limits.gfrFixed'],
      },
      {
        id: 'water',
        tab: 'sys.kidneys.strips.water',
        signals: [id('water.bodyExtraMl')],
        unit: 'mL',
        range: [-200, 400],
      },
    ],
    knownLimits: ['limits.waterSteadyDay', 'limits.bladderEmpties', 'limits.gfrFixed', 'limits.waterSimple'],
  },
}

/** A signal's value at the clock's minute, rounded to `step`; re-renders only when that number changes. */
function useValue(run: RunResult | null, signal: string, step: number): number | null {
  return useClock(
    useCallback(
      (s: { simMin: number }) => {
        const series = run && seriesOf(run, signal)
        return series ? Math.round(valueAt(series, s.simMin, run.stepMin) / step) * step : null
      },
      [run, signal, step],
    ),
  )
}

/** The kept line's sample: grey, dashed (components/stage/KeptTag.tsx LineSwatch). */
const KeptSwatch = () => (
  <svg viewBox="0 0 22 4" width="22" height="4" aria-hidden="true" focusable="false" className="shrink-0 overflow-visible">
    <line x1="1" y1="2" x2="21" y2="2" strokeWidth="3" className="stroke-kept [stroke-dasharray:var(--strip-kept-dash)]" />
  </svg>
)

/** The bladder's pill: the same dark pill as Digestion's organ, here not a button (kidneys have no "More" yet). */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pr-2 pl-2.5 align-baseline font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(20_33_61/0.3)]'

/**
 * Kidneys' Now line: "[Bladder] 120 mL · urine 220 mL an hour", "starts to feel full" from 150 mL,
 * and the kept plan's urine at the same minute. The numbers follow the meal clock, in 5 mL steps.
 */
function NowLine({ run, kept, className = '' }: NowProps) {
  const { t } = useTranslation()
  const bladder = useValue(run, BLADDER, 5)
  const urine = useValue(run, URINE, 5)
  const keptUrine = useValue(kept, URINE, 5)
  return (
    <div data-now="kidneys" className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <p>
        <span className="sr-only">{t('now.label')}: </span>
        <span className={`${PILL} mr-2`}>{t('sys.kidneys.now.organ')}</span>
        <span data-bladder-ml={bladder} className="font-semibold">
          {t('sys.kidneys.now.bladder', { n: bladder })}
        </span>
        {bladder != null && bladder >= URGE_ML && <span className="text-ink-muted"> · {t('sys.kidneys.now.urge')}</span>}
        <span className="text-ink-muted"> · {t('sys.kidneys.now.rate', { n: urine })}</span>
      </p>
      {kept && keptUrine != null && (
        // The kept plan at the same minute (the graph's legend names it).
        <p data-now-kept="" className="mt-0.5 flex items-baseline gap-2 text-caption text-ink-muted lg:text-control">
          <span className="relative -top-[0.2em] shrink-0">
            <KeptSwatch />
          </span>
          {t('sys.kidneys.now.kept', { n: keptUrine })}
        </p>
      )}
    </div>
  )
}

/** Kidneys' "Why does the model differ from the book?" card (X-4, components/WhyCard.tsx): its rows, in its own section. */
const WHY = 'sys.kidneys.why'

/**
 * The lines under each kidneys graph (ui-ux §6, R10, R13): what moves it; under the urine graph the
 * filtering constant card (a value the same all day here, why, and its source line: no fourth tag)
 * and NCERT Class 10's 180 L with "Why different? ›" (X-4);
 * under the body-water graph what below zero means (R84). A short window keeps its plot, and a phone's
 * one graph too: there both are in the graph's "How we know" (limits.gfrFixed, the signal's description).
 */
function StripNote({ slot }: { slot: GraphSlotDef }) {
  const { t } = useTranslation()
  return (
    <div data-strip-note={slot.id} className="flex flex-col gap-0.5 text-caption text-ink-muted">
      <p className="[@media(height<42.5rem)]:hidden">{t('sys.kidneys.moves')}</p>
      {slot.id === 'urine' ? (
        <>
          <p data-constant="filtration" className="max-lg:hidden [@media(height<42.5rem)]:hidden">
            <span className="text-ink">{t('sys.kidneys.filter.value')}</span> {t('sys.kidneys.filter.back')}{' '}
            <span data-source="">{t('sys.kidneys.filter.source')}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-2 [@media(height<42.5rem)]:hidden">
            <span data-book="">{t('sys.kidneys.book')}</span>
            <WhyCard text={WHY} className="-my-2 lg:my-0" />
          </div>
        </>
      ) : (
        <p data-below-zero="" className="max-lg:hidden">
          {t('sys.kidneys.below')}
        </p>
      )}
    </div>
  )
}

/** Its moments, in catalog order: the bladder's first urge, and half the meal's water gone (none when there is none to pass, R84). */
function moments(run: RunResult): Moment[] {
  const out: Moment[] = []
  for (const m of ['event.bladderFirstUrge', 'event.halfMealWaterPassed']) {
    const atMin = momentAt(run, m)
    if (atMin != null) out.push({ id: m as Moment['id'], atMin })
  }
  return out
}

const KIDNEYS_UI: SystemUi = {
  now: NowLine,
  summary: kidneysSummary,
  stripSummary: kidneysStripSummary,
  moments,
  note: StripNote,
  background: (slot, run) => (slot.id === 'urine' ? backgroundOf(run) : null),
}

const UIS = { kidneys: KIDNEYS_UI }
export default UIS
export { DEFS }
