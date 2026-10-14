import { useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActiveSignalId, type RunResult } from '@lifepeek/engine'
import { StatusTag } from '../../components/kit/index.ts'
import { BONES_TONE } from '../../anatomy/tones/bones.ts'
import { useClock } from '../../state/clock.ts'
import type { SystemParts } from '../load.ts'
import type { GraphSlotDef, NowProps, SystemUi } from '../registry.ts'
import { doingAt, restOf, seriesOf, timesRest, valueText } from './effort.ts'
import { MUSCLES_LESSON, SKIN_LESSON } from './lesson.ts'
import { effortStripSummary, musclesSummary, skinSummary } from './summary.ts'

/**
 * The `effort` pack's words, graphs and cards (U-1; ui-ux §6, §7), loaded with the pack when one of
 * its systems is first lit (systems/load.ts): Muscles (energy used by muscles, in times its resting
 * energy in words, never kcal on the body), Skin & temperature (sweat made, the thermometer card
 * "kept within a narrow range": body temperature is held, not worked out) and the Bones card
 * (Drawing only). Muscles and skin move only with walking or running (R75): their graphs and
 * summaries say so. Nothing here is ever red or an alarm (ui-ux §7). It shares no code with the
 * stage but the meal clock's and the kit's status tag (flat/layerKit.ts says why).
 */

const MUSCLE = 'muscle.energyRate'
const SWEAT = 'skin.sweatRate'
/** The pack's signal IDs in a slot (the lean catalog's ActiveSignalId does not list them). */
const id = (s: string) => s as ActiveSignalId

/** The rest of each row (systems/muscles/row.ts): one graph each, every line a "Model estimate" (model D9). */
const DEFS: { muscles: SystemParts; skin: SystemParts } = {
  muscles: {
    slots: [{ id: 'energy', tab: 'sys.effort.muscles.strip', signals: [id(MUSCLE)], unit: 'kcal/h' }],
    knownLimits: ['limits.activityMet'],
  },
  skin: {
    slots: [{ id: 'sweat', tab: 'sys.effort.skin.strip', signals: [id(SWEAT)], unit: 'mL/h' }],
    knownLimits: ['limits.activityMet'],
  },
}

