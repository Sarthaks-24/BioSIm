import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActiveSignalId, type RunResult } from '@lifepeek/engine'
import WhyCard from '../../components/WhyCard.tsx'
import { StatusTag } from '../../components/kit/index.ts'
import { useClock } from '../../state/clock.ts'
import type { Moment } from '../../lib/moments.ts'
import type { SystemParts } from '../load.ts'
import type { GraphSlotDef, NowProps, SystemUi } from '../registry.ts'
import { GLUCOSE, INSULIN, INSULIN_PEAK, hormonesStripSummary, hormonesSummary, momentAt, numberText, seriesOf } from './summary.ts'

/**
 * Hormones' words, graphs and moments (U-6; ui-ux §4, §6, §7, content-i18n §6), loaded with the
 * `control` pack when the system is first lit (systems/load.ts): the Now line, the lines under its
 * graphs (what moves them, R10; the brain's sugar as a constant card with its source line, R13; "not
 * an injection guide"; NCERT's feedback line with "Why different? ›"; the other glands as Drawing-only
 * cards, never a number), the summary and the graphs' sentences, and its one moment. It shares no
 * code with the stage but the meal clock's.
 */

/** The pack's signal IDs in a slot (the lean catalog's ActiveSignalId does not list them). */
const id = (s: string) => s as ActiveSignalId

/**
 * The rest of hormones' row (systems/hormones/row.ts): Blood sugar, Digestion's own line (unchanged:
 * insulin never feeds back, E1), then insulin as × before eating with its band (how much people
 * differ, Takahashi 2018), never µU/mL. Both "Model estimate" or better (model D9).
 */
const DEFS: { hormones: SystemParts } = {
  hormones: {
    slots: [
      {
        id: 'sugar',
        tab: 'sys.control.strips.sugar',
        signals: [GLUCOSE as ActiveSignalId],
        unit: 'mg/dL',
        // The brain's card is under this graph; where it is hidden (a phone, a short window), "How we know" has it.
        limits: ['limits.brainGlucoseConstant'],
      },
      {
        id: 'insulin',
        tab: 'sys.control.strips.insulin',
        signals: [id(INSULIN)],
        unit: 'xFasting',
        limits: ['limits.insulinOpenLoop', 'limits.insulinHigh'],
      },
    ],
    knownLimits: [
      'limits.insulinOpenLoop',
      'limits.insulinHigh',
      'limits.insulinSugarOnly',
      'limits.insulinHealthy',
      'limits.brainGlucoseConstant',
    ],
  },
}

/** A signal's value at the clock's minute, rounded as its graph writes it; re-renders only when that number changes. */
function useValue(run: RunResult | null, signal: string, lang: string): string | null {
  return useClock(
    useCallback(
      (s: { simMin: number }) => {
        const series = run && seriesOf(run, signal)
        return series ? numberText(valueAt(series, s.simMin, run.stepMin), series.meta, lang) : null
      },
      [run, signal, lang],
    ),
  )
}

/** The kept line's sample: grey, dashed (components/stage/KeptTag.tsx LineSwatch). */
const KeptSwatch = () => (
  <svg viewBox="0 0 22 4" width="22" height="4" aria-hidden="true" focusable="false" className="shrink-0 overflow-visible">
    <line x1="1" y1="2" x2="21" y2="2" strokeWidth="3" className="stroke-kept [stroke-dasharray:var(--strip-kept-dash)]" />
  </svg>
)

/** The pancreas's pill: the same dark pill as Digestion's organ, here not a button. */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pr-2 pl-2.5 align-baseline font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(20_33_61/0.3)]'

/**
 * Hormones' Now line: "[Pancreas] insulin 4.8× before eating · blood sugar 114 mg/dL", and the kept
 * plan's insulin at the same minute. The numbers follow the meal clock, rounded as the graphs write them.
 */
function NowLine({ run, kept, className = '' }: NowProps) {
  const { t, i18n } = useTranslation()
  const insulin = useValue(run, INSULIN, i18n.language)
  const sugar = useValue(run, GLUCOSE, i18n.language)
  const keptInsulin = useValue(kept, INSULIN, i18n.language)
  return (
    <div data-now="hormones" className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <p>
        <span className="sr-only">{t('now.label')}: </span>
        <span className={`${PILL} mr-2`}>{t('sys.control.now.organ')}</span>
        <span data-insulin-x={insulin} className="font-semibold">
          {t('sys.control.now.insulin', { n: insulin })}
        </span>
        <span className="text-ink-muted"> · {t('sys.control.now.sugar', { n: sugar })}</span>
      </p>
      {kept && keptInsulin != null && (
        <p data-now-kept="" className="mt-0.5 flex items-baseline gap-2 text-caption text-ink-muted lg:text-control">
          <span className="relative -top-[0.2em] shrink-0">
            <KeptSwatch />
          </span>
          {t('sys.control.now.kept', { n: keptInsulin })}
        </p>
      )}
    </div>
  )
}

