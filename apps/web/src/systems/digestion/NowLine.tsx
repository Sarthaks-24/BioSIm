import { useCallback, useMemo, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { activeStage, type RunResult, type StageId } from '@lifepeek/engine'
import { ORGAN_TONE } from '../../anatomy/tones/digestion.ts'
import { isDrinkOnly } from './summary.ts'
import { nowKey, nowKeysOf, nowWhere, parseNowKey, type Amount, type NowWhere } from './nowWhere.ts'
import { useClock } from '../../state/clock.ts'
import { useRunStore } from '../../state/run.ts'
import { LineSwatch, UnkeepButton } from '../../components/stage/KeptTag.tsx'
import { mealNames, shortMealNames } from '../../components/stage/mealText.ts'
import type { NowProps } from '../registry.ts'

/**
 * The organ the body lights (activeStage), for the full stage text ("More").
 * Re-renders only when the stage changes, not every frame.
 */
export function useNowStage(run: RunResult): StageId {
  return useClock(useCallback((s) => activeStage(run, s.simMin), [run]))
}

/** Where the meal is now, in words (nowWhere.ts). Re-renders only when the words change. */
function useNowWhere(run: RunResult | null): NowWhere | null {
  const key = useClock(useCallback((s) => (run ? nowKey(nowWhere(run, s.simMin)) : ''), [run]))
  return useMemo(() => (key ? parseNowKey(key) : null), [key])
}

/** The organ's colour on the body, as a small dot inside the pill (the mouth is not drawn lit). */
export const toneOf = (stage: StageId) => (stage === 'mouth' ? null : ORGAN_TONE[stage])

/** The ink pill the body uses for the organ the food is in. As a button it opens "More". */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full bg-ink py-0.5 pr-2 pl-2.5 align-baseline font-semibold whitespace-nowrap text-white shadow-[0_1px_2px_rgb(20_33_61/0.3)] lg:pr-2.5'

/** A right-pointing chevron, drawn like the kit's icons (it turns down while "More" is open). */
function Chevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-90' : ''} ${className}`}
    >
      <path d="m8 5.5 4.5 4.5L8 14.5" />
    </svg>
  )
}

const amount = (a: Amount, t: TFunction) => t(`now.amount.${a}`)

/**
 * The words after the pill: "about half is here · some already in the small intestine".
 * Before the stomach, what is happening (a drink is drunk, not chewed); after the gut, "done".
 */
function whereText(w: NowWhere, drink: boolean, t: TFunction): string {
  if (w.kind === 'before') return drink ? t(`now.drink.${w.stage}`) : t(`now.stages.${w.stage}`)
  if (w.kind === 'done') return t(w.restLeft ? 'now.done' : 'now.doneAll', { amount: amount(w.body, t) })
  const here = t('now.here', { amount: amount(w.here, t) })
  return w.also ? `${here} · ${t(`now.also.${w.also.place}`, { amount: amount(w.also.amount, t) })}` : here
}

/** The kept meal's place, short: "most in the stomach", "being drunk", "the gut is finished with it". */
function keptText(w: NowWhere, drink: boolean, t: TFunction): string {
  if (w.kind !== 'gut') return w.stage === 'mouth' ? t(drink ? 'now.in.mouthDrink' : 'now.in.mouth') : t(`now.in.${w.stage}`)
  return t(`now.in.${w.stage}`, { amount: amount(w.here, t) })
}

/**
 * What the organ does (v1's step-by-step, one line), for a drink where it differs. None before the
 * stomach (the first row already says what happens) and none once done.
 */
const jobText = (stage: NowWhere['stage'], drink: boolean, t: TFunction) =>
  stage === 'mouth' || stage === 'esophagus' || stage === 'done'
    ? ''
    : drink && stage === 'stomach'
      ? t('now.drink.stomach')
      : t(`now.stages.${stage}`)

interface PillProps {
  w: NowWhere
  open: boolean
  /** Absent for the invisible copies that only hold the room (no buttons there). */
  onToggle?: () => void
  pillRef?: RefObject<HTMLButtonElement | null>
  panelId?: string
  drink: boolean
}

/** One version of the first row: the organ pill, where the meal is, and (from 1024 px up) "More ›". */
function WhereRow({ w, open, onToggle, pillRef, panelId, drink }: PillProps) {
  const { t } = useTranslation()
  const tone = w.kind === 'done' ? null : toneOf(w.stage)
  const name = w.kind === 'done' ? t('now.doneName') : t(`stages.${w.stage}.short`)
  const live = !!onToggle
  const Pill = live ? 'button' : 'span'
  const More = live ? 'button' : 'span'
  const control = live
    ? { type: 'button' as const, 'aria-expanded': open, 'aria-controls': open ? panelId : undefined, onClick: onToggle }
    : {}
  return (
    <>
      {live && <span className="sr-only">{t('now.label')}: </span>}
      <Pill
        {...control}
        ref={live ? pillRef : undefined}
        aria-label={live ? t('now.moreAbout', { stage: name }) : undefined}
        className={`${PILL} mr-2 ${live ? 'hover:bg-ink/85' : ''}`}
      >
        {tone && <span aria-hidden="true" className="size-2 rounded-full ring-1 ring-white/60" style={{ background: tone }} />}
        {name}
        {/* On a phone the pill is the only way in, so it shows that it opens. */}
        <Chevron open={open} className="lg:hidden" />
      </Pill>
      <span className="font-semibold">{whereText(w, drink, t)}</span>{' '}
      {/* The mouse's second way in, from 1024 px up; keyboards and screen readers use the pill (one stop). */}
      <More
        {...control}
        tabIndex={live ? -1 : undefined}
        className="-my-1 inline-flex items-center gap-0.5 rounded-control px-1.5 py-1 align-baseline font-semibold whitespace-nowrap text-ink underline decoration-ink/30 underline-offset-4 hover:bg-surface-sunk hover:decoration-ink max-lg:hidden"
      >
        {t('now.more')}
        <Chevron open={open} />
      </More>
    </>
  )
}