/** A value of the run at the clock's minute, mapped by `pick`; re-renders only when that changes. */
function useAtClock<T>(run: RunResult | null, signal: string, pick: (v: number, start: number) => T): T | null {
  return useClock(
    useCallback(
      (s: { simMin: number }) => {
        const series = run && seriesOf(run, signal)
        return series ? pick(valueAt(series, s.simMin, run.stepMin), restOf(series)) : null
      },
      [run, signal], // eslint-disable-line react-hooks/exhaustive-deps -- `pick` is a module-level function
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

/** The organ's pill: the same dark pill as Digestion's organ, here not a button. */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pr-2 pl-2.5 align-baseline font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(20_33_61/0.3)]'

/** A Now line: "[Muscles] about 15× their resting energy · walking", and the kept plan's at the same minute. */
function Now({
  system,
  organ,
  text,
  kept,
  run,
  className = '',
}: {
  system: string
  organ: string
  text: string
  kept: string | null
  run: RunResult
  className?: string
}) {
  const { t } = useTranslation()
  const band = useDoing(run)
  return (
    <div data-now={system} className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <p>
        <span className="sr-only">{t('now.label')}: </span>
        <span className={`${PILL} mr-2`}>{organ}</span>
        <span className="font-semibold">{text}</span>
        <span className="text-ink-muted"> · {t(`sys.effort.doing.${band}`)}</span>
      </p>
      {kept && (
        <p data-now-kept="" className="mt-0.5 flex items-baseline gap-2 text-caption text-ink-muted lg:text-control">
          <span className="relative -top-[0.2em] shrink-0">
            <KeptSwatch />
          </span>
          {kept}
        </p>
      )}
    </div>
  )
}

const times = (v: number, rest: number) => timesRest(v, rest)

/** Muscles' Now line: how many times their resting energy at the clock's minute. */
function MusclesNow({ run, kept, className }: NowProps) {
  const { t } = useTranslation()
  const k = useAtClock(run, MUSCLE, times)
  const keptK = useAtClock(kept, MUSCLE, times)
  const say = (n: number | null, rest: string, more: string) => (n == null ? '' : n > 1 ? t(more, { k: n }) : t(rest))
  return (
    <Now
      system="muscles"
      run={run}
      organ={t('sys.effort.muscles.now.organ')}
      text={say(k, 'sys.effort.muscles.now.rest', 'sys.effort.muscles.now.times')}
      kept={kept && keptK != null ? say(keptK, 'sys.effort.muscles.now.keptRest', 'sys.effort.muscles.now.kept') : null}
      className={className}
    />
  )
}

/** Sweat an hour at the clock's minute, rounded as its row says (10 mL an hour); 0 when there is none. */
const sweatShown = (v: number) => (v < 5 ? 0 : Math.round(v / 10) * 10)

/** Skin's Now line: "[Skin] about 330 mL an hour of sweat · walking", or no sweat from moving. */
function SkinNow({ run, kept, className }: NowProps) {
  const { t, i18n } = useTranslation()
  const ml = useAtClock(run, SWEAT, sweatShown)
  const keptMl = useAtClock(kept, SWEAT, sweatShown)
  const meta = seriesOf(run, SWEAT)?.meta
  const value = (n: number) => (meta ? valueText(n, meta, t, i18n.language) : '')
  return (
    <Now
      system="skin"
      run={run}
      organ={t('sys.effort.skin.now.organ')}
      text={ml ? t('sys.effort.skin.now.rate', { value: value(ml) }) : t('sys.effort.skin.now.none')}
      kept={
        kept && keptMl != null
          ? keptMl
            ? t('sys.effort.skin.now.kept', { value: value(keptMl) })
            : t('sys.effort.skin.now.keptNone')
          : null
      }
      className={className}
    />
  )
}

/**
 * The thermometer card (ui-ux §7; model §2.9): "Body temperature: kept within a narrow range", over
 * skin's graph (not over the body: the body's picture stays uncovered on a phone and a projector).
 * The model holds it; it is never worked out, graphed or coloured red, and never an alarm. ⓘ says
 * why: sweat takes the extra heat of moving away.
 */
function Thermometer() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const whyId = useId()
  return (
    <div data-thermometer="" className="flex flex-wrap items-center gap-x-1.5 text-caption text-ink-muted lg:text-control">
      {/* A plain thermometer in ink with a cool blue bulb: the same whatever the walk or run. */}
      <svg viewBox="0 0 10 20" width="10" height="20" aria-hidden="true" focusable="false" className="shrink-0 text-ink">
        <path d="M3.4 2.5a1.6 1.6 0 0 1 3.2 0v9.4a3.4 3.4 0 1 1-3.2 0z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="5" cy="15" r="2.2" fill="#3f6f99" />
        <path d="M5 13V6" stroke="#3f6f99" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <strong className="font-semibold text-ink">{t('sys.effort.skin.thermo.title')}:</strong>{' '}
      <span>{t('sys.effort.skin.thermo.text')}</span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? whyId : undefined}
        aria-label={t('sys.effort.skin.thermo.info')}
        title={t('sys.effort.skin.thermo.info')}
        onClick={() => setOpen((o) => !o)}
        data-hit=""
        className="relative grid size-5 place-items-center rounded-full font-semibold text-ink ring-1 ring-ink/15 hover:bg-surface-sunk"
      >
        i
      </button>
      {open && (
        <p id={whyId} className="basis-full text-ink">
          {t('sys.effort.skin.thermo.why')}
        </p>
      )}
    </div>
  )
}

