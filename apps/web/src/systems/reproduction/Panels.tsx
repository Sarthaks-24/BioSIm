import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Segmented, StatusTag } from '../../components/kit/index.ts'
import {
  ANCHOR_DAYS,
  CYCLE_DAYS,
  HEIGHT_EXAMPLE,
  HEIGHT_TABLE,
  HORMONES,
  MENSTRUATION_DRAWN,
  OVULATION_DAY,
  PHASES,
  REPRO_SOURCES,
  REPRO_SOURCE_IDS,
  fullHeightCm,
  makeCurve,
  relativeMedians,
  type Hormone,
} from './data.ts'

/**
 * Reproduction's two panels (R-1; model §2.12, ui-ux §10, anatomy plan A-11b), in the graph column's
 * place (SystemUi.card), one at a time: "Hormones over one cycle" (relative, low to high, on the
 * book's 28-day cycle; Model estimate) and "How height grows" (the older Class 8 book's table and
 * its worked example; a source line, no tag: R13). Never drawn on the body. No dates, no tracker, no
 * box for anyone's own cycle or height: the panels show the books' typical cycle and table only.
 *
 * The three hormone lines differ by dash, named in the legend under the chart, never by colour alone; the
 * chart's sentence is its text alternative, and "As a table" gives every point it is drawn through.
 * Styles only this lazy card uses are inline, so they add nothing to /sim's CSS.
 */

type Tab = 'cycle' | 'height'

/** The pack's words (`sys.reproduction.*`). */
function useSay() {
  const { t } = useTranslation()
  return (leaf: string, vars?: Record<string, unknown>) => t(`sys.reproduction.${leaf}`, vars)
}

// The chart's frame (SVG units): days 1–28 across, low to high up.
const W = 320
const H = 168
const LEFT = 34
const RIGHT = 312
const TOP = 12
const BOTTOM = 128
const x = (day: number) => LEFT + ((day - 1) / (CYCLE_DAYS - 1)) * (RIGHT - LEFT)
const y = (level: number) => BOTTOM - level * (BOTTOM - TOP)
const DASH: { readonly [H in Hormone]: string | undefined } = { estrogen: undefined, lh: '7 4', progesterone: '1.5 3.5' }

/** One hormone's line through the days of the cycle, a point every quarter day. */
function linePath(curve: (day: number) => number) {
  const pts: string[] = []
  for (let d = 1; d <= CYCLE_DAYS + 1e-9; d += 0.25) pts.push(`${pts.length ? 'L' : 'M'}${x(d).toFixed(1)} ${y(curve(d)).toFixed(1)}`)
  return pts.join('')
}

