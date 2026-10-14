import { useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActiveSignalId, type RunResult } from '@lifepeek/engine'
import { formatDuration } from '../../lib/time.ts'
import { useClock } from '../../state/clock.ts'
import type { SystemParts } from '../load.ts'
import type { GraphSlotDef, NowProps, SlotPick, SystemUi } from '../registry.ts'
import { beatRate, doingAt, seriesOf } from './beat.ts'
import { CIRCULATION_LESSON } from './lesson.ts'
import { circulationStripSummary, circulationSummary } from './summary.ts'

/**
 * Heart & blood's words, graphs and moments (U-3; ui-ux §4, §6, §7), loaded with the `circulation`
 * pack when the system is first lit (systems/load.ts): the Now line with where the blood goes, the
 * rhythm chip over the body, the lines under its graphs (what moves them, the book's pulse, the
 * children's band, the "Why does the model differ from the book?" card, blood pressure as a held
 * book value), the summary and the graphs' sentences. It shares no code with the stage but the meal
 * clock's (a shared module would be split out of /sim into a chunk of its own).
 */

const RATE = 'heart.rate'
const GUT = 'blood.flow.gut'
const MUSCLE = 'blood.flow.muscle'
const OUTPUT = 'heart.output'
/** The pack's signal IDs in a slot (the lean catalog's ActiveSignalId does not list them). */
const id = (s: string) => s as ActiveSignalId

/**
 * The rest of Heart & blood's row (systems/circulation/row.ts): three graphs, every line a "Model
 * estimate" (model D9). Heart beats a minute carries the children's band: most children aged 12–15
 * have 62–96 beats a minute at rest (Fleming 2011, 10th–90th centile; confirmed R57). Where blood
 * goes draws the gut's and the muscles' blood on one axis; beside a kept plan one at a time.
 */
const DEFS: { circulation: SystemParts } = {
  circulation: {
    slots: [
      {
        id: 'beats',
        tab: 'sys.circulation.strips.beats',
        signals: [id(RATE)],
        unit: 'beats/min',
        limits: ['limits.heartAdult', 'limits.heartRecovery'],
        reference: { low: 62, high: 96 },
      },
      { id: 'pumped', tab: 'sys.circulation.strips.pumped', signals: [id(OUTPUT)], unit: 'L/min', limits: ['limits.heartDrawing'] },
      {
        id: 'where',
        tab: 'sys.circulation.strips.where',
        signals: [id(GUT), id(MUSCLE)],
        unit: 'mL/min',
        // The gut's and the resting muscles' blood read clearly; a run's muscles stretch it once.
        range: [0, 5000],
        oneWithKept: true,
      },
    ],
    rhythms: [id(RATE)],
    knownLimits: ['limits.heartAdult', 'limits.heartRecovery', 'limits.heartDrawing'],
  },
}

/** The beats a minute at the clock's minute, whole; re-renders only when that number changes. */
function useRate(run: RunResult | null): number | null {
  return useClock(
    useCallback(
      (s: { simMin: number }) => {
        const rate = run && seriesOf(run, RATE)
        return rate ? Math.round(valueAt(rate, s.simMin, run.stepMin)) : null
      },
      [run],
    ),
  )
}

/** What the body is doing at the clock's minute: re-renders only when a bout starts or ends. */
const useDoing = (run: RunResult) => useClock(useCallback((s: { simMin: number }) => doingAt(run.activity, s.simMin), [run]))

/**
 * Where the blood goes at the clock's minute, in litres a minute to one decimal ("1.2|0.9|2.2":
 * gut, muscles, the rest of the body); re-renders only when one of them changes.
 */
