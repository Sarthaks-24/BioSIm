import { useTranslation } from 'react-i18next'
import type { ActivityBout } from '@lifepeek/engine'

/**
 * The activity bouts' marks (E-3b-ui, ui-ux §5), downloaded the first time a run has a bout
 * (boutMarks.ts). A light neutral hatch, never a status colour or the run's blue, at least 6 px
 * wide; the kept run's bouts dashed. The time scale comes as a prop (lib/axis.ts), so this file
 * imports none of the stage's code.
 */

/**
 * On every graph: a hatched column for each bout, the other way from the squeezed part's hatch,
 * and a dashed outline for each of the kept run's. `id` names the hatch pattern (one per graph).
 */
export function BoutBands({
  bouts,
  kept,
  x,
  height,
  id,
}: {
  bouts: readonly ActivityBout[]
  kept: readonly ActivityBout[]
  /** A clock minute's x on the graph (px). */
  x: (min: number) => number
  height: number
  id: string
}) {
  const box = (b: ActivityBout) => {
    const left = x(b.startMin)
    return { x: left, width: Math.max(6, x(b.startMin + b.durMin) - left) }
  }
  return (
    <g aria-hidden="true">
      <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <path d="M2.5 0v5" className="stroke-ink-muted" strokeOpacity="0.35" />
      </pattern>
      {bouts.map((b, i) => (
        <rect key={`r${i}`} data-bout="run" y="0" height={height} fill={`url(#${id})`} {...box(b)} />
      ))}
      {kept.map((b, i) => (
        <rect
          key={`k${i}`}
          data-bout="kept"
          y="1"
          height={Math.max(0, height - 2)}
          className="fill-none stroke-kept [stroke-dasharray:var(--strip-kept-dash)]"
          strokeWidth="1.5"
          {...box(b)}
        />
      ))}
    </g>
  )
}

/**
 * On the dock's track (wireframe "●──[Walk]──○"): a light bar from each bout's start to its end,
 * named by its kind where the name fits; the kept run's bouts a dashed bar just under the track.
 * Inside the slider band, under the thumb, letting taps through, so it costs the dock no row. The
 * moments' lane names their starts and ends.
 */
export function BoutBars({
  run,
  kept,
  pos,
}: {
  run: readonly ActivityBout[]
  kept: readonly ActivityBout[]
  /** A clock minute's place along the track, 0 to 1. */
  pos: (min: number) => number
}) {
  const { t } = useTranslation()
  const place = (b: ActivityBout) => {
    const left = pos(b.startMin) * 100
    return { left: `${left}%`, width: `max(6px, ${(pos(b.startMin + b.durMin) * 100 - left).toFixed(3)}%)` }
  }
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {run.map((b, i) => (
        <span
          key={`r${i}`}
          data-bout-bar="run"
          className="absolute flex items-center overflow-hidden rounded-[3px] border border-ink-muted bg-surface-sunk px-1 text-caption leading-none font-semibold whitespace-nowrap text-ink"
          style={{ ...place(b), top: 26, height: 16 }}
        >
          {t(`activity.kinds.${b.kind}`)}
        </span>
      ))}
      {kept.map((b, i) => (
        <span
          key={`k${i}`}
          data-bout-bar="kept"
          className="absolute border-dashed border-kept"
          style={{ ...place(b), top: 40, borderTopWidth: 2 }}
        />
      ))}
    </span>
  )
}