/** The glands NCERT Class 10 names besides the pancreas (Ch 6, pp. 109–110), and the stomach's hunger signal: Drawing only, no numbers. */
const OTHERS = ['adrenaline', 'thyroxin', 'growth', 'hunger'] as const

/**
 * "Other hormones ›" and its Drawing-only cards (R11, R13: the "Drawing only" tag, never a fourth
 * one, and no number): what each does, in a sentence, with its book or source. Opens over the graph,
 * the width of the lines under it, so the graph keeps its size (a projector's column has no room to
 * spare); Esc or the link again closes it, and the focus goes back to the link.
 */
function OtherHormones() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const onKey = (e: KeyboardEvent) => {
    if (!open || e.key !== 'Escape') return
    e.preventDefault()
    setOpen(false)
    button.current?.focus()
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        data-others-open=""
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className="inline-flex min-h-11 items-center self-start font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink lg:min-h-0"
      >
        {t('sys.control.others.open')}
      </button>
      {open && (
        <section
          id={listId}
          data-others=""
          aria-label={t('sys.control.others.title')}
          tabIndex={-1}
          onKeyDown={onKey}
          className="absolute inset-x-0 bottom-full z-30 mb-1 max-h-[60vh] overflow-y-auto rounded-control border border-border bg-surface-raised px-3 py-2 text-ink shadow-[0_6px_24px_-8px_rgb(20_33_61/0.35)]"
        >
          <h3 className="flex flex-wrap items-center gap-x-2 font-semibold">
            {t('sys.control.others.title')} <StatusTag status="illustration" />
          </h3>
          <dl className="mt-1 flex flex-col gap-1.5">
            {OTHERS.map((key) => (
              <div key={key} data-other={key}>
                <dt className="font-semibold">{t(`sys.control.others.${key}.name`)}</dt>
                <dd>{t(`sys.control.others.${key}.text`)}</dd>
                <dd className="text-ink-muted">{t(`sys.control.others.${key}.source`)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  )
}

/** Hormones' "Why does the model differ from the book?" card (X-4, components/WhyCard.tsx): its rows, in its own section. */
const WHY = 'sys.control.why'

/**
 * The lines under each graph (ui-ux §6, R10, R13):
 * - Blood sugar: what moves it, and the brain's sugar card (a value the same all day here, why, and
 *   its source line: no fourth tag). A short window keeps its plot: there the card is in "How we know".
 * - Insulin: what moves it, "not an injection guide" (always shown: content-i18n §6), NCERT Class 10's
 *   feedback line with "Why different? ›" (X-4), and "Other hormones ›".
 */
function StripNote({ slot }: { slot: GraphSlotDef }) {
  const { t } = useTranslation()
  return (
    <div data-strip-note={slot.id} className="relative flex flex-col gap-0.5 text-caption text-ink-muted">
      <p className="[@media(height<42.5rem)]:hidden">{t('sys.control.moves')}</p>
      {slot.id === 'sugar' ? (
        <p data-constant="brain" className="max-lg:hidden in-data-[contrast=high]:hidden [@media(height<42.5rem)]:hidden">
          <span className="text-ink">{t('sys.control.brain.value')}</span> {t('sys.control.brain.back')}{' '}
          <span data-source="">{t('sys.control.brain.source')}</span>
        </p>
      ) : (
        <>
          <p data-not-guide="" className="text-ink">
            {t('sys.control.notGuide')}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 [@media(height<42.5rem)]:hidden">
            <span data-book="" className="max-lg:hidden in-data-[contrast=high]:hidden">
              {t('sys.control.book')}
            </span>
            <WhyCard text={WHY} className="-my-2 lg:my-0" />
            <OtherHormones />
          </div>
        </>
      )}
    </div>
  )
}

/** Its one moment: the most insulin (none when it never rises: water, an egg). */
function moments(run: RunResult): Moment[] {
  const atMin = momentAt(run, INSULIN_PEAK)
  return atMin != null ? [{ id: INSULIN_PEAK as Moment['id'], atMin }] : []
}

const HORMONES_UI: SystemUi = {
  now: NowLine,
  summary: hormonesSummary,
  stripSummary: hormonesStripSummary,
  moments,
  note: StripNote,
}

const UIS = { hormones: HORMONES_UI }
export default UIS
export { DEFS }