/** The lines under a graph (ui-ux §6, R75): what moves it (only walking or running); under sweat, the thermometer card and what sweat is. */
function StripNote({ slot }: { slot: GraphSlotDef }) {
  const { t } = useTranslation()
  return (
    <div data-strip-note={slot.id} className="flex flex-col gap-0.5 text-caption text-ink-muted">
      {slot.id === 'sweat' && <Thermometer />}
      <p data-moves="">{t('sys.effort.moves')}</p>
      {slot.id === 'sweat' && <p className="[@media(height<42.5rem)]:hidden">{t('sys.effort.skin.notFat')}</p>}
    </div>
  )
}

/** Bones' Now line: what bones do, tagged "Drawing only" (R11, R13). Nothing in it moves with the clock. */
function BonesNow({ className = '' }: NowProps) {
  const { t } = useTranslation()
  return (
    <p data-now="bones" className={`text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <span className="mr-2 inline-block" style={{ verticalAlign: '-0.1em' }}>
        <StatusTag status="illustration" />
      </span>
      {t('sys.effort.bones.now')}
    </p>
  )
}

/**
 * The Bones card (model §2.8, anatomy plan §2.6), in the graphs' place: "Bones don't change during
 * one meal or one game", Drawing only, with the two joints the picture marks drawn small (a ball in
 * its socket, a hinge) and how muscles move bones. Styles only this card uses are inline (the stage's
 * CSS stays as it is).
 */
function BonesCard() {
  const { t } = useTranslation()
  const { bone, joint, cartilage } = BONES_TONE
  const titleId = useId()
  return (
    <section data-card="bones" aria-labelledby={titleId} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-ink">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={titleId} className="text-title font-extrabold">
          {t('sys.effort.bones.card.title')}
        </h3>
        <StatusTag status="illustration" />
      </header>
      <p data-bones-text="" className="text-control font-semibold">
        {t('sys.effort.bones.card.text')}
      </p>
      <svg
        viewBox="0 0 240 90"
        aria-hidden="true"
        focusable="false"
        className="w-full text-ink"
        style={{ flex: '0 1 9rem', minHeight: '3rem' }}
      >
        {/* Ball-and-socket: the thigh bone's round head in the hip's cup. */}
        <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M20 22c14-14 50-14 64 0l-8 8c-10-9-38-9-48 0z" fill={bone} />
          <circle cx="52" cy="40" r="15" fill={bone} />
          <circle cx="52" cy="40" r="19" fill="none" stroke={joint} strokeWidth="2.5" />
          <path d="M44 53l-6 32h22l-4-32" fill={bone} />
        </g>
        {/* Hinge: thigh bone over shin bone, the joint between them bending one way. */}
        <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M170 4h20v34c0 6-20 6-20 0z" fill={bone} />
          <path d="M168 46h24v4h-24z" fill={cartilage} />
          <path d="M170 54c0-6 20-6 20 0v32h-20z" fill={bone} />
          <path d="M162 46h36" stroke={joint} strokeWidth="2.5" />
          <path d="M208 30a24 24 0 0 1 0 36" fill="none" stroke={joint} strokeWidth="2" strokeDasharray="3 3" />
        </g>
      </svg>
      <p className="text-control">{t('sys.effort.bones.card.joints')}</p>
      <p className="text-caption text-ink-muted">{t('sys.effort.bones.card.tendons')}</p>
    </section>
  )
}

const moments = () => []

const MUSCLES_UI: SystemUi = {
  now: MusclesNow,
  summary: musclesSummary,
  stripSummary: effortStripSummary,
  // Its moments are the bouts' starts and ends, which the stage adds for every system (lib/moments.ts).
  moments,
  note: StripNote,
  lessons: [MUSCLES_LESSON],
}

const SKIN_UI: SystemUi = {
  now: SkinNow,
  summary: skinSummary,
  stripSummary: effortStripSummary,
  moments,
  note: StripNote,
  lessons: [SKIN_LESSON],
}

const BONES_UI: SystemUi = {
  now: BonesNow,
  summary: () => null,
  stripSummary: () => null,
  moments,
  card: BonesCard,
}

const UIS = { muscles: MUSCLES_UI, skin: SKIN_UI, bones: BONES_UI }
export default UIS
export { DEFS }
