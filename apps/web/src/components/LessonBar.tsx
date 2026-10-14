import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import flagshipText from 'virtual:lifepeek-en/flagship'
import { addEnglish } from '../i18n/text.ts'
import { useProjector } from '../hooks/useProjector.ts'
import { pausesFor, type Pause } from '../lib/flagshipPauses.ts'
import { systemOf, type PackId } from '../systems/registry.ts'
import { useClock } from '../state/clock.ts'
import type { useLesson } from '../state/lesson.ts'
import type { useRunStore } from '../state/run.ts'
import type { useStripTab } from '../state/stripTab.ts'
import { CloseIcon, IconButton } from './kit/index.ts'
import Overlay from './Overlay.tsx'

addEnglish(flagshipText)

/** The stage's stores and pack loader, handed over by the body pane (no stage module is imported here). */
export interface LessonBarProps {
  lesson: typeof useLesson
  run: typeof useRunStore
  tabs: typeof useStripTab
  loadPack: (pack: PackId) => Promise<void> | null
  className?: string
}

/** Where typing or a dialog has the keys (the "?" sheet scrolls with Page Down). */
const OWN_KEYS = 'input, select, textarea, [contenteditable="true"], dialog, [role="dialog"]'

/** ‹ and ›, drawn like the kit's icons. */
const Chevron = ({ back = false }: { back?: boolean }) => (
  <svg
    viewBox="0 0 20 20"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className="shrink-0"
  >
    <path d={back ? 'M12 5.5 7.5 10l4.5 4.5' : 'm8 5.5 4.5 4.5L8 14.5'} />
  </svg>
)

/**
 * The flagship lesson's bar (X-1; ui-ux §8.1, content-i18n §8.2), in the Now line's place. Lazy (R71,
 * R74): downloaded when Home or Teach starts the lesson, with its words (`flagship.*`). It gets what
 * it does to the stage as props, so it shares no module with the stage.
 *
 * `Step 2 of 5 · Heart & blood` with Back, Next and End; from 1024 px up the question (in title type,
 * larger on the projector), then the book's line and the model's one sentence (book first, R9: the
 * book is named, never "your book"). On a phone one line, and "?" opens the question and answer in
 * a sheet. A presentation clicker's Page Down / Page Up are Next / Back while the bar is up (the
 * stage's own key moments otherwise). Each pause lights its system at its time on its graph, and the
 * next pause's pack is fetched meanwhile, so Next is quick in class.
 */
