import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusTag } from '../../components/kit/index.ts'
import { LYMPH_TONE } from '../../anatomy/tones/lymph.ts'

/**
 * The germ-defence card (A-11a; model §2.11, anatomy plan §2.7): a 4-panel story with no clock and
 * no numbers in the panels: skin and stomach acid keep most germs out → a cut lets germs in → white
 * cells come (warm, red, swollen) and swallow germs → antibodies and memory, which vaccines use.
 * "Next" and "Back" step the panels; the white-cell range and its source line sit under the story
 * (R13: a source line, never a fourth tag; R31: read on the OpenStax page, §18.4 and §21.2).
 *
 * Drawn in SVG with the lymph tones and the ink: nothing moves or flashes. No symptom or disease,
 * no score, no "boost" (framing lint). In the pack's `ui` chunk (ui.tsx), at most 5 KB gz with it.
 */

const PANELS = ['barrier', 'cut', 'fight', 'memory'] as const
type Panel = (typeof PANELS)[number]

const SKIN = LYMPH_TONE.thymus
const NODE = LYMPH_TONE.node
const ANTIBODY = LYMPH_TONE.vessel
const GERM = LYMPH_TONE.spleen
const ACID = LYMPH_TONE.fat

/** A germ: a round body with short spikes. */
function Germ({ x, y, gone = false }: { x: number; y: number; gone?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={gone ? 0.35 : 1}>
      <path d="M0-9V9M-9 0H9M-6.4-6.4 6.4 6.4M-6.4 6.4 6.4-6.4" stroke="currentColor" strokeWidth="1.5" />
      <circle r="6" fill={GERM} stroke="currentColor" strokeWidth="1.5" />
      {gone && <path d="M-7-7 7 7M-7 7 7-7" stroke="currentColor" strokeWidth="2" />}
    </g>
  )
}

/** A white cell: pale, with a lobed nucleus; `r` its size. */
function WhiteCell({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  const k = r / 13
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r="13" fill="#fff" stroke="currentColor" strokeWidth={1.5 / k} />
      <path d="M-6 2a3.5 3.5 0 1 1 4-5 3.5 3.5 0 1 1 5 2 3.5 3.5 0 1 1-3 5 3.5 3.5 0 1 1-6-2z" fill={NODE} />
    </g>
  )
}

/**
 * An antibody stuck to a germ at (`x`, `y`): a Y whose two arms hold the germ, on the side at angle
 * `a` (degrees, 0 = right, 90 = below).
 */