function useShares(run: RunResult): [number, number, number] | null {
  const key = useClock(
    useCallback(
      (s: { simMin: number }) => {
        const [gut, muscle, output] = [GUT, MUSCLE, OUTPUT].map((x) => seriesOf(run, x))
        if (!gut || !muscle || !output) return ''
        const at = (x: typeof gut) => valueAt(x, s.simMin, run.stepMin)
        const [g, m] = [at(gut) / 1000, at(muscle) / 1000]
        return [g, m, Math.max(0, at(output) - g - m)].map((v) => v.toFixed(1)).join('|')
      },
      [run],
    ),
  )
  return key ? (key.split('|').map(Number) as [number, number, number]) : null
}

/** The kept line's sample: grey, dashed (components/stage/KeptTag.tsx LineSwatch). */
const KeptSwatch = () => (
  <svg viewBox="0 0 22 4" width="22" height="4" aria-hidden="true" focusable="false" className="shrink-0 overflow-visible">
    <line x1="1" y1="2" x2="21" y2="2" strokeWidth="3" className="stroke-kept [stroke-dasharray:var(--strip-kept-dash)]" />
  </svg>
)

/** The heart's pill: the same dark pill as Digestion's organ, here not a button (Heart & blood has no "More" yet). */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pr-2 pl-2.5 align-baseline font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(20_33_61/0.3)]'

/** The "now" bar's parts: the gut, the muscles, the rest of the body (shades of ink, never a status colour). */
const SHARE_SHADES = ['bg-ink/75', 'bg-ink/45', 'bg-ink/15'] as const

/**
 * Heart & blood's Now line: "[Heart] 94 a minute · walking", the kept plan's rate at the same
 * minute, and the "now" bar: where each minute's blood goes (gut · muscles · the rest of the body),
 * from 1024 px wide and 680 px tall (ui-ux §7: the body keeps its room). The numbers follow the meal clock; the
 * words change only when a bout starts or ends.
 */
