import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import countText from 'virtual:lifepeek-en/count'
import { addEnglish } from '../i18n/text.ts'
import { COUNT_S, EXAMPLES, TIMES, spokenAt, stepAt, type CountStep } from '../lib/countTimer.ts'
import { useProjector } from '../hooks/useProjector.ts'
import { useClock } from '../state/clock.ts'
import { useMotion } from '../state/motion.ts'
import Overlay from './Overlay.tsx'

addEnglish(countText)

export type CountKind = 'breaths' | 'pulse'

/** The system's own lines beside the timer, in its pack's words (content §8.3): book, model, children's band. */
export interface CountLines {
  /** "Older NCERT Class 7 book (2024-25) says: …" (R29, R33). */
  book: string
  /** The model's value from the run on screen, at rest and in the activity (the model's tag). */
  model: string
  /** The children's band (Fleming 12–15 y, R57), when the system has one. */
  band?: string
}

export interface CountYoursProps {
  kind: CountKind
  lines: CountLines
  /** The "Count yours" button: the panel sits by it, and focus goes back to it on close. */
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
}

/** How often the digits and the ring are brought up to date while the timer runs (ms). */
const TICK_MS = 100
/** The ring's circumference (r = 45 in a 100 × 100 box). */
const RING = 2 * Math.PI * 45

/**
 * "Count yours" (X-2; ui-ux §8.2, content §8.3, R14): a 15-second timer to count your own breaths
 * or pulse, then "multiply by 4", with worked examples and the book, model and children's lines
 * beside it. Downloaded the first time it is opened (CountYoursButton), in the stage's Overlay.
 *
 * It only shows a timer. There is no input field: nothing counted is typed in, kept, saved or sent,
 * and there is no result and no "normal for you" (R14). The timer runs on real time
 * (`performance.now()`). The meal clock pauses while it is open and goes on when it closes, if it
 * was playing. Screen readers hear the start, 10 and 5 seconds left, and the end; the digits
 * themselves are not read every second. With reduced motion there is no draining ring, only the
 * number. Start is ≥ 64 px tall on a phone and ≥ 96 px on the projector, its digits ≥ 120 px there.
 * It fills more of the projector's screen; its own sizes are inline styles (no new CSS on the page).
 */
