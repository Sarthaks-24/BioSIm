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
  /** Optional small controls in a cell of their own (the settings button). */
  tools?: ReactNode
  /** The timeline: a 44 px slider band, then the key moments' lane (`--lane` tall). */
  children: ReactNode
}

/**
 * The clock dock at the bottom of the stage (layout only: it owns no state). A raised surface with
 * the one rule above it. It is a normal grid row of the stage, so it reserves its own height and
 * never covers the body; on phones it also pads for the home indicator (safe area).
 *
 * The track always starts `--plot-gutter` in from the graph column's left edge and ends where the
 * graphs end, so the graphs' playheads stand straight above its thumb (WP-12):
 * - phones: two rows (FP-3). Play beside the timeline's 44 px slider band, the clock's words laid
 *   over the band's top (taps there reach the slider), the settings button in its own cell under
 *   Play, beside the key moments' lane, so no control lies on another (B4). Play plus its gap is
 *   exactly the gutter;
 * - from 1024 px up the dock takes the stage's two columns (it must sit in a `grid-cols-subgrid`
 *   parent): Play, clock and settings under the body, the track under the graph column, behind the
 *   same rule.
 * `--lane` is the moments' lane height: 44 px for a finger (a touch screen at least 680 px tall),
 * else 34 px: a mouse needs less, and a phone under 680 px tall has no height to spare (the body
 * keeps its 160 px, FP-1). With a kept meal the lane grows by its row, past 44 px everywhere.
 */
export default function Dock({ label, play, clock, pace, tools, children }: Props) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[44px_auto] gap-x-3 border-t border-border bg-surface-raised px-3 pb-[env(safe-area-inset-bottom)] [--lane:34px] lg:col-span-2 lg:grid-cols-subgrid lg:grid-rows-1 lg:gap-x-0 lg:p-0 [@media(pointer:coarse)_and_(height>=680px)]:[--lane:44px]"
    >
      <div className="contents lg:flex lg:min-h-18 lg:items-center lg:gap-4 lg:px-4">
        <div className="self-center">{play}</div>
        <div className="pointer-events-none col-start-2 row-start-1 flex items-center gap-3 self-start lg:pointer-events-auto lg:flex-1 lg:gap-4">
          <div className="tabular text-clock-sm font-extrabold lg:text-clock">{clock}</div>
          {pace}
        </div>
        {/*
         * Phones: under Play, at the bottom of the lane's row, as tall as Play leaves it (Play is
         * 3 rem, centred on the 44 px band and overflowing it a little, more in Hindi's larger rem).
         */}
        {tools && (
          <div className="max-lg:flex max-lg:self-end max-lg:[&>*]:h-[calc(var(--lane)+22px-1.5rem)] max-lg:[&>*]:min-h-0">{tools}</div>
        )}
      </div>
      <div className="col-start-2 row-span-2 row-start-1 min-w-0 lg:flex lg:h-full lg:items-center lg:border-l lg:border-border lg:pr-4 lg:pl-[calc(1rem+var(--plot-gutter))]">
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  )
}