function NowLine({ run, kept, className = '' }: NowProps) {
  const { t, i18n } = useTranslation()
  const n = useRate(run)
  const keptN = useRate(kept)
  const band = useDoing(run)
  const shares = useShares(run)
  const total = shares ? shares[0] + shares[1] + shares[2] : 0
  // Litres to one decimal, "1.0" too, in Latin digits.
  const l = (v: number) =>
    new Intl.NumberFormat(i18n.language, { numberingSystem: 'latn', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)
  return (
    <div data-now="circulation" className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <p>
        <span className="sr-only">{t('now.label')}: </span>
        <span className={`${PILL} mr-2`}>{t('sys.circulation.now.organ')}</span>
        <span className="font-semibold">{t('sys.circulation.now.rate', { n })}</span>
        <span className="text-ink-muted"> · {t(`sys.circulation.doing.${band}`)}</span>
      </p>
      {kept && keptN != null && (
        // The kept plan at the same minute (the graph's legend names it).
        <p data-now-kept="" className="mt-0.5 flex items-baseline gap-2 text-caption text-ink-muted lg:text-control">
          <span className="relative -top-[0.2em] shrink-0">
            <KeptSwatch />
          </span>
          {t('sys.circulation.now.kept', { n: keptN })}
        </p>
      )}
      {shares && total > 0 && (
        // Under 1024 px wide or 680 px tall the body keeps the room: "Where blood goes" says the same.
        <div data-now-shares={shares.join(' ')} className="mt-1 flex flex-col gap-0.5 max-lg:hidden [@media(height<42.5rem)]:hidden">
          <span aria-hidden="true" className="flex h-1.5 w-full max-w-72 overflow-hidden rounded-full">
            {shares.map((v, i) => (
              <span key={i} className={SHARE_SHADES[i]} style={{ width: `${(100 * v) / total}%` }} />
            ))}
          </span>
          <span className="text-caption text-ink-muted">
            {t('sys.circulation.now.shares', { gut: l(shares[0]), muscle: l(shares[1]), rest: l(shares[2]) })}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * The rhythm chip over the body (ui-ux §4): "♥ 66 a minute · typical adult, resting · shown at its
 * true speed ⓘ". The number is the model's at the clock's minute (the beat is drawn at that rate, at
 * most 2.5 a second; faster says "animation slowed", everywhere, and the number stays true). ⓘ opens
 * the rest: who and what, why the heart moves while the clock runs hours in seconds, and that its
 * movement is enlarged to be seen. A phone shows "♥ 66 ⓘ", a laptop "♥ 66 a minute ⓘ" and the words
 * only where the picture is big (from 1024 px up, not on the projector).
 */
function RhythmChip({ run }: { run: RunResult }) {
  const { t } = useTranslation()
  const n = useRate(run)
  const band = useDoing(run)
  const [open, setOpen] = useState(false)
  const minute = useClock((s) => (open ? Math.round(s.simMin) : 0))
  const whyId = useId()
  if (n == null) return null
  const who = t('sys.circulation.chip.who', { doing: t(`sys.circulation.doing.${band}`) })
  const slowed = beatRate(n).slowed
  return (
    <div
      data-rhythm-chip={n}
      data-slowed={slowed ? '' : undefined}
      style={{ maxWidth: 'min(26rem, 90%)' }}
      className="pointer-events-auto flex flex-wrap items-center gap-x-1.5 rounded-control bg-surface-raised/90 px-1.5 text-caption text-ink-muted lg:text-control"
    >
      <strong className="font-semibold whitespace-nowrap text-ink">
        <span aria-hidden="true">♥ </span>
        <span className="lg:hidden">{n}</span>
        <span className="max-lg:hidden">{t('sys.circulation.now.rate', { n })}</span>
      </strong>
      <span className="max-lg:hidden in-data-[contrast=high]:hidden">
        · {who} · {t('sys.circulation.chip.speed')}
      </span>
      {slowed && <span>· {t('sys.circulation.chip.slowed')}</span>}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? whyId : undefined}
        aria-label={t('sys.circulation.chip.info')}
        title={t('sys.circulation.chip.info')}
        onClick={() => setOpen((o) => !o)}
        // A small mark with a finger-sized target round it (the ::after), so it covers little of the body.
        data-hit=""
        className="relative grid size-5 place-items-center rounded-full font-semibold text-ink ring-1 ring-ink/15 hover:bg-surface-sunk"
      >
        i
      </button>
      {open && (
        <p id={whyId} className="basis-full text-ink">
          {t('sys.circulation.now.rate', { n })} · {who} · {t('sys.circulation.chip.speed')}.{' '}
          {t('sys.circulation.chip.why', { time: formatDuration(minute, t) })}
        </p>
      )}
    </div>
  )
}

/** The rows of the heart's "Why does the model differ from the book?" card (ui-ux §8.4; R9, R82, R86). */
export const WHY_ROWS = ['rest', 'run', 'after'] as const

/**
 * "Why does the model differ from the book?" for the heart (ui-ux §8.4, content-i18n §8.5): opened
 * from "Why different? ›" by the book's line. One row per difference (the book's value, the
 * model's, why), then "In the exam, write the book's value." and a question to discuss.
 */
function WhyCard() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const cardId = useId()
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="self-start font-semibold text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
      >
        {t('sys.circulation.why.open')}
      </button>
      {open && (
        <section
          id={cardId}
          data-why="circulation"
          aria-label={t('sys.circulation.why.title')}
          className="rounded-control bg-surface-sunk p-2 text-ink"
        >
          <h3 className="font-semibold">{t('sys.circulation.why.title')}</h3>
          <dl className="mt-1 flex flex-col gap-1.5">
            {WHY_ROWS.map((row) => (
              <div key={row} data-why-row={row}>
                <dt className="font-semibold">{t(`sys.circulation.why.${row}.what`)}</dt>
                <dd>
                  {t('sys.circulation.why.book')}: {t(`sys.circulation.why.${row}.book`)}
                </dd>
                <dd>
                  {t('sys.circulation.why.model')}: {t(`sys.circulation.why.${row}.model`)}
                </dd>
                <dd className="text-ink-muted">
                  {t('sys.circulation.why.reason')}: {t(`sys.circulation.why.${row}.why`)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-1 font-semibold">{t('sys.circulation.why.exam')}</p>
          <p className="text-ink-muted">{t('sys.circulation.why.ask')}</p>
        </section>
      )}
    </>
  )
}

/**
 * Where blood goes, beside a kept plan: one flow at a time against its kept ghost (ui-ux §7),
 * "Show: Gut | Muscles", as two toggle buttons.
 */
function FlowPick({ pick }: { pick: SlotPick }) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('sys.circulation.pick.label')} data-flow-pick={pick.at} className="flex items-center gap-1">
      <span>{t('sys.circulation.pick.label')}:</span>
      {(['gut', 'muscle'] as const).map((k, i) => (
        <button
          key={k}
          type="button"
          aria-pressed={pick.at === i}
          onClick={() => pick.set(i)}
          className="rounded-full px-2 py-0.5 font-semibold text-ink ring-1 ring-ink/20 aria-pressed:bg-ink aria-pressed:text-white"
        >
          {t(`sys.circulation.pick.${k}`)}
        </button>
      ))}
    </div>
  )
}

/**
 * The lines under each Heart & blood graph (ui-ux §6, §7, R10, R29, R57): what moves it; under heart
 * beats a minute also the older NCERT Class 7 book's 72–80 with "Why different? ›" and the key to the
 * children's band; under blood pumped a minute the blood-pressure card (a book value, held, not
 * worked out); under where blood goes, beside a kept plan, which flow is shown.
 */
function StripNote({ slot, pick }: { slot: GraphSlotDef; pick?: SlotPick }) {
  const { t } = useTranslation()
  return (
    <div data-strip-note={slot.id} className="flex flex-col gap-0.5 text-caption text-ink-muted">
      {pick && <FlowPick pick={pick} />}
      {/* A short window keeps its plot: the summary says the same. */}
      <p className="[@media(height<42.5rem)]:hidden">{t('sys.circulation.moves')}</p>
      {slot.reference && (
        <>
          <p data-book="" className="flex flex-wrap gap-x-2">
            <span>{t('sys.circulation.book')}</span>
          </p>
          <WhyCard />
          <p data-band-key="" className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="shrink-0"
              style={{ width: 20, height: 10, background: 'color-mix(in srgb, var(--color-ink) 10%, transparent)' }}
            />
            {t('sys.circulation.children')}
          </p>
        </>
      )}
      {slot.id === 'pumped' && (
        // A constant is a card, never a graph (ui-ux §6, R13): value · held · why · source line.
        <p data-bp-card="" className="text-ink">
          <strong className="font-semibold">{t('sys.circulation.bp.value')}</strong> {t('sys.circulation.bp.held')}{' '}
          <span className="text-ink-muted">{t('sys.circulation.bp.source')}</span>
        </p>
      )}
    </div>
  )
}

/** Heart & blood's moment: the minute the most blood goes to the gut after a meal (none for water or a fasting rest). */
function moments(run: RunResult) {
  const m = run.moments.get('event.gutFlowPeak' as never)
  return m?.atMin != null && m.atMin <= run.horizonMin ? [{ id: 'event.gutFlowPeak' as never, atMin: m.atMin }] : []
}

const CIRCULATION_UI: SystemUi = {
  now: NowLine,
  summary: circulationSummary,
  stripSummary: circulationStripSummary,
  // Its own moment; the bouts' starts and ends the stage adds for every system (lib/moments.ts).
  moments,
  chip: RhythmChip,
  note: StripNote,
  lessons: [CIRCULATION_LESSON],
}

const UIS = { circulation: CIRCULATION_UI }
export default UIS
export { DEFS }
