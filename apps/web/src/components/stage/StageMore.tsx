import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Simulation } from '@lifepeek/engine'
import { CloseIcon } from '../kit/index.ts'
import { addEnglish } from '../../i18n/index.ts'
import stagesText from 'virtual:lifepeek-en/stages'
import { toneOf, useNowStage } from './NowLine.tsx'

// The full stage texts come with "More" (the stage itself keeps only the organs' names).
addEnglish(stagesText)

/**
 * "More": the full text for the stage the food is in now (v1's step-by-step tab): what happens,
 * the chemistry, what is absorbed there, and one fact. It sits over the body pane, beside the
 * body from 1024 px up (the lit organ stays in view), over it on a phone. Not a dialog: the rest
 * of the stage still works, and it follows the clock. Esc or ✕ closes it and puts focus back on
 * "More".
 */
export default function StageMore({
  run,
  id,
  onClose,
  className = '',
}: {
  run: Simulation
  id: string
  onClose: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const stage = useNowStage(run)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
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
      className={`z-20 flex flex-col overflow-hidden border border-rule2 bg-shelf shadow-[0_6px_24px_-8px_rgb(20_33_61/0.35)] ${className}`}
    >
      <div className="flex items-start gap-2 border-b border-rule2 py-2 pr-1.5 pl-4">
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
          className="grid size-11 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-sunk2 hover:text-ink lg:size-9"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 text-control text-ink">
        <p className="max-w-[60ch]">{t(`stages.${stage}.what`)}</p>
        <dl className="mt-3 flex max-w-[60ch] flex-col gap-3">
          <div>
            <dt className="text-caption font-semibold text-ink-2">{t('now.chemistry')}</dt>
            <dd>{t(`stages.${stage}.chemistry`)}</dd>
          </div>
          <div>
            <dt className="text-caption font-semibold text-ink-2">{t('now.absorbed')}</dt>
            <dd>{t(`stages.${stage}.absorbed`)}</dd>
          </div>
        </dl>
        <p className="mt-3 max-w-[60ch] border-t border-rule2 pt-3 text-ink-2">{t(`stages.${stage}.fact`)}</p>
      </div>
    </section>
  )
}
