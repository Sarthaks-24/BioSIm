import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NERVE_PARAMS, NERVE_SOURCES, type NerveSourceId, type NerveTiming } from '@lifepeek/engine/demo'
import { PauseIcon, PlayIcon, StatusTag } from '../../components/kit/index.ts'
import WhyCard from '../../components/WhyCard.tsx'
import { NERVE_TONE } from '../../anatomy/tones/nerves.ts'
import { onTick } from '../../lib/ticker.ts'
import { useMotion } from '../../state/motion.ts'
import { AT, MOTOR, RELAY, SENSORY, counterMs, race, signalAt, steps, type Pt } from './demo.ts'

/**
 * The nerve demo (U-7; model §2.6, anatomy plan §2.8), in the graph column's place (SystemUi.card):
 * the hot pan, run twice side by side on one slowed-down clock. The reflex (●) goes in along the
 * sensory neuron, through the relay neuron in the spinal cord and out along the motor neuron to the
 * arm muscle; the route through the brain (○) goes up the cord, thinks, and comes back down. Two
 * counters show real milliseconds from the engine's `reflexTime` (counter = reflexTime ± 1 ms); the
 * longer route plays over 9 s. "Myelin off (thin fibres)" (Beyond class 10) runs every leg as a C
 * fibre. Its tag is "Model estimate", with its sources and limits under it (V-7, R31).
 *
 * Flash-safe: only the two dots move, and the hand lifts once (no blinking, no colour change). With
 * motion reduced nothing plays: Back and Next step through five still frames with their numbers
 * (anatomy plan §4). It never plays on its own. The meal clock does not move it (a reflex takes
 * milliseconds; the dock stays, so the stage keeps its layout and keys: the Now line's brain sugar
 * follows that clock). Styles only this lazy card uses are inline, so they add nothing to /sim's CSS.
 */

/** The hot-pan sources the demo rests on (V-7): the knee tap's (Khatun) waits for the knee tap. */
export const DEMO_SOURCES: readonly NerveSourceId[] = [
  'kiernan2003',
  'khosrawi2018',
  'davisIuReflexes',
  'byrneNeuroOnline',
  'jain2015',
  'isoardo2026',
]

/**
 * The demo's "Why does the model differ from the book?" card (X-4, components/WhyCard.tsx; v3.1 Teach
 * step, R109), by its book line (NCERT Class 10, Ch 6, p. 102): its rows, in the control pack's section.
 */
const WHY = 'sys.control.nerves.why'

/** The demo's words (`sys.control.nerves.demo.*`, with the pack's English). */
function useSay() {
  const { t } = useTranslation()
  return (leaf: string, vars?: Record<string, unknown>) => t(`sys.control.nerves.demo.${leaf}`, vars)
}

