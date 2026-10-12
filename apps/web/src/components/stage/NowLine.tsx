import { useCallback, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { STAGES, activeStage, type Simulation, type StageId } from '@lifepeek/engine'
import { ORGAN_TONE } from '../../anatomy/tones.ts'
import { useClock } from '../../state/clock.ts'

/**
 * Where most of the meal is now (activeStage, the same helper the body uses to light its organ).
 * Re-renders only when the stage changes, not every frame.
 */
export function useNowStage(run: Simulation): StageId {
  return useClock(useCallback((s) => activeStage(run, s.simMin), [run]))
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

interface LineProps {
  stage: StageId
  open: boolean
  /** Absent for the invisible copies that only hold the room (no buttons there). */
  onToggle?: () => void
  pillRef?: RefObject<HTMLButtonElement | null>
  panelId?: string
}

/** One stage's line: the organ pill, what it does, and (from 1024 px up) "More ›". */
function Line({ stage, open, onToggle, pillRef, panelId }: LineProps) {
  const { t } = useTranslation()
  const tone = toneOf(stage)
  const name = t(`stages.${stage}.short`)
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
      <span>{t(`now.stages.${stage}`)}</span>{' '}
      {/* The mouse's second way in, from 1024 px up; keyboards and screen readers use the pill (one stop). */}
      <More
        {...control}
        tabIndex={live ? -1 : undefined}
        className="-my-1 inline-flex items-center gap-0.5 rounded-control px-1.5 py-1 align-baseline font-semibold whitespace-nowrap text-ink underline decoration-ink/30 underline-offset-4 hover:bg-sunk2 hover:decoration-ink max-lg:hidden"
      >
        {t('now.more')}
        <Chevron open={open} />
      </More>
    </>
  )
}

/**
 * The Now line (WP-14, council verdict #4): the main teaching text of the stage. It says where
 * the food is and what that organ does, "Stomach  acid and churning turn food into chyme  More ›",
 * and follows the meal clock. The organ is the same dark pill the body lights it with, and it is
 * the button that opens the full stage text ("More"). These are v1's step-by-step texts
 * (`stages.*`), with one short line per stage written for this place (`now.stages.*`).
 *
 * Every stage's line is laid out in the same grid cell, all but the current one invisible, so the
 * line is always as tall as its longest stage: the body above never jumps while playing.
 */
export function NowLine({
  run,
  open,
  onToggle,
  moreRef,
  panelId,
  className = '',
}: {
  run: Simulation
  open: boolean
  onToggle: () => void
  /** The pill: "More" opens from it, and focus returns to it when the text closes. */
  moreRef: RefObject<HTMLButtonElement | null>
  panelId: string
  className?: string
}) {
  const stage = useNowStage(run)
  return (
    <div data-now={stage} className={`grid text-control text-ink lg:text-[1.0625rem] ${className}`}>
      {STAGES.filter((s) => s !== stage).map((s) => (
        <p key={s} aria-hidden="true" className="invisible col-start-1 row-start-1">
          <Line stage={s} open={false} />
        </p>
      ))}
      <p className="col-start-1 row-start-1">
        <Line stage={stage} open={open} onToggle={onToggle} pillRef={moreRef} panelId={panelId} />
      </p>
    </div>
  )
}