function CyclePanel() {
  const say = useSay()
  const titleId = useId()
  const altId = useId()
  const curves = useMemo(() => HORMONES.map((h) => [h, makeCurve(h)] as const), [])
  const shares = useMemo(() => Object.fromEntries(HORMONES.map((h) => [h, relativeMedians(h)])) as Record<Hormone, readonly number[]>, [])
  const [m0, m1] = MENSTRUATION_DRAWN
  const label = (px: number, py: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', weight?: number) => (
    <text x={px} y={py} textAnchor={anchor} fontSize="11" fontWeight={weight} fill="currentColor">
      {text}
    </text>
  )
  return (
    <div data-panel="cycle" className="flex flex-col gap-2">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={titleId} className="text-title font-extrabold">
          {say('cycle.title')}
        </h3>
        <StatusTag status="assumption" />
      </header>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${titleId} ${altId}`}
        className="w-full text-ink"
        style={{ maxHeight: '15rem', minHeight: '8rem' }}
      >
        <desc id={altId}>{say('cycle.alt')}</desc>
        {/* The book's days of menstruation, a pale band, and its day 14 (the egg released). */}
        <rect x={x(m0)} y={TOP} width={x(m1) - x(m0)} height={BOTTOM - TOP} fill="currentColor" opacity="0.08" data-menstruation="" />
        <path d={`M${x(OVULATION_DAY)} ${TOP}V${BOTTOM}`} stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" data-egg="" />
        <path d={`M${LEFT} ${TOP}V${BOTTOM}H${RIGHT}`} fill="none" stroke="currentColor" strokeWidth="1" />
        {label(LEFT - 4, TOP + 4, say('cycle.high'), 'end')}
        {label(LEFT - 4, BOTTOM, say('cycle.low'), 'end')}
        {[1, 7, 14, 21, 28].map((d) => (
          <g key={d}>
            <path d={`M${x(d)} ${BOTTOM}v4`} stroke="currentColor" strokeWidth="1" />
            {label(x(d), BOTTOM + 15, String(d), 'middle', d === OVULATION_DAY ? 700 : undefined)}
          </g>
        ))}
        {label((LEFT + RIGHT) / 2, BOTTOM + 31, say('cycle.days'))}
        {curves.map(([h, curve]) => (
          <g key={h} data-line={h}>
            <path
              d={linePath(curve)}
              fill="none"
              stroke="currentColor"
              strokeWidth={h === 'estrogen' ? 2.5 : 2}
              strokeDasharray={DASH[h]}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* The points it is drawn through: the study's middle values. */}
            {PHASES.map((p, i) => (
              <circle key={p} cx={x(ANCHOR_DAYS[p])} cy={y(shares[h][i]!)} r="2.2" fill="currentColor" />
            ))}
          </g>
        ))}
      </svg>
      {/* The lines' names by their dash (estrogen and LH peak together, so names on the lines would collide). */}
      <ul className="flex flex-col gap-0.5 text-caption" data-legend="">
        {HORMONES.map((h) => (
          <li key={h} className="font-semibold">
            <Swatch dash={DASH[h]} /> {say(`cycle.${h}`)}
          </li>
        ))}
        <li>
          <Swatch band /> {say('cycle.menstruation')}
        </li>
        <li>
          <Swatch dash="2 3" thin /> {say('cycle.egg')}
        </li>
      </ul>
      <p className="text-control font-semibold" data-differ="">
        {say('cycle.differ')}
      </p>
      <p className="text-caption text-ink-muted">
        {say('cycle.relative')} {say('cycle.lhWho')} {say('cycle.clock')}
      </p>
      <details className="text-caption">
        <summary className="cursor-pointer font-semibold">{say('cycle.tableTitle')}</summary>
        <table className="tabular mt-1 w-full text-left" data-cycle-table="">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-1 pr-2">
                {say('cycle.phase')}
              </th>
              {HORMONES.map((h) => (
                <th key={h} scope="col" className="py-1 pr-2">
                  {say(`cycle.${h}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PHASES.map((p, i) => (
              <tr key={p} data-phase={p} className="border-b border-border">
                <th scope="row" className="py-1 pr-2 font-normal">
                  {say(`cycle.phases.${p}`)} · {say('cycle.around', { n: Math.round(ANCHOR_DAYS[p]) })}
                </th>
                {HORMONES.map((h) => (
                  <td key={h} className="py-1 pr-2">
                    {shares[h][i]! < 0.005 ? say('cycle.under1') : say('cycle.share', { pct: Math.round(shares[h][i]! * 100) })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-ink-muted">{say('cycle.shareNote')}</p>
        <p className="mt-1 text-ink-muted">{say('cycle.study')}</p>
      </details>
    </div>
  )
}

/** A legend mark: the menstruation band, or a line in a dash. */
function Swatch({ band = false, dash, thin = false }: { band?: boolean; dash?: string; thin?: boolean }) {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" style={{ display: 'inline', verticalAlign: '-0.1em' }}>
      {band ? (
        <rect x="1" y="1" width="20" height="10" fill="currentColor" opacity="0.15" />
      ) : (
        <path d="M1 6H21" stroke="currentColor" strokeWidth={thin ? 1 : 2} strokeDasharray={dash} strokeLinecap="round" />
      )}
    </svg>
  )
}

function HeightPanel() {
  const say = useSay()
  const titleId = useId()
  const example = HEIGHT_TABLE.find((r) => r.age === HEIGHT_EXAMPLE.age)!
  const cm = fullHeightCm(HEIGHT_EXAMPLE.heightCm, example[HEIGHT_EXAMPLE.who])
  return (
    <div data-panel="height" className="flex flex-col gap-2">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={titleId} className="text-title font-extrabold">
          {say('height.title')}
        </h3>
        <span className="text-caption font-semibold text-ink-muted">{say('book')}</span>
      </header>
      <table aria-labelledby={titleId} className="tabular w-full text-left text-control" data-height-table="">
        <caption className="pb-1 text-left text-caption text-ink-muted">{say('height.caption')}</caption>
        <thead>
          <tr className="border-b-2 border-ink">
            <th scope="col" className="py-0.5 pr-3">
              {say('height.age')}
            </th>
            <th scope="col" className="py-0.5 pr-3">
              {say('height.boys')}
            </th>
            <th scope="col" className="py-0.5">
              {say('height.girls')}
            </th>
          </tr>
        </thead>
        <tbody>
          {HEIGHT_TABLE.map((r) => (
            <tr
              key={r.age}
              data-age={r.age}
              data-example={r.age === HEIGHT_EXAMPLE.age ? '' : undefined}
              className={`border-b border-border ${r.age === HEIGHT_EXAMPLE.age ? 'bg-surface-sunk font-semibold' : ''}`}
            >
              <th scope="row" className="py-0.5 pr-3 font-normal">
                {r.age}
              </th>
              <td className="py-0.5 pr-3">{say('height.pct', { pct: r.boys })}</td>
              <td className="py-0.5">{say('height.pct', { pct: r.girls })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-control" data-example-text="">
        {say('height.example', { cm: Math.round(cm) })}
      </p>
      <p className="text-caption text-ink-muted">{say('height.vary')}</p>
    </div>
  )
}

export default function Panels() {
  const say = useSay()
  const [tab, setTab] = useState<Tab>('cycle')
  return (
    // It scrolls, so the keyboard can reach it, and its scrolling keys scroll it (lib/keys.ts `data-scroll`; R120 #19).
    <section
      data-card="reproduction"
      data-scroll=""
      tabIndex={0}
      aria-label={say('panels')}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-ink"
    >
      <Segmented
        label={say('panels')}
        options={[
          { id: 'cycle', label: say('cycle.title') },
          { id: 'height', label: say('height.title') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'cycle' ? <CyclePanel /> : <HeightPanel />}
      <details className="border-t border-border text-caption text-ink-muted" style={{ paddingTop: '0.5rem' }}>
        <summary className="cursor-pointer font-semibold text-ink">{say('sourcesTitle')}</summary>
        <ul className="list-disc pl-6">
          {REPRO_SOURCE_IDS.map((s) => (
            <li key={s} data-source={s}>
              <a href={REPRO_SOURCES[s].url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {REPRO_SOURCES[s].citation}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
