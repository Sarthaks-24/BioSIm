import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  id: T
  label: ReactNode
}

interface Props<T extends string> {
  /** Names the group for screen readers ("Layer", "Graph"). */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}

/**
 * One choice out of a few, side by side: replaces v1's row of pills (layer switch, graph tabs).
 *
 * - Labels never wrap or get cut: when they don't fit (Hindi, a phone), the row scrolls sideways.
 * - The chosen segment has a Sunk fill and an ink bar under it. The bar carries the state, because
 *   Sunk on Paper is too faint to see on its own (WCAG 1.4.11).
 * - Plain toggle buttons (aria-pressed), one Tab stop each, so ← → stay free for the clock.
 */
export default function Segmented<T extends string>({ label, options, value, onChange, className = '' }: Props<T>) {
  return (
    // The padding gives the 3 px focus outline room inside the scroll box; the negative margin
    // keeps the row aligned with its neighbours.
    <div role="group" aria-label={label} className={`-m-1.5 flex max-w-full gap-1 overflow-x-auto overscroll-x-contain p-1.5 ${className}`}>
      {options.map((o) => {
        const selected = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.id)}
            className={`relative min-h-11 shrink-0 rounded-control px-3 pb-1 text-control font-semibold whitespace-nowrap lg:min-h-9 ${
              selected
                ? 'bg-sunk2 text-ink after:absolute after:inset-x-2 after:bottom-1 after:h-[3px] after:rounded-[2px] after:bg-ink'
                : 'text-ink-2 hover:bg-sunk2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