/**
 * The Now line (WP-14, council verdict #4; round 2 C1): the main teaching text of the stage. It
 * says where the meal is, from the model's own numbers, and follows the meal clock:
 *   [● Stomach ›] about half is here · some already in the small intestine   More ›
 *   acid and churning turn food into chyme                                (from 1024 px up)
 *   - - Cheeseburger + French fries (kept): most in the stomach           (with a kept meal)
 * The organ is the same dark pill the body lights it with, and it is the button that opens the
 * full stage text ("More"). A drink is drunk, not chewed, and is not turned into chyme. Once the
 * gut has finished with the meal the pill says "Done" (review 14-17: never "Stomach" at 30 h).
 *
 * Every row keeps the height of its longest version (invisible copies in the same grid cell), so
 * the body never jumps while playing. On a phone the kept row also stands in for the meal bar's
 * kept tag (styles.css): it names the kept meal and has its ✕ (WP-18). Digestion's `SystemUi.now` (W-1).
 */
export function NowLine({ run, kept, open, onToggle, moreRef, panelId, className = '' }: NowProps) {
  const { t, i18n } = useTranslation()
  const w = useNowWhere(run)!
  const keptWhere = useNowWhere(kept)
  const keptItems = useRunStore((s) => s.kept?.items)
  const drink = isDrinkOnly(run.meal)
  const keptDrink = !!kept && isDrinkOnly(kept.meal)
  const job = jobText(w.stage, drink, t)
  // Everything this run's line will say (a few dozen versions), laid out invisibly in the same
  // grid cell as the live row: the row is always as tall as its longest version, so the body
  // above never jumps while playing, and no taller than this meal needs.
  const versions = useMemo(() => nowKeysOf(run).map(parseNowKey), [run])
  const jobs = useMemo(() => [...new Set(versions.map((v) => v.stage))], [versions])
  // The kept meal's row holds its longest version the same way (it goes from "being eaten" to
  // "the gut is finished with it", and may wrap differently in Hindi or on the projector).
  const keptName = keptItems ? t('now.kept', { meal: shortMealNames(keptItems, i18n.language) }) : ''
  const keptVersions = useMemo(
    () => (kept ? [...new Set(nowKeysOf(kept).map((k) => keptText(parseNowKey(k), keptDrink, t)))] : []),
    [kept, keptDrink, t],
  )
  const cell = 'col-start-1 row-start-1'
  return (
    <div data-now={w.stage} className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      <div className="grid">
        {versions.map((v, i) => (
          <p key={i} aria-hidden="true" className={`invisible ${cell}`}>
            <WhereRow w={v} open={false} drink={drink} />
          </p>
        ))}
        <p className={cell}>
          <WhereRow w={w} open={open} onToggle={onToggle} pillRef={moreRef} panelId={panelId} drink={drink} />
        </p>
      </div>
      {/* What the organ does: a quieter second row where there is room (not on a phone or the projector). */}
      <div className="grid text-ink-muted max-lg:hidden in-data-[contrast=high]:hidden">
        {jobs.map((s) => (
          <p key={s} aria-hidden="true" className={`invisible ${cell}`}>
            {jobText(s, drink, t)}
          </p>
        ))}
        <p data-now-job="" className={cell}>
          {job}
        </p>
      </div>
      {keptWhere && keptItems && (
        // The kept meal at the same minute (council round 2: the body no longer said where it was).
        <p data-now-kept={keptWhere.stage} className="mt-0.5 flex items-baseline gap-2 text-caption text-ink-muted lg:text-control">
          <span className="relative -top-[0.2em] shrink-0">
            <LineSwatch kept />
          </span>
          <span className="grid">
            {keptVersions.map((v) => (
              <span key={v} aria-hidden="true" className={`invisible ${cell}`}>
                <span className="max-lg:hidden">{keptName}</span>
                <span className="lg:hidden">{t('now.keptShort')}</span> <span className="font-semibold">{v}</span>
              </span>
            ))}
            <span className={cell}>
              {/* On a phone just "Kept:": the summary above and the graph's legend below name it (WP-18). */}
              <span className="max-lg:sr-only">{keptName}</span>
              <span aria-hidden="true" className="lg:hidden">
                {t('now.keptShort')}
              </span>{' '}
              <span className="font-semibold text-ink">{keptText(keptWhere, keptDrink, t)}</span>
            </span>
          </span>
          {/* On a phone this row stands in for the meal bar's kept tag (styles.css), so it has its ✕. */}
          <UnkeepButton meal={mealNames(keptItems, i18n.language)} className="-my-2.5 ml-auto self-center rounded-control lg:hidden" />
        </p>
      )}
    </div>
  )
}