export default function CountYours({ kind, lines, anchor, onClose }: CountYoursProps) {
  const { t } = useTranslation()
  const reduced = useMotion((s) => s.reduced)
  const projector = useProjector()
  const howId = useId()
  const live = useRef<HTMLParagraphElement>(null)
  /** performance.now() when Start was pressed; null before, or after Stop. */
  const [startAt, setStartAt] = useState<number | null>(null)
  const [step, setStep] = useState<CountStep | null>(null)

  // The meal clock waits while the panel is open (ui-ux §8.2), and goes on if it was playing.
  useEffect(() => {
    const clock = useClock.getState()
    const wasPlaying = clock.playing
    if (wasPlaying) clock.pause()
    return () => {
      if (wasPlaying) useClock.getState().play()
    }
  }, [])

  const say = (text: string) => {
    const el = live.current
    if (!el) return
    // Emptied, then filled a moment later, so a screen reader hears it even when it is the same text.
    el.textContent = ''
    setTimeout(() => (el.textContent = text), 50)
  }
  const sayRef = useRef(say)
  sayRef.current = say

  useEffect(() => {
    if (startAt === null) return
    let before: CountStep | null = null
    let id: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      const now = stepAt(performance.now() - startAt)
      const spoken = spokenAt(before, now)
      if (spoken === 'started') sayRef.current(t('count.started'))
      else if (spoken === 'done') sayRef.current(`${t('count.timeUp')}. ${t('count.done')}`)
      else if (typeof spoken === 'number') sayRef.current(t('count.left', { n: spoken }))
      before = now
      setStep(now)
      if (now.phase === 'done') clearInterval(id)
    }
    tick()
    id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [startAt, t])

  const phase = step?.phase ?? 'idle'
  const running = phase === 'ready' || phase === 'run'
  const press = () => {
    if (running) {
      setStartAt(null)
      setStep(null)
      say(t('count.stopped'))
    } else {
      setStep(null)
      setStartAt(performance.now())
    }
  }

  const digits = step?.phase === 'ready' ? step.n : step?.phase === 'run' ? step.left : phase === 'done' ? 0 : COUNT_S
  const caption = step?.phase === 'ready' ? t('count.ready') : phase === 'done' ? t('count.timeUp') : t('count.seconds')
  const part = step?.phase === 'run' ? step.part : phase === 'done' ? 0 : 1
  const example = kind === 'breaths' ? 'count.exampleBreaths' : 'count.examplePulse'

  // Sizes only it needs are inline styles, so it adds nothing to the page's CSS (as Overlay; size budget).
  const big = projector
  return (
    <Overlay anchor={anchor} onClose={onClose} label={t('count.open')} className="text-ink">
      <div
        className="flex flex-col gap-3"
        style={{ width: big ? '44rem' : '26rem', maxWidth: '100%', fontSize: big ? '1.1875rem' : '0.9375rem', lineHeight: 1.35 }}
      >
        <p id={howId}>{t(kind === 'breaths' ? 'count.howBreaths' : 'count.howPulse')}</p>
        {/* On the projector the timer and its lines sit side by side, so all of it fits on the screen. */}
        <div className="flex gap-3" style={{ flexDirection: big ? 'row' : 'column', alignItems: big ? 'flex-start' : 'stretch' }}>
          <div
            data-count={kind}
            data-phase={phase}
            className="flex flex-col items-center gap-3"
            style={big ? { flex: '0 0 18rem' } : undefined}
          >
            <div
              aria-hidden="true"
              className="relative grid place-items-center"
              style={{ width: big ? '13rem' : '10rem', height: big ? '13rem' : '10rem' }}
            >
              {!reduced && (
                // Drains over the 15 s: size only, no colour change and no flashing (WCAG 2.3.1).
                <svg data-count-ring="" viewBox="0 0 100 100" className="absolute inset-0">
                  <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-border" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={RING}
                    strokeDashoffset={RING * (1 - part)}
                    transform="rotate(-90 50 50)"
                    className="stroke-ink"
                  />
                </svg>
              )}
              <span className="flex flex-col items-center">
                <span data-count-digits={digits} className="leading-none font-semibold" style={{ fontSize: big ? '7rem' : '4.5rem' }}>
                  {digits}
                </span>
                <span className="text-caption text-ink-muted">{caption}</span>
              </span>
            </div>
            <button
              type="button"
              data-count-start=""
              data-stay=""
              autoFocus
              aria-describedby={howId}
              onClick={press}
              className="w-full rounded-control bg-ink font-semibold text-white"
              style={{ minHeight: big ? '6rem' : '4rem', maxWidth: big ? '100%' : '20rem', fontSize: big ? '2rem' : '1.25rem' }}
            >
              {t(running ? 'count.stop' : phase === 'done' ? 'count.again' : 'count.start')}
            </button>
            {/* The start, 10 and 5 seconds left, and the end (not every second). */}
            <p ref={live} role="status" data-count-live="" className="sr-only" />
          </div>
          <div className="flex flex-col gap-3" style={{ flex: '1 1 0', minWidth: 0 }}>
            {phase === 'done' && (
              <p data-count-done="" className="font-semibold">
                {t('count.done')}
              </p>
            )}
            <div>
              <p className="text-ink-muted">{t('count.examples')}</p>
              <ul data-count-examples="">
                {EXAMPLES[kind].map((n) => (
                  <li key={n}>{t(example, { n, m: n * TIMES })}</li>
                ))}
              </ul>
            </div>
            <ul data-count-lines="" className="flex flex-col gap-1 border-t border-border" style={{ paddingTop: '0.5rem' }}>
              <li data-count-book="">{lines.book}</li>
              <li data-count-model="">{lines.model}</li>
              {lines.band && <li data-count-band="">{lines.band}</li>}
            </ul>
            <p className="text-caption text-ink-muted">
              {t('count.notCheck')} {t('count.private')}
            </p>
          </div>
        </div>
      </div>
    </Overlay>
  )
}
