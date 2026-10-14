import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActiveSignalId, type RunResult } from '@lifepeek/engine'
import { CloseIcon } from '../../components/kit/index.ts'
import WhyCard from '../../components/WhyCard.tsx'
import { useClock } from '../../state/clock.ts'
import type { Moment } from '../../lib/moments.ts'
import type { SystemParts } from '../load.ts'
import type { GraphSlotDef, NowProps, SystemUi } from '../registry.ts'
import GermCard from './GermCard.tsx'
import { BLOOD_FAT, LITTLE_FAT_G, PEAK, ROAD, mealFatG, momentAt, seriesOf } from './fat.ts'
import { lymphStripSummary, lymphSummary } from './summary.ts'

/**
 * Lymph & germ defence's words, graphs and moments (U-5; ui-ux §4, §6, §7; model §2.10, §2.11),
 * loaded with the `lymph` pack when the system is first lit (systems/load.ts): the Now line (the fat
 * on its way and blood fat at the clock's minute, and the germ-defence card's button), the lines
 * under its graphs (what moves them, R10; the NCERT line and its "Why different? ›" card, X-4), the
 * summary and the graphs' sentences, and its one moment. The germ-defence card (A-11a) stays: the
 * Now line's "Germ defence" opens it. Nothing here imports the stage's own modules but the meal
 * clock's and the kit's (flat/layerKit.ts says why); WhyCard is a lazy part of its own.
 */

/** The pack's signal IDs in a slot (the lean catalog's ActiveSignalId does not list them). */
const id = (s: string) => s as ActiveSignalId

/**
 * The rest of the lymph row (systems/lymph/def.ts): two graphs, every line a "Model estimate"
 * (model D9, R3). Fat's road: the fat lymph carries to the blood each minute, 0–0.15 g a minute
 * (everyday meals fit; a very big one stretches it once). Blood fat (triglyceride): no band and no
 * threshold line (model §2.10), on its row's 0–200 mg/dL.
 */
const DEFS: { lymph: SystemParts } = {
  lymph: {
    slots: [
      { id: 'road', tab: 'sys.lymph.strips.road', signals: [id(ROAD)], unit: 'g/min', range: [0, 0.15] },
      { id: 'fat', tab: 'sys.lymph.strips.fat', signals: [id(BLOOD_FAT)], unit: 'mg/dL', limits: ['limits.bloodFatIndia'] },
    ],
    knownLimits: ['limits.lymphFat', 'limits.bloodFatLate', 'limits.bloodFatIndia'],
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

/** The organ's pill: the same dark pill as Kidneys' (not a button). */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pr-2 pl-2.5 align-baseline font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(20_33_61/0.3)]'

/**
 * "Germ defence ›": the germ-defence card (A-11a), which no longer stands in the graphs' place now
 * that lymph has graphs. A native modal <dialog> as the stage's sheets are (components/stage/Sheet.tsx,
 * whose classes it shares, so it adds nothing to the page's CSS): focus stays inside, Esc, ✕ or a
 * press outside close it, and focus goes back to the button. A bottom sheet on a phone, a centred
 * panel from 1024 px up. Written out here: the pack imports no stage module (flat/layerKit.ts).
 */
function GermButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const titleId = useId()
  useEffect(() => {
    const d = dialog.current
    if (open && d && !d.open) d.showModal()
  }, [open])
  return (
    <>
      <button
        type="button"
        data-germ-open=""
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        // 44 px to touch on a phone, a text-sized link from 1024 px up (as "Why different? ›").
        className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink lg:min-h-0"
      >
        {t('sys.lymph.germs')}
      </button>
      {open && (
        <dialog
          ref={dialog}
          data-germ-sheet=""
          aria-labelledby={titleId}
          onClose={() => setOpen(false)}
          onPointerDown={(e) => (pressedOutside.current = e.target === e.currentTarget)}
          onClick={(e) => pressedOutside.current && e.target === e.currentTarget && dialog.current?.close()}
          className="flex-col overflow-hidden border-border bg-surface-raised p-0 text-ink backdrop:bg-ink/30 open:flex max-lg:inset-x-0 max-lg:top-auto max-lg:bottom-0 max-lg:m-0 max-lg:max-h-[85dvh] max-lg:w-full max-lg:max-w-none max-lg:rounded-t-frame max-lg:border-t max-lg:pb-[env(safe-area-inset-bottom)] lg:m-auto lg:max-h-[min(44rem,calc(100dvh-9rem))] lg:rounded-frame lg:border lg:w-[32rem]"
        >
          <div className="flex items-center gap-2 border-b border-border py-1.5 pr-1.5 pl-4">
            <h2 id={titleId} className="flex-1 text-title font-extrabold">
              {t('sys.lymph.card.title')}
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label={t('stage.close')}
              title={t('stage.close')}
              className="grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-sunk hover:text-ink lg:size-9"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-3 pb-4 text-control">
            <GermCard titled={false} />
          </div>
        </dialog>
      )}
    </>
  )
}

