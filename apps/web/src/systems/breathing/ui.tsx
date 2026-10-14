import { useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActiveSignalId, type RunResult } from '@lifepeek/engine'
import CountYoursButton from '../../components/CountYoursButton.tsx'
import { formatDuration } from '../../lib/time.ts'
import { useClock } from '../../state/clock.ts'
import type { SystemParts } from '../load.ts'
import type { GraphSlotDef, NowProps, SystemUi } from '../registry.ts'
import { breathRate, countModel, doingAt, seriesOf } from './breath.ts'
import { breathingStripSummary, breathingSummary } from './summary.ts'

/**
 * Breathing's words, graphs and moments (U-2; ui-ux §4, §6, §7), loaded with the `breathing` pack
 * when the system is first lit (systems/load.ts): the Now line, the rhythm chip over the body, the
 * lines under its graphs, the summary and the graphs' sentences. It shares no code with the stage
 * but the meal clock's (a shared module would be split out of /sim into a chunk of its own).
 */

const RATE = 'lungs.breathRate'
/** The pack's signal IDs in a slot (the lean catalog's ActiveSignalId does not list them). */
const id = (s: string) => s as ActiveSignalId

/**
 * The rest of breathing's row (systems/breathing/row.ts): three graphs, every line a "Model
 * estimate" (model D9). Breaths a minute carries the children's band: most children aged 12–15
 * breathe 15–21 times a minute at rest (Fleming 2011, 10th–90th centile; confirmed R57).
 */
const DEFS: { breathing: SystemParts } = {
  breathing: {
    slots: [
      {
        id: 'breaths',
        tab: 'sys.breathing.strips.breaths',
        signals: [id(RATE)],
        unit: 'breaths/min',
        limits: ['limits.breathAdult'],
        reference: { low: 15, high: 21 },
      },
      { id: 'depth', tab: 'sys.breathing.strips.depth', signals: [id('lungs.tidalVolume')], unit: 'mL' },
      {
        id: 'gas',
        tab: 'sys.breathing.strips.gas',
        signals: [id('gas.o2UseRate'), id('gas.co2OutRate')],
        unit: 'mL/min',
        range: [0, 2500],
      },
    ],
    rhythms: [id(RATE)],
    knownLimits: ['limits.breathAdult'],
  },
}

/** The breaths a minute at the clock's minute, whole; re-renders only when that number changes. */
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

/** The kept line's sample: grey, dashed (components/stage/KeptTag.tsx LineSwatch). */
const KeptSwatch = () => (
  <svg viewBox="0 0 22 4" width="22" height="4" aria-hidden="true" focusable="false" className="shrink-0 overflow-visible">
    <line x1="1" y1="2" x2="21" y2="2" strokeWidth="3" className="stroke-kept [stroke-dasharray:var(--strip-kept-dash)]" />
  </svg>
)

/** The lungs' pill: the same dark pill as Digestion's organ, here not a button (breathing has no "More" yet). */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pr-2 pl-2.5 align-baseline font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(20_33_61/0.3)]'

/**
 * Breathing's Now line: "[Lungs] 24 a minute · walking", and the kept plan's rate at the same minute.
 * The number follows the meal clock; the words change only when a bout starts or ends.
 */
function NowLine({ run, kept, className = '' }: NowProps) {
  const { t } = useTranslation()
  const n = useRate(run)
  const keptN = useRate(kept)
  const band = useDoing(run)
  return (
    <div data-now="breathing" className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <p>
        <span className="sr-only">{t('now.label')}: </span>
        <span className={`${PILL} mr-2`}>{t('sys.breathing.now.organ')}</span>
        <span className="font-semibold">{t('sys.breathing.now.rate', { n })}</span>
        <span className="text-ink-muted"> · {t(`sys.breathing.doing.${band}`)}</span>
      </p>
      {kept && keptN != null && (
        // The kept plan at the same minute (the graph's legend names it).
        <p data-now-kept="" className="mt-0.5 flex items-baseline gap-2 text-caption text-ink-muted lg:text-control">
          <span className="relative -top-[0.2em] shrink-0">
            <KeptSwatch />
          </span>
          {t('sys.breathing.now.kept', { n: keptN })}
        </p>
      )}
    </div>
  )
}