function Antibody({ x, y, a }: { x: number; y: number; a: number }) {
  const r = (a * Math.PI) / 180
  return (
    <path
      transform={`translate(${x + 14 * Math.cos(r)} ${y + 14 * Math.sin(r)}) rotate(${a - 90})`}
      d="M0 12V2L-6-6M0 2 6-6"
      fill="none"
      stroke={ANTIBODY}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

/** The skin: a band across the panel, with a gap in the middle when it is `cut`. */
function Skin({ cut }: { cut: boolean }) {
  return (
    <path
      d={cut ? 'M0 70H108L100 84H0ZM126 70H240V84H134Z' : 'M0 70H240V84H0Z'}
      fill={SKIN}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  )
}

/** Each panel's picture; `arrow` is the id of the card's arrowhead marker (one per card: useId). */
const PICTURES: Record<Panel, (arrow: string) => ReactNode> = {
  barrier: () => (
    <>
      <path d="M0 70H120V84H0Z" fill={SKIN} stroke="currentColor" strokeWidth="1.5" />
      <Germ x={30} y={48} />
      <Germ x={78} y={40} />
      <path d="M38 60 52 66 60 54M70 54 64 66" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" />
      {/* The stomach, with acid. */}
      <path d="M150 22c0 40 10 70 45 70s38-26 30-40c-8-12-30-6-40-18-6-8-6-12-6-12z" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
      {[
        [178, 76],
        [198, 66],
        [212, 80],
        [186, 58],
      ].map(([x = 0, y = 0]) => (
        <path key={`${x}`} d={`M${x} ${y - 6}c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z`} fill={ACID} stroke="currentColor" strokeWidth="1" />
      ))}
      <Germ x={168} y={48} gone />
      <Germ x={200} y={86} gone />
      <Germ x={214} y={50} />
    </>
  ),
  cut: (arrow) => (
    <>
      <Skin cut />
      <Germ x={90} y={40} />
      <Germ x={116} y={52} />
      <Germ x={118} y={108} />
      <path d="M142 34 124 58M117 84v8" fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd={`url(#${arrow})`} />
    </>
  ),
  fight: () => (
    <>
      <ellipse cx="116" cy="102" rx="70" ry="22" fill={SKIN} opacity="0.55" />
      <Skin cut />
      <WhiteCell x={74} y={104} />
      <WhiteCell x={160} y={106} />
      <g>
        <WhiteCell x={116} y={108} r={16} />
        <Germ x={120} y={108} />
      </g>
      <Germ x={60} y={50} />
    </>
  ),
  memory: () => (
    <>
      {/* A lymph node: a bean with white cells inside. */}
      <path
        d="M150 30c40-14 84 6 80 44s-50 44-80 30c-12-6-4-20-10-36s-6-30 10-38z"
        fill={NODE}
        fillOpacity="0.2"
        stroke={NODE}
        strokeWidth="2"
      />
      <WhiteCell x={176} y={56} r={11} />
      <WhiteCell x={204} y={76} r={11} />
      <WhiteCell x={172} y={88} r={11} />
      <Germ x={46} y={50} />
      <Antibody x={46} y={50} a={135} />
      <Antibody x={46} y={50} a={45} />
      <Antibody x={46} y={50} a={-90} />
      <Germ x={100} y={84} />
      <Antibody x={100} y={84} a={150} />
      <Antibody x={100} y={84} a={30} />
    </>
  ),
}

export default function GermCard() {
  const { t } = useTranslation()
  const [at, setAt] = useState(0)
  // Ids of this card's own (two cards on a page never share one; R93 #15).
  const id = useId()
  const titleId = `${id}-title`
  const arrow = `${id}-arrow`
  const panel = PANELS[at]!
  const k = (leaf: string) => t(`sys.lymph.card.${panel}.${leaf}`)
  // aria-disabled, not disabled: the button keeps the focus when the last (or first) panel shows.
  // Styles only this lazy card uses are inline, so they add nothing to the stage's CSS (/sim).
  const step = 'min-h-11 rounded-control px-3 font-semibold text-ink hover:bg-surface-sunk lg:min-h-9'
  const go = (to: number) => to >= 0 && to < PANELS.length && setAt(to)
  const dim = (off: boolean) => (off ? { opacity: 0.4 } : undefined)
  return (
    <section data-card="germs" aria-labelledby={titleId} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto text-ink">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={titleId} className="text-title font-extrabold">
          {t('sys.lymph.card.title')}
        </h3>
        <StatusTag status="illustration" />
      </header>
      <svg
        viewBox="0 0 240 128"
        role="img"
        aria-label={k('picture')}
        className="w-full text-ink"
        // The picture gives way first in a short graph row (a phone's): the words and Next stay whole.
        style={{ flex: '0 1 14rem', minHeight: '3.5rem' }}
      >
        <defs>
          <marker id={arrow} viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 8 4 0 8z" fill="currentColor" />
          </marker>
        </defs>
        {PICTURES[panel](arrow)}
      </svg>
      <div aria-live="polite">
        <h4 className="font-semibold">
          {at + 1} · {k('title')}
        </h4>
        <p className="text-control">{k('text')}</p>
      </div>
      {/* Back and Next: plain buttons in a row (not a landmark: they step this card only). */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-disabled={at === 0} onClick={() => go(at - 1)} className={step} style={dim(at === 0)}>
          <span aria-hidden="true">‹</span> {t('sys.lymph.card.back')}
        </button>
        <span className="text-caption text-ink-muted">{t('sys.lymph.card.step', { n: at + 1, total: PANELS.length })}</span>
        <button
          type="button"
          aria-disabled={at === PANELS.length - 1}
          onClick={() => go(at + 1)}
          className={step}
          style={dim(at === PANELS.length - 1)}
        >
          {t('sys.lymph.card.next')} <span aria-hidden="true">›</span>
        </button>
      </div>
      <footer className="border-t border-border text-caption text-ink-muted" style={{ paddingTop: '0.5rem' }}>
        <p className="text-ink">{t('sys.lymph.card.cells')}</p>
        <p>{t('sys.lymph.card.source')}</p>
      </footer>
    </section>
  )
}