const path = (pts: readonly Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')
/** An organ colour's outline: the colour, shaded (flat/look.ts outlineOf, normal look). */
const ink = (hex: string) => `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.42)).join(',')})`
const MUSCLE = '#b5444b'
const HEAT = '#e0303f'

/** One route's counter: its name and mark, the real ms so far, and a bar on the shared scale. */
function Counter({ route, timing, t, max }: { route: 'reflex' | 'brain'; timing: NerveTiming; t: number; max: number }) {
  const say = useSay()
  const ms = counterMs(timing, t)
  const done = t >= timing.totalMs
  return (
    <div data-counter={route} data-ms={ms} data-done={done ? '' : undefined} className="grid gap-1">
      <span className="text-caption font-semibold text-ink-muted">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
          style={{ display: 'inline', verticalAlign: '-0.1em', marginRight: 4 }}
        >
          {route === 'reflex' ? (
            <circle cx="7" cy="7" r="5" fill="currentColor" />
          ) : (
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          )}
        </svg>
        {say(route)}
      </span>
      <span className="tabular text-title font-extrabold text-ink">{say('ms', { ms })}</span>
      <span aria-hidden="true" className="block rounded-control bg-surface-sunk" style={{ height: 6 }}>
        <span className="block h-full rounded-control bg-ink" style={{ width: `${(Math.min(t, timing.totalMs) / max) * 100}%` }} />
      </span>
    </div>
  )
}

export default function NerveDemo() {
  const say = useSay()
  const reduced = useMotion((s) => s.reduced)
  const id = useId()
  const [myelinOff, setMyelinOff] = useState(false)
  const run = useMemo(() => race(myelinOff), [myelinOff])
  // The fibres' own speeds, for the limits and the what-if's "times longer".
  const usual = useMemo(() => race(false), [])
  const frames = useMemo(() => steps(run), [run])
  const end = frames[frames.length - 1]!.t
  // Model time (real ms of the signal); with motion reduced, the still frame shown.
  const [now, setNow] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [at, setAt] = useState(0)
  const time = reduced ? frames[at]!.t : now
  const finished = time >= end

  // Playing: the model's clock moves `1 / slow` ms per real ms (at most 30 frames a second, lib/ticker.ts).
  useEffect(() => {
    if (!playing || reduced) return
    return onTick((dt) => setNow((n) => Math.min(n + (dt * 1000) / run.slow, end)))
  }, [playing, reduced, run, end])
  useEffect(() => {
    if (now >= end) setPlaying(false)
  }, [now, end])

  // A new what-if starts again from the touch.
  const setMyelin = (off: boolean) => {
    setMyelinOff(off)
    setPlaying(false)
    setNow(0)
    setAt(0)
  }
  const play = () => {
    if (finished) setNow(0)
    setPlaying((p) => !p || finished)
  }

  const reflexAt = signalAt(run.reflex, time)
  const brainAt = signalAt(run.brain, time)
  const pulled = time >= run.reflex.totalMs
  const step = frames.filter((f) => f.t <= time).pop()!
  const ms = (timing: NerveTiming) => Math.round(timing.totalMs)
  const result = myelinOff
    ? say('resultSlow', { reflex: ms(run.reflex), times: Math.round(run.reflex.totalMs / usual.reflex.totalMs) })
    : say('result', { reflex: ms(run.reflex), brain: ms(run.brain) })
  const button = 'inline-flex min-h-11 items-center gap-2 rounded-control px-3 font-semibold text-ink hover:bg-surface-sunk lg:min-h-9'
  const dim = (off: boolean) => (off ? { opacity: 0.4 } : undefined)
  const label = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <text x={x} y={y} textAnchor={anchor} fontSize="9.5" fill="currentColor">
      {text}
    </text>
  )

  return (
    <section
      data-card="nerves"
      data-myelin={myelinOff ? 'off' : 'on'}
      aria-labelledby={`${id}-title`}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-ink"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={`${id}-title`} className="text-title font-extrabold">
          {say('title')}
        </h3>
        <StatusTag status="assumption" />
      </header>
      <p className="text-control">{say('lead')}</p>

      <svg
        viewBox="0 0 300 155"
        role="img"
        aria-label={say('picture')}
        className="w-full text-ink"
        // The picture gives way first in a short graph row (a phone's): the counters and Play stay whole.
        style={{ flex: '0 1 14rem', minHeight: '6rem' }}
      >
        {/* The brain (fore-brain, cerebellum) and the spinal cord under it. */}
        <ellipse cx="60" cy="27" rx="34" ry="20" fill={NERVE_TONE.brain} stroke={ink(NERVE_TONE.brain)} strokeWidth="1.25" />
        <ellipse cx="80" cy="45" rx="10" ry="6" fill={NERVE_TONE.brain} stroke={ink(NERVE_TONE.brain)} strokeWidth="1.25" />
        <rect x="55" y="44" width="10" height="100" rx="5" fill={NERVE_TONE.cord} stroke={ink(NERVE_TONE.cord)} strokeWidth="1.25" />
        {label(100, 14, say('brainPart'), 'start')}
        {label(50, 148, say('cordPart'), 'end')}
        {/* The arm (a faint skin), its muscle, the hand and the hot pan. */}
        <path
          d="M68 79 C120 74 200 79 246 89 L246 104 C205 110 180 126 150 128 C115 130 90 130 68 128 Z"
          fill="currentColor"
          fillOpacity="0.05"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.25"
        />
        <ellipse cx="150" cy="117" rx="24" ry="7" fill={MUSCLE} fillOpacity="0.35" stroke={ink(MUSCLE)} strokeWidth="1.25" />
        {label(150, 142, say('effector'))}
        <g
          data-hand={pulled ? 'back' : 'on'}
          style={{ transform: pulled ? 'translateY(-10px)' : undefined, transition: reduced ? undefined : 'transform 250ms ease-out' }}
        >
          <rect
            x="246"
            y="90"
            width="34"
            height="13"
            rx="6"
            fill="var(--color-surface-raised, #fff)"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        </g>
        <path d="M232 112 H290 M290 112 L298 106" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M244 124 q3 -4 0 -8 M256 124 q3 -4 0 -8 M268 124 q3 -4 0 -8 M280 124 q3 -4 0 -8"
          fill="none"
          stroke={HEAT}
          strokeWidth="1.5"
        />
        {label(265, 138, say('pan'))}
        {/* The reflex arc: sensory neuron in, relay neuron in the cord, motor neuron out (NCERT Class 10 Fig. 6.2). */}
        <g fill="none" stroke={NERVE_TONE.nerve} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={path(SENSORY)} />
          <path d={path(RELAY)} />
          <path d={path(MOTOR)} />
        </g>
        <circle cx={AT.receptor[0]} cy={AT.receptor[1]} r="3" fill={NERVE_TONE.nerve} stroke={ink(NERVE_TONE.nerve)} />
        {label(165, 72, say('sensory'))}
        {label(98, 125, say('motor'))}
        {label(50, 101, say('relay'), 'end')}
        {label(270, 84, say('receptor'))}
        {/* The two signals: ink, a filled dot and a ring. */}
        <circle data-signal="brain" cx={brainAt[0]} cy={brainAt[1]} r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle data-signal="reflex" cx={reflexAt[0]} cy={reflexAt[1]} r="4.5" fill="currentColor" />
      </svg>

      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Counter route="reflex" timing={run.reflex} t={time} max={end} />
        <Counter route="brain" timing={run.brain} t={time} max={end} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {reduced ? (
          <span className="flex items-center gap-2">
            {/* aria-disabled, not disabled: the button keeps the focus at either end. */}
            <button type="button" aria-disabled={at === 0} onClick={() => at > 0 && setAt(at - 1)} className={button} style={dim(at === 0)}>
              <span aria-hidden="true">‹</span> {say('back')}
            </button>
            <span className="text-caption text-ink-muted">{say('step', { n: at + 1, total: frames.length })}</span>
            <button
              type="button"
              aria-disabled={finished}
              onClick={() => !finished && setAt(at + 1)}
              className={button}
              style={dim(finished)}
            >
              {say('next')} <span aria-hidden="true">›</span>
            </button>
          </span>
        ) : (
          <button type="button" data-play="" onClick={play} className={button}>
            {playing ? <PauseIcon /> : <PlayIcon />}
            {say(playing ? 'pause' : finished ? 'again' : now > 0 ? 'resume' : 'play')}
          </button>
        )}
        <label className="flex min-h-11 items-center gap-2 text-control lg:min-h-9">
          <input
            type="checkbox"
            role="switch"
            checked={myelinOff}
            onChange={(e) => setMyelin(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          {say('myelin')}
          <span className="rounded-control border border-border px-1 text-caption text-ink-muted">{say('beyond')}</span>
        </label>
      </div>

      <div aria-live="polite" className="text-control">
        {reduced || !playing ? <p data-step={step.key}>{say(`steps.${step.key}`, { ms: Math.round(step.t) })}</p> : <p>{say('playing')}</p>}
        {finished && (
          <p data-result="" className="font-semibold">
            {result}
          </p>
        )}
      </div>
      {myelinOff && <p className="text-caption text-ink-muted">{say('myelinNote', { c: NERVE_PARAMS.fibreSpeedMPerS.c })}</p>}
      <p className="text-caption text-ink-muted">
        {say('slowed', { times: Math.round(run.slow) })} {say('clock')}
      </p>

      <details className="border-t border-border text-caption text-ink-muted" style={{ paddingTop: '0.5rem' }}>
        <summary className="cursor-pointer font-semibold text-ink">{say('sourcesTitle')}</summary>
        <div className="flex flex-wrap items-center gap-x-3">
          <p data-book="" className="text-ink">
            {say('book')}
          </p>
          <WhyCard text={WHY} />
        </div>
        <p>
          {say('limits', {
            in: usual.reflex.inSpeedMPerS,
            out: usual.reflex.outSpeedMPerS,
            synapse: NERVE_PARAMS.synapseDelayMs,
            thinking: NERVE_PARAMS.thinkingMs,
          })}
        </p>
        <ul className="list-disc pl-6">
          {DEMO_SOURCES.map((s) => (
            <li key={s}>
              <a href={NERVE_SOURCES[s].url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {NERVE_SOURCES[s].citation}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