/**
 * Lymph's Now line: "[Lymph] fat on its way 0.06 g/min · blood fat 98 mg/dL", or, for a meal with
 * almost no fat, that lymph carries almost none (ui-ux §6); the kept plan's blood fat at the same
 * minute; and "Germ defence". The numbers follow the meal clock, at their rows' steps.
 */
function NowLine({ run, kept, className = '' }: NowProps) {
  const { t } = useTranslation()
  const road = useValue(run, ROAD, 0.01)
  const fat = useValue(run, BLOOD_FAT, 1)
  const keptFat = useValue(kept, BLOOD_FAT, 1)
  const none = mealFatG(run) < LITTLE_FAT_G
  return (
    <div data-now="lymph" className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <p className="flex flex-wrap items-center gap-x-2">
        <span>
          <span className="sr-only">{t('now.label')}: </span>
          <span className={`${PILL} mr-2`}>{t('sys.lymph.now.organ')}</span>
          {none ? (
            <span data-fat-none="">{t('sys.lymph.now.none')}</span>
          ) : (
            <span data-road={road}>{t('sys.lymph.now.road', { n: road?.toFixed(2) })}</span>
          )}
          <span className="text-ink-muted"> · </span>
          <span data-blood-fat={fat} className="font-semibold">
            {t('sys.lymph.now.fat', { n: fat })}
          </span>
        </span>
        <GermButton />
      </p>
      {kept && keptFat != null && (
        // The kept plan at the same minute (the graph's legend names it).
        <p data-now-kept="" className="mt-0.5 flex items-baseline gap-2 text-caption text-ink-muted lg:text-control">
          <span className="relative -top-[0.2em] shrink-0">
            <KeptSwatch />
          </span>
          {t('sys.lymph.now.kept', { n: keptFat })}
        </p>
      )}
    </div>
  )
}

/** Lymph's "Why does the model differ from the book?" card (X-4, components/WhyCard.tsx): its rows, in its own section. */
const WHY = 'sys.lymph.why'

/**
 * The lines under each lymph graph (ui-ux §6, R10): "Moves with this meal."; under Fat's road the
 * other job of lymph (about 3 L of tissue fluid a day, OpenStax §21.1) and NCERT Class 10's line
 * with "Why different? ›" (X-4); under blood fat, what before eating means here (R90: the Indian
 * baseline is in "How we know", limits.bloodFatIndia). A short window keeps its plot, and a phone
 * its one graph: there both are in the graph's "How we know".
 */
function StripNote({ slot }: { slot: GraphSlotDef }) {
  const { t } = useTranslation()
  return (
    <div data-strip-note={slot.id} className="flex flex-col gap-0.5 text-caption text-ink-muted">
      <p className="[@media(height<42.5rem)]:hidden">{t('sys.lymph.moves')}</p>
      {slot.id === 'road' ? (
        <>
          <p data-constant="tissueFluid" className="max-lg:hidden [@media(height<42.5rem)]:hidden">
            <span className="text-ink">{t('sys.lymph.fluid.value')}</span> <span data-source="">{t('sys.lymph.fluid.source')}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-2 [@media(height<42.5rem)]:hidden">
            <span data-book="">{t('sys.lymph.book')}</span>
            <WhyCard text={WHY} className="-my-2 lg:my-0" />
          </div>
        </>
      ) : (
        <p data-fasting="" className="max-lg:hidden">
          {t('sys.lymph.fasting')}
        </p>
      )}
    </div>
  )
}

/** Its one moment: blood fat near its highest (none for a meal without fat; R90 words it). */
function moments(run: RunResult): Moment[] {
  const atMin = momentAt(run, PEAK)
  return atMin == null ? [] : [{ id: PEAK as Moment['id'], atMin }]
}

const LYMPH_UI: SystemUi = {
  now: NowLine,
  summary: lymphSummary,
  stripSummary: lymphStripSummary,
  moments,
  note: StripNote,
  // In the graphs' place only if a run has no lymph graphs to draw (every run of this model has them).
  card: GermCard,
}

const UIS = { lymph: LYMPH_UI }
export default UIS
export { DEFS }
