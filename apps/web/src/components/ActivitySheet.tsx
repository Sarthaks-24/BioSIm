import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActivityBout } from '@lifepeek/engine'
import { addEnglish } from '../i18n/index.ts'
import { Segmented } from './kit/index.ts'
import activityText from 'virtual:lifepeek-en/activity'

// The sheet's own English comes with it (the stage keeps only a bout's chip words).
addEnglish(activityText)

/**
 * The Activity half of the meal sheet (E-3b-ui, ui-ux §5; architecture §0). Loaded the first time
 * it is shown (R71/R74: the pack-manifest's lazy tier, never the precache). Ready plans first, one
 * tap each; then "Make your own": What · From · How long. The choices are the frozen ones: walk,
 * brisk walk, run; from 0:00 to 5:50 in 10-minute steps; 5, 10, 20, 30 or 60 minutes; at most 3
 * bouts, none overlapping. A choice that can't be made says why. No bout is "Resting".
 * A link may hold bouts outside these choices (codec: up to 8, start to 48 h, 5–120 min); they
 * are drawn and named, and here they can only be removed ("Made by a link").
 */

type Kind = 'walk' | 'walkBrisk' | 'run'
const KINDS: readonly Kind[] = ['walk', 'walkBrisk', 'run']
const LENGTHS = [5, 10, 20, 30, 60] as const
/** 0:00 to 5:50 in 10-minute steps. */
const STARTS = Array.from({ length: 36 }, (_, i) => i * 10)

/** The three ready plans; the second is named "Brisk walk home" (ui-ux §5). */
const PLANS: readonly { bout: ActivityBout; home?: true }[] = [
  { bout: { kind: 'walk', startMin: 30, durMin: 20 } },
  { bout: { kind: 'walkBrisk', startMin: 120, durMin: 20 }, home: true },
  { bout: { kind: 'run', startMin: 30, durMin: 10 } },
]

/** Whether the sheet itself could have made this bout (else a link did). */
const offered = (b: ActivityBout) =>
  (KINDS as readonly string[]).includes(b.kind) && STARTS.includes(b.startMin) && (LENGTHS as readonly number[]).includes(b.durMin)

const overlaps = (a: ActivityBout, b: ActivityBout) => a.startMin < b.startMin + b.durMin && b.startMin < a.startMin + a.durMin

/**
 * What the sheet gets from the stage (components/stage/AddFoodSheet.tsx): the plan and how to change
 * it, and the stage's own bout words. As props, so this lazy file imports none of the stage's code.
 */
interface Props {
  /** The bout being changed (its place in the plan); none: adding. */
  edit?: number
  /** The most bouts the sheet adds. */
  max: number
  bouts: readonly ActivityBout[]
  setBouts: (bouts: readonly ActivityBout[]) => void
  /** "Walk 20 min, from 0:30" (the chip's words). */
  label: (b: ActivityBout) => string
  /** "0:30" */
  clock: (min: number) => string
  emoji: Readonly<Record<string, string>>
  onDone: () => void
}