export default function LessonBar({ lesson, run, tabs, loadPack, className = '' }: LessonBarProps) {
  const { t } = useTranslation()
  const projector = useProjector()
  const step = lesson((s) => s.step) ?? 0
  const setStep = (step: number) => lesson.setState({ step })
  const close = () => {
    lesson.setState({ step: null })
    // A reload is the plain stage then: the history entry no longer asks for the lesson.
    history.replaceState({ ...history.state, usr: null }, '')
  }
  // Pause 4 is skin's once skin may be lit (public, or a preview), else the heart's (R34).
  const skin = run((s) => s.preview || !!systemOf('skin')?.public)
  const pauses = pausesFor(skin)
  const last = pauses.length - 1
  const at = Math.min(step, last)
  const pause = pauses[at]!
  const [sheet, setSheet] = useState(false)
  const help = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    go(pause)
    // The next pause's pack is fetched meanwhile (offline it fails quietly; that pause then says so, R71).
    const next = pauses[at + 1] && systemOf(pauses[at + 1]!.system)
    if (next) loadPack(next.pack)?.catch(() => {})
    // A pause is set when it is reached, not again on every render.
  }, [at, skin])

  /**
   * A pause: the clock stops at its time, its system is lit (its pack loads first, the lit one stays
   * drawn meanwhile: R71) and opens on its graph (state/stripTab.ts `next`). Play, scrub and the keys
   * still work from there.
   */
  function go({ system, t, slot }: Pause) {
    tabs.setState({ tab: slot, next: run.getState().layer === system ? null : { layer: system, slot } })
    run.getState().setLayer(system)
    useClock.getState().pause()
    useClock.getState().setSimMin(t)
  }

  const back = () => at > 0 && setStep(at - 1)
  const next = () => (at < last ? setStep(at + 1) : close())

  // The clicker (ui-ux §8.1): taken before the stage's key map, which then leaves it (defaultPrevented).
  const keys = useRef({ back, next: () => at < last && setStep(at + 1) })
  keys.current = { back, next: () => at < last && setStep(at + 1) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || (e.key !== 'PageDown' && e.key !== 'PageUp')) return
      if ((e.target as Element | null)?.closest?.(OWN_KEYS)) return
      e.preventDefault()
      if (e.key === 'PageDown') keys.current.next()
      else keys.current.back()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const n = { n: at + 1, count: pauses.length }
  const system = t(`systems.${pause.system}.name`)
  const question = t(`flagship.pauses.${pause.key}.question`)
  const answer = (
    <>
      <p>
        <span className="font-semibold text-ink">{t('flagship.book')}: </span>
        {t(`flagship.pauses.${pause.key}.book`)}
      </p>
      <p>
        <span className="font-semibold text-ink">{t('flagship.model')}: </span>
        {t(`flagship.pauses.${pause.key}.model`)}
      </p>
    </>
  )

  return (
    <div
      data-lesson-bar=""
      data-lesson-step={at + 1}
      data-lesson-pause={pause.key}
      role="region"
      aria-label={t('flagship.title')}
      className={`grid grid-cols-[minmax(0,1fr)] gap-1 ${className}`}
    >
      {/* Read out at each pause: where the lesson is and what it asks. */}
      <p role="status" className="sr-only">
        {`${t('flagship.step', n)} · ${system}: ${question}`}
      </p>
      <div className="flex items-center gap-1">
        <p aria-hidden="true" className="min-w-0 flex-1 truncate text-control text-ink">
          <span className="font-semibold text-ink-muted">
            <span className="lg:hidden">{t('flagship.stepShort', n)}</span>
            <span className="max-lg:hidden">{t('flagship.step', n)}</span> · {system}
          </span>
          <span className="lg:hidden"> · {question}</span>
        </p>
        <button
          ref={help}
          type="button"
          aria-expanded={sheet}
          aria-label={t('flagship.more')}
          title={t('flagship.more')}
          onClick={() => setSheet((o) => !o)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-control font-extrabold text-ink hover:bg-surface-sunk lg:hidden"
        >
          ?
        </button>
        <IconButton
          icon={<Chevron back />}
          label={t('flagship.back')}
          disabled={at === 0}
          onClick={back}
          aria-keyshortcuts="PageUp"
          className="max-xl:w-11 max-xl:justify-center max-xl:px-0 lg:max-xl:w-9 [&>span]:max-xl:sr-only"
        />
        <IconButton
          icon={<Chevron />}
          label={at < last ? t('flagship.next') : t('flagship.finish')}
          onClick={next}
          aria-keyshortcuts={at < last ? 'PageDown' : undefined}
          data-lesson-next=""
          className="max-xl:w-11 max-xl:justify-center max-xl:px-0 lg:max-xl:w-9 [&>span]:max-xl:sr-only"
        />
        <IconButton icon={<CloseIcon />} label={t('flagship.close')} iconOnly onClick={close} />
      </div>
      <div className="grid gap-1 text-control text-ink-muted max-lg:hidden">
        <p className="text-title font-extrabold text-ink" style={projector ? { fontSize: '2rem', lineHeight: 1.15 } : undefined}>
          {question}
        </p>
        {answer}
      </div>
      {sheet && (
        <Overlay
          anchor={help}
          onClose={() => setSheet(false)}
          label={t('flagship.step', n)}
          className="grid gap-2 text-control text-ink-muted"
        >
          <p className="text-title font-extrabold text-ink">{question}</p>
          {answer}
        </Overlay>
      )}
    </div>
  )
}