/**
 * The rhythm chip over the body (ui-ux §4): "≋ 15 a minute · typical adult, resting · shown at its
 * true speed ⓘ". The number is the model's at the clock's minute (the breath is drawn at that rate,
 * at most 0.8 a second; faster says "animation slowed", everywhere, and the number stays true). ⓘ
 * opens the rest: who and what, and why the breath moves while the clock runs hours in seconds.
 * The body's room comes first (its gate: ≤ 10 % covered): a phone shows "≋ 15 ⓘ", a laptop "≋ 15 a
 * minute ⓘ" and the words only where the picture is big (from 1024 px up, not on the projector).
 */
function RhythmChip({ run }: { run: RunResult }) {
  const { t } = useTranslation()
  const n = useRate(run)
  const band = useDoing(run)
  const [open, setOpen] = useState(false)
  const minute = useClock((s) => (open ? Math.round(s.simMin) : 0))
  const whyId = useId()
  if (n == null) return null
  const who = t('sys.breathing.chip.who', { doing: t(`sys.breathing.doing.${band}`) })
  return (
    <div
      data-rhythm-chip={n}
      style={{ maxWidth: 'min(26rem, 90%)' }}
      className="pointer-events-auto flex flex-wrap items-center gap-x-1.5 rounded-control bg-surface-raised/90 px-1.5 text-caption text-ink-muted lg:text-control"
    >
      <strong className="font-semibold whitespace-nowrap text-ink">
        <span aria-hidden="true">≋ </span>
        <span className="lg:hidden">{n}</span>
        <span className="max-lg:hidden">{t('sys.breathing.now.rate', { n })}</span>
      </strong>
      <span className="max-lg:hidden in-data-[contrast=high]:hidden">
        · {who} · {t('sys.breathing.chip.speed')}
      </span>
      {breathRate(n).slowed && <span>· {t('sys.breathing.chip.slowed')}</span>}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? whyId : undefined}
        aria-label={t('sys.breathing.chip.info')}
        title={t('sys.breathing.chip.info')}
        onClick={() => setOpen((o) => !o)}
        // A small mark with a finger-sized target round it (the ::after), so it covers little of the body.
        data-hit=""
        className="relative grid size-5 place-items-center rounded-full font-semibold text-ink ring-1 ring-ink/15 hover:bg-surface-sunk"
      >
        i
      </button>
      {open && (
        <p id={whyId} className="basis-full text-ink">
          {t('sys.breathing.now.rate', { n })} · {who} · {t('sys.breathing.chip.speed')}.{' '}
          {t('sys.breathing.chip.why', { time: formatDuration(minute, t) })}
        </p>
      )}
    </div>
  )
}

/**
 * The lines under each breathing graph (ui-ux §6, R10, R29, R57): what moves it; under breaths a
 * minute also the older NCERT Class 7 book's 15–18 with "Count yours" beside it (X-2), and the key
 * to the children's band.
 */
function StripNote({ slot, run }: { slot: GraphSlotDef; run: RunResult }) {
  const { t } = useTranslation()
  // The timer's lines, made when it opens: the model's value at that minute of the meal clock.
  const countLines = () => {
    const m = countModel(run, useClock.getState().simMin)
    const model = !m
      ? ''
      : m.active
        ? t('sys.breathing.count.modelActive', { rest: m.rest, n: m.active.n, doing: t(`sys.breathing.doing.${m.active.doing}`) })
        : t('sys.breathing.count.model', { rest: m.rest })
    return { book: t('sys.breathing.book'), model, band: t('sys.breathing.children') }
  }
  return (
    <div data-strip-note={slot.id} className="flex flex-col gap-0.5 text-caption text-ink-muted">
      {/* A short window keeps its plot: the summary says the same. */}
      <p className="[@media(height<42.5rem)]:hidden">{t('sys.breathing.moves')}</p>
      {slot.reference && (
        <>
          <p className="flex flex-wrap items-center gap-x-2">
            <span data-book="">{t('sys.breathing.book')}</span>
            <CountYoursButton kind="breaths" lines={countLines} className="-my-2 lg:-my-1" />
          </p>
          <p data-band-key="" className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="shrink-0"
              style={{ width: 20, height: 10, background: 'color-mix(in srgb, var(--color-ink) 10%, transparent)' }}
            />
            {t('sys.breathing.children')}
          </p>
        </>
      )}
    </div>
  )
}

const BREATHING_UI: SystemUi = {
  now: NowLine,
  summary: breathingSummary,
  stripSummary: breathingStripSummary,
  // Its moments are the bouts' starts and ends, which the stage adds for every system (lib/moments.ts).
  moments: () => [],
  chip: RhythmChip,
  note: StripNote,
}

const UIS = { breathing: BREATHING_UI }
export default UIS
export { DEFS }