export default function ActivitySheet({ edit, max, bouts, setBouts, label, clock, emoji, onDone }: Props) {
  const { t } = useTranslation()
  const editing = edit != null ? bouts[edit] : undefined
  const [kind, setKind] = useState<Kind>(editing && (KINDS as readonly string[]).includes(editing.kind) ? (editing.kind as Kind) : 'walk')
  const [startMin, setStart] = useState(editing && STARTS.includes(editing.startMin) ? editing.startMin : 30)
  const [durMin, setDur] = useState<number>(editing && (LENGTHS as readonly number[]).includes(editing.durMin) ? editing.durMin : 20)
  const [why, setWhy] = useState<string | null>(null)
  const first = useRef<HTMLDivElement>(null)
  const fromId = useId()

  // The focus goes to the first thing to choose (the dialog keeps it inside; Esc and Back close it).
  useEffect(() => first.current?.querySelector<HTMLElement>('button, select')?.focus(), [])

  /** Adds `bout` (or puts it in place of the one being changed); says why not when it can't. */
  const put = (bout: ActivityBout) => {
    const others = bouts.filter((_, i) => i !== edit)
    if (edit == null && others.length >= max) return setWhy(t('activity.full', { n: max }))
    const clash = others.find((b) => overlaps(b, bout))
    if (clash) return setWhy(t('activity.overlap', { bout: label(clash) }))
    setBouts([...others, bout])
    onDone()
  }
  const remove = () => {
    setBouts(bouts.filter((_, i) => i !== edit))
    onDone()
  }

  const heading = 'text-caption font-semibold text-ink-muted'
  const base = 'flex min-h-11 items-center gap-2 rounded-control px-3 text-left text-control font-semibold lg:min-h-9'
  const button = `${base} bg-surface-sunk hover:bg-surface-sunk-hover`
  return (
    <div ref={first} data-activity-sheet="" className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
      {editing && !offered(editing) ? (
        // A link's bout this sheet could not make: named, and only removed here.
        <section className="flex flex-col items-start gap-2">
          <p className="text-control font-semibold">{label(editing)}</p>
          <p className="text-caption text-ink-muted">{t('activity.fromLink')}</p>
          <button type="button" onClick={remove} className={button}>
            {t('activity.remove')}
          </button>
        </section>
      ) : (
        <>
          {edit == null && (
            <section aria-labelledby={`${fromId}-plans`} className="flex flex-col gap-1.5">
              <h3 id={`${fromId}-plans`} className={heading}>
                {t('activity.plans')}
              </h3>
              <ul className="flex flex-col items-start gap-1.5">
                {PLANS.map(({ bout, home }) => (
                  <li key={bout.kind} className="max-w-full">
                    <button type="button" data-plan={bout.kind} onClick={() => put(bout)} className={button}>
                      <span aria-hidden="true">{emoji[bout.kind]}</span>
                      {home ? t('activity.home', { min: bout.durMin, start: clock(bout.startMin) }) : label(bout)}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby={`${fromId}-own`} className="flex flex-col gap-2">
            <h3 id={`${fromId}-own`} className={heading}>
              {edit == null ? t('activity.own') : label(editing!)}
            </h3>
            <Segmented
              label={t('activity.what')}
              options={KINDS.map((k) => ({ id: k, label: t(`activity.kinds.${k}`) }))}
              value={kind}
              onChange={(k) => {
                setKind(k)
                setWhy(null)
              }}
            />
            <label className="flex flex-wrap items-center gap-2 text-control">
              <span className="font-semibold">{t('activity.from')}</span>
              <select
                value={startMin}
                onChange={(e) => {
                  setStart(Number(e.target.value))
                  setWhy(null)
                }}
                className="tabular min-h-11 rounded-control bg-surface-sunk px-2 font-semibold lg:min-h-9"
              >
                {STARTS.map((m) => (
                  <option key={m} value={m}>
                    {clock(m)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-control font-semibold">{t('activity.howLong')}</span>
              <Segmented
                label={t('activity.howLong')}
                options={LENGTHS.map((n) => ({ id: String(n), label: n }))}
                value={String(durMin)}
                onChange={(n) => {
                  setDur(Number(n))
                  setWhy(null)
                }}
              />
            </div>
            <span className="flex flex-wrap gap-2">
              <button type="button" data-put="" onClick={() => put({ kind, startMin, durMin })} className={`${base} bg-ink text-white`}>
                {t(edit == null ? 'activity.addButton' : 'activity.save')}
              </button>
              {edit != null && (
                <button type="button" onClick={remove} className={button}>
                  {t('activity.remove')}
                </button>
              )}
            </span>
            {why && (
              <p role="alert" className="text-caption font-semibold text-ink">
                {why}
              </p>
            )}
          </section>
        </>
      )}
      {edit == null && (
        <section aria-labelledby={`${fromId}-yours`} className="flex flex-col gap-1">
          <h3 id={`${fromId}-yours`} className={heading}>
            {t('activity.yours')}
          </h3>
          {bouts.length ? (
            <ul className="flex flex-col gap-0.5 text-control">
              {bouts.map((b) => (
                <li key={`${b.kind}.${b.startMin}.${b.durMin}`}>{label(b)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-control text-ink-muted">{t('activity.resting')}</p>
          )}
        </section>
      )}
      {/* What the bouts move, and what they don't (R10 as R75 corrected it). */}
      <p className="text-caption text-ink-muted">{t('activity.moves')}</p>
    </div>
  )
}
