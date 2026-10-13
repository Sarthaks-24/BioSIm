import type { ReactNode } from 'react'

interface Props {
  /** Names the region for screen readers ("Timeline"). */
  label: string
  /** The PlayButton. */
  play: ReactNode
  /** The clock text ("1 h 30 min" + "after eating"); gets the big tabular clock type. */
  clock: ReactNode
  /** Optional speed control: beside the clock. */
  pace?: ReactNode
  /** Optional small controls at the end of the clock's row (the settings button). */
  tools?: ReactNode
  /** The timeline track; takes all the width that is left. */
  children: ReactNode
}

/**
 * The clock dock at the bottom of the stage (layout only: it owns no state). A raised surface with
 * the one rule above it. It is a normal grid row of the stage, so it reserves its own height and
 * never covers the body; on phones it also pads for the home indicator (safe area). About 72 px tall.
 *
 * The track always starts `--plot-gutter` in from the graph column's left edge and ends where the
 * graphs end, so the graphs' playheads stand straight above its thumb (WP-12):
 * - phones: Play on the left, the clock above the track (the track never moves when the clock's
 *   text gets longer); Play plus its gap is exactly the gutter;
 * - from 1024 px up the dock takes the stage's two columns (it must sit in a `grid-cols-subgrid`
 *   parent): Play and clock under the body, the track under the graph column, behind the same rule.
 */
export default function Dock({ label, play, clock, pace, tools, children }: Props) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 border-t border-border bg-surface-raised px-3 pt-1.5 pb-[env(safe-area-inset-bottom)] lg:col-span-2 lg:grid-cols-subgrid lg:gap-x-0 lg:p-0"
    >
      <div className="contents lg:flex lg:min-h-18 lg:items-center lg:gap-4 lg:px-4">
        <div className="row-span-2">{play}</div>
        <div className="flex shrink-0 items-center gap-3 lg:flex-1 lg:gap-4">
          <div className="tabular text-clock-sm font-extrabold lg:text-clock">{clock}</div>
          {pace}
          {/* Phones: at the end of the clock's line, which it must not make taller. */}
          {tools && <div className="-my-2 ml-auto shrink-0 lg:my-0">{tools}</div>}
        </div>
      </div>
      <div className="col-start-2 min-w-0 lg:flex lg:h-full lg:items-center lg:border-l lg:border-border lg:pr-4 lg:pl-[calc(1rem+var(--plot-gutter))]">
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  )
}
