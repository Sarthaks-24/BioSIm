import { useTranslation } from 'react-i18next'
import type { SignalStatus } from '@lifepeek/engine'

/**
 * How sure we are, as a shape plus a word, never a colour (plan-ui-ux §3.2):
 * ■ simulated (solid), ◐ assumption (half), ▢ illustration (dashed outline).
 * The shapes are drawn, not typed, so they look the same in every font.
 */
function StatusGlyph({ status, size = 12 }: { status: SignalStatus; size?: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden="true" focusable="false" className="shrink-0">
      {status === 'simulated' && <rect x="1" y="1" width="10" height="10" rx="1.5" fill="currentColor" />}
      {status === 'assumption' && (
        <>
          <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 1.25a4.75 4.75 0 0 0 0 9.5z" fill="currentColor" />
        </>
      )}
      {status === 'illustration' && (
        <rect
          x="1.75"
          y="1.75"
          width="8.5"
          height="8.5"
          rx="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2.5 1.75"
        />
      )}
    </svg>
  )
}

/**
 * The status of a graph, a series or a layer: glyph + word from `status.<s>.label`, help as its
 * tooltip. `quiet`: smaller and lighter, for a graph's header, where it sits by the title and must
 * not read as one more line of the legend (council 2026-10-13).
 */
export default function StatusTag({ status, quiet = false }: { status: SignalStatus; quiet?: boolean }) {
  const { t } = useTranslation()
  return (
    <span
      data-status={status}
      title={t(`status.${status}.help`)}
      className={`inline-flex shrink-0 items-center whitespace-nowrap text-ink-2 ${quiet ? 'gap-1 text-micro' : 'gap-1.5 text-caption font-semibold'}`}
    >
      <StatusGlyph status={status} size={quiet ? 10 : 12} />
      {t(`status.${status}.label`)}
    </span>
  )
}
