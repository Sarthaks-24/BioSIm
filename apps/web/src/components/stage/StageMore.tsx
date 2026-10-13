import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { Simulation, StageId } from '@lifepeek/engine'
import { CloseIcon } from '../kit/index.ts'
import { addEnglish } from '../../i18n/index.ts'
import { useBackCloses } from '../../lib/backCloses.ts'
import stagesText from 'virtual:lifepeek-en/stages'
import Overlay from '../Overlay.tsx'
import { toneOf, useNowStage } from './NowLine.tsx'

// The full stage texts come with "More" (the stage itself keeps only the organs' names).
addEnglish(stagesText)

const WIDE = '(min-width: 64rem)'

interface Props {
  run: Simulation
  id: string
  /** "More", the button that opened it: focus goes back to it. */
  anchor: RefObject<HTMLButtonElement | null>
  /** The body's box: on a phone the sheet stays below it while that leaves the sheet room (Overlay `clear`). */
  body: RefObject<HTMLElement | null>
  onClose: () => void
}

/**
 * "More": the full text for the stage the food is in now (v1's step-by-step tab): what happens,
 * the chemistry, what is absorbed there, and one fact. Not a dialog that stops the stage: the rest
 * of it still works, and the text follows the clock.
 *
 * From 1024 px up a column at the right of the body pane: the body moves left to make room for it
 * (BodyPane), so it covers none of the body, its organs' labels or the food pieces' key (FP-5,
 * U4). On a phone a sheet from the bottom (Overlay), under the body while that leaves it room.
 * Esc, Back (lib/backCloses.ts) or "Close" closes it and puts focus back on "More".
 */
export default function StageMore({ run, id, anchor, body, onClose }: Props) {
  const { t } = useTranslation()
  const stage = useNowStage(run)
  const [wide, setWide] = useState(() => matchMedia(WIDE).matches)
  useEffect(() => {
    const mq = matchMedia(WIDE)
    const update = () => setWide(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const text = (
    <>
      <p className="max-w-[60ch]">{t(`stages.${stage}.what`)}</p>
      <dl className="mt-3 flex max-w-[60ch] flex-col gap-3">
        <div>
          <dt className="text-caption font-semibold text-ink-muted">{t('now.chemistry')}</dt>
          <dd>{t(`stages.${stage}.chemistry`)}</dd>
        </div>
        <div>
          <dt className="text-caption font-semibold text-ink-muted">{t('now.absorbed')}</dt>
          <dd>{t(`stages.${stage}.absorbed`)}</dd>
        </div>
      </dl>
      <p className="mt-3 max-w-[60ch] border-t border-border pt-3 text-ink-muted">{t(`stages.${stage}.fact`)}</p>
    </>
  )
  if (!wide)
    return (
      <Overlay anchor={anchor} onClose={onClose} label={t(`stages.${stage}.name`)} clear={body} modeless>
        <div id={id} data-stage-more={stage} className="text-control text-ink">
          {text}
        </div>
      </Overlay>
    )
  return (
    <Column id={id} stage={stage} onClose={onClose}>
      {text}
    </Column>
  )
}

/** From 1024 px up: the column beside the body, a rule on its left. */
function Column({ id, stage, onClose, children }: { id: string; stage: StageId; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  useBackCloses(onClose)
  const tone = toneOf(stage)
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-stage-more={stage}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        onClose()
      }}
      className="absolute inset-y-0 right-0 z-20 flex w-[min(25rem,46%)] flex-col overflow-hidden border-l border-border bg-surface-page"
    >
      <div className="flex items-start gap-2 border-b border-border py-2 pr-1.5 pl-4">
        <h3
          ref={heading}
          id={`${id}-title`}
          tabIndex={-1}
          className="flex min-w-0 flex-1 items-center gap-2 pt-1.5 text-title font-extrabold text-ink focus:outline-none"
        >
          {tone && <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: tone }} />}
          {t(`stages.${stage}.name`)}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('stage.close')}
          title={t('stage.close')}
          className="grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-sunk hover:text-ink lg:size-9"
        >
          <CloseIcon />
        </button>
      </div>
      {/* Reachable with Tab, so its text can be scrolled with keys (the stage leaves them to it: lib/keys.ts). */}
      <div data-scroll="" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 text-control text-ink">
        {children}
      </div>
    </section>
  )
}
