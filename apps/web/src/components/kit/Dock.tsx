import type { ReactNode } from 'react'

interface Props {
  /** Names the region for screen readers ("Timeline"). */
  label: string
  /** The PlayButton. */
  play: ReactNode
  /** The clock text ("1 h 30 min" + "after eating"); gets the big tabular clock type. */
  clock: ReactNode
  /** Optional speed control: under the clock on phones, beside it from 1024 px up. */
  pace?: ReactNode
  /** The timeline track; takes all the width that is left. */
  children: ReactNode
}

/**
 * The clock dock at the bottom of the stage (layout only: it owns no state). A Shelf surface with
 * the one rule above it; one row of Play, clock and track. It is a normal grid row of the stage,
 * so it reserves its own height and never covers the body; on phones it also pads for the home
 * indicator (safe area). 64 px tall on phones, 72 px from 1024 px up.
 */
export default function Dock({ label, play, clock, pace, children }: Props) {
  return (
    <section aria-label={label} className="border-t border-rule2 bg-shelf pb-[env(safe-area-inset-bottom)]">
      <div className="flex min-h-16 items-center gap-3 px-3 lg:min-h-18 lg:gap-4 lg:px-4">
        {play}
        <div className="flex shrink-0 flex-col justify-center lg:flex-row lg:items-center lg:gap-4">
          <div className="tabular text-clock-sm font-extrabold lg:text-clock">{clock}</div>
          {pace}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  )
}
